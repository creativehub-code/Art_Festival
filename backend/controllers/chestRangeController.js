const mongoose = require("mongoose");
const crypto = require("crypto");
const ChestNumberConfig = require("../models/ChestNumberConfig");
const Group = require("../models/Group");
const Participant = require("../models/Participant");
const SystemLock = require("../models/SystemLock");
const sendError = require("../utils/errorResponse");
const {
  validateRangeInterval,
  checkGlobalNonOverlap,
  protectExistingGroupParticipants,
  protectOtherGroupParticipants,
  findNextAvailableChestNumber,
  validateChestNumberForGroup,
} = require("../utils/chestNumberUtils");
const { withTransactionRetry } = require("../utils/transactionRetry");

// Mutex identifier for chest range modifications
const CHEST_RANGE_MUTEX = "CHEST_RANGE_MUTEX";

/**
 * @desc    Get all configured chest number ranges with live utilization stats
 * @route   GET /api/chest-ranges
 * @access  Admin
 */
const getRanges = async (req, res) => {
  try {
    const ranges = await ChestNumberConfig.find()
      .populate("groupId", "name")
      .sort({ startNumber: 1 })
      .lean();

    const enrichedRanges = await Promise.all(
      ranges.map(async (range) => {
        const totalCapacity = range.endNumber - range.startNumber + 1;
        const assignedCount = await Participant.countDocuments({
          groupId: range.groupId?._id || range.groupId,
        });

        return {
          ...range,
          totalCapacity,
          assignedCount,
          remainingCapacity: Math.max(0, totalCapacity - assignedCount),
        };
      })
    );

    res.json({
      success: true,
      data: enrichedRanges,
    });
  } catch (error) {
    sendError(res, 500, "Failed to retrieve chest number ranges", error);
  }
};

/**
 * @desc    Get chest number range for a specific group
 * @route   GET /api/chest-ranges/group/:groupId
 * @route   GET /api/chest-ranges/:id
 * @access  Admin
 */
const getRangeByGroup = async (req, res) => {
  try {
    const id = req.params.groupId || req.params.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const range = await ChestNumberConfig.findOne({
      $or: [{ groupId: id }, { _id: id }],
    })
      .populate("groupId", "name")
      .lean();

    if (!range) {
      return res.status(404).json({
        message: "No chest number range configured for this group",
      });
    }

    const targetGroupId = range.groupId?._id || range.groupId;
    const totalCapacity = range.endNumber - range.startNumber + 1;
    const assignedCount = await Participant.countDocuments({ groupId: targetGroupId });

    res.json({
      success: true,
      data: {
        ...range,
        totalCapacity,
        assignedCount,
        remainingCapacity: Math.max(0, totalCapacity - assignedCount),
      },
    });
  } catch (error) {
    sendError(res, 500, "Failed to retrieve group chest range", error);
  }
};

/**
 * @desc    Suggest the next lowest available chest number for a group
 * @route   GET /api/chest-ranges/group/:groupId/next
 * @route   GET /api/chest-ranges/:id/next
 * @access  Admin
 */
const suggestNextChestNumber = async (req, res) => {
  try {
    const id = req.params.groupId || req.params.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    let targetGroupId = id;
    const config = await ChestNumberConfig.findOne({
      $or: [{ groupId: id }, { _id: id }],
    });
    if (config) {
      targetGroupId = config.groupId;
    }

    const nextInfo = await findNextAvailableChestNumber(targetGroupId);

    res.json({
      success: true,
      data: nextInfo,
    });
  } catch (error) {
    if (error.code === "RANGE_NOT_CONFIGURED") {
      return res.status(404).json({ message: error.message });
    }
    if (error.code === "RANGE_EXHAUSTED") {
      return res.status(409).json({ message: error.message });
    }
    sendError(res, 500, "Failed to determine next available chest number", error);
  }
};

/**
 * @desc    Create or update a chest number range for a group
 * @route   POST /api/chest-ranges
 * @access  Admin
 */
const createOrUpdateRange = async (req, res) => {
  const { groupId, startNumber, endNumber, isActive } = req.body;

  if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
    return res.status(400).json({ message: "Valid groupId is required" });
  }

  const startInt = parseInt(startNumber, 10);
  const endInt = parseInt(endNumber, 10);

  try {
    validateRangeInterval(startInt, endInt);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }

  const group = await Group.findById(groupId);
  if (!group) {
    return res.status(404).json({ message: "Category group not found" });
  }

  // Acquire global range modification mutex with bounded lease
  const workerToken = crypto.randomUUID();
  let acquired = false;
  let fencingToken = 0;

  for (let attempt = 0; attempt < 3; attempt++) {
    const lockResult = await SystemLock.acquireLock(
      CHEST_RANGE_MUTEX,
      workerToken,
      30000,
      groupId
    );
    if (lockResult.acquired) {
      acquired = true;
      fencingToken = lockResult.fencingToken;
      break;
    }
    // Exponential backoff if locked
    await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
  }

  if (!acquired) {
    return res.status(409).json({
      message:
        "Another range modification is currently in progress. Please retry in a few seconds.",
    });
  }

  try {
    // 1. Validate global non-overlap against all other groups
    await checkGlobalNonOverlap(groupId, startInt, endInt);

    // 2. Validate that existing participants in this group are not orphaned
    await protectExistingGroupParticipants(groupId, startInt, endInt);

    // 3. Validate that proposed range does not collide with participants in other groups
    await protectOtherGroupParticipants(groupId, startInt, endInt);

    // 4. Atomic upsert under multi-document transaction retry
    let updatedConfig;

    await withTransactionRetry("createOrUpdateRange", async (session) => {
      updatedConfig = await ChestNumberConfig.findOneAndUpdate(
        { groupId },
        {
          $set: {
            groupId,
            startNumber: startInt,
            endNumber: endInt,
            isActive: isActive !== undefined ? Boolean(isActive) : true,
            lastFencingToken: fencingToken,
          },
          $inc: {
            allocationCounter: 1,
          },
        },
        {
          new: true,
          upsert: true,
          session,
          setDefaultsOnInsert: true,
        }
      );
    });

    res.status(200).json({
      success: true,
      message: `Chest number range [${startInt}, ${endInt}] successfully configured for group '${group.name}'`,
      data: updatedConfig,
    });
  } catch (error) {
    sendError(res, 400, "Failed to configure chest number range", error);
  } finally {
    await SystemLock.releaseLock(CHEST_RANGE_MUTEX, workerToken);
  }
};

/**
 * @desc    Pre-flight validation of a chest number for a participant
 * @route   POST /api/chest-ranges/validate
 * @access  Admin
 */
const validateChestNumber = async (req, res) => {
  try {
    const { chestNumber, groupId, excludeParticipantId } = req.body;

    if (!chestNumber) {
      return res.status(400).json({ valid: false, message: "chestNumber is required" });
    }

    const result = await validateChestNumberForGroup(
      chestNumber,
      groupId,
      excludeParticipantId
    );

    if (!result.valid) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    res.status(400).json({ valid: false, message: error.message });
  }
};

/**
 * @desc    Delete a chest number range configuration
 * @route   DELETE /api/chest-ranges/:id
 * @route   DELETE /api/chest-ranges/group/:groupId
 * @access  Admin
 */
const deleteRange = async (req, res) => {
  try {
    const id = req.params.groupId || req.params.id;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid category group ID" });
    }

    const config = await ChestNumberConfig.findOne({
      $or: [{ groupId: id }, { _id: id }],
    });
    if (!config) {
      return res.status(404).json({ message: "Range configuration not found" });
    }

    const targetGroupId = config.groupId;

    const participantsCount = await Participant.countDocuments({ groupId: targetGroupId });
    if (participantsCount > 0) {
      return res.status(400).json({
        message: `Cannot delete range: ${participantsCount} participant(s) are currently assigned to this group. Remove or reassign them first.`,
      });
    }

    await ChestNumberConfig.findByIdAndDelete(config._id);

    res.json({
      success: true,
      message: "Chest number range removed successfully",
    });
  } catch (error) {
    sendError(res, 500, "Failed to delete chest number range", error);
  }
};

module.exports = {
  getRanges,
  getRangeByGroup,
  suggestNextChestNumber,
  createOrUpdateRange,
  validateChestNumber,
  deleteRange,
};
