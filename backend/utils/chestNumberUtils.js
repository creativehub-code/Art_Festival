const mongoose = require("mongoose");
const ChestNumberConfig = require("../models/ChestNumberConfig");
const Participant = require("../models/Participant");

/**
 * Normalizes a chest number to its canonical integer string form.
 * Strips whitespace, rejects non-positive/non-decimal strings, removes leading zeros.
 *
 * @param {string|number} raw - The raw input chest number
 * @returns {string} Canonical string without leading zeros (e.g. "101")
 */
function normalizeChestNumber(raw) {
  if (raw === null || raw === undefined) {
    throw new Error("Chest number cannot be null or undefined");
  }

  const str = String(raw).trim();
  if (!str) {
    throw new Error("Chest number cannot be empty");
  }

  // Strictly enforce positive decimal digits (rejects negatives, fractions, non-numerics)
  if (!/^\d+$/.test(str)) {
    throw new Error(
      `Invalid chest number format: '${raw}'. Must contain positive digits only.`
    );
  }

  const intVal = parseInt(str, 10);
  if (isNaN(intVal) || intVal <= 0) {
    throw new Error(
      `Chest number must be a positive integer greater than 0. Received: '${raw}'`
    );
  }

  // Canonical form: String representation without leading zeros
  return String(intVal);
}

/**
 * Validates that [startNumber, endNumber] forms a valid positive integer range.
 *
 * @param {number} startNumber
 * @param {number} endNumber
 */
function validateRangeInterval(startNumber, endNumber) {
  if (
    !Number.isInteger(startNumber) ||
    !Number.isInteger(endNumber) ||
    startNumber <= 0 ||
    endNumber <= 0
  ) {
    throw new Error("startNumber and endNumber must be positive integers");
  }

  if (startNumber > endNumber) {
    throw new Error(
      `startNumber (${startNumber}) cannot be greater than endNumber (${endNumber})`
    );
  }
}

/**
 * Determines whether two closed intervals overlap.
 *
 * @param {{ startNumber: number, endNumber: number }} a
 * @param {{ startNumber: number, endNumber: number }} b
 * @returns {boolean}
 */
function isRangeOverlapping(a, b) {
  return !(a.endNumber < b.startNumber || a.startNumber > b.endNumber);
}

/**
 * Validates that [startNumber, endNumber] does not overlap with any other group's range.
 *
 * @param {string|mongoose.Types.ObjectId} groupId - Target group being configured
 * @param {number} startNumber
 * @param {number} endNumber
 * @param {mongoose.ClientSession} [session]
 */
async function checkGlobalNonOverlap(groupId, startNumber, endNumber, session = null) {
  const query = ChestNumberConfig.find({
    groupId: { $ne: groupId },
    isActive: true,
  }).populate("groupId", "name");

  if (session) query.session(session);
  const otherConfigs = await query;

  const targetRange = { startNumber, endNumber };

  for (const other of otherConfigs) {
    if (isRangeOverlapping(targetRange, other)) {
      const otherGroupName = other.groupId?.name || other.groupId || "Unknown Group";
      throw new Error(
        `Range [${startNumber}, ${endNumber}] overlaps with existing range [${other.startNumber}, ${other.endNumber}] configured for group '${otherGroupName}'`
      );
    }
  }
}

/**
 * Protects existing participants in the target group from being orphaned by range shrinking.
 *
 * @param {string|mongoose.Types.ObjectId} groupId
 * @param {number} startNumber
 * @param {number} endNumber
 * @param {mongoose.ClientSession} [session]
 */
async function protectExistingGroupParticipants(
  groupId,
  startNumber,
  endNumber,
  session = null
) {
  const query = Participant.find({ groupId }).select("name chestNumber");
  if (session) query.session(session);
  const participants = await query;

  for (const p of participants) {
    let num;
    try {
      num = parseInt(normalizeChestNumber(p.chestNumber), 10);
    } catch (e) {
      // Non-numeric legacy chest numbers are flagged
      continue;
    }

    if (num < startNumber || num > endNumber) {
      throw new Error(
        `Proposed range [${startNumber}, ${endNumber}] excludes existing participant '${p.name}' (Chest #${p.chestNumber}) in this group`
      );
    }
  }
}

/**
 * Protects participants in OTHER groups from colliding with the proposed range.
 *
 * @param {string|mongoose.Types.ObjectId} groupId
 * @param {number} startNumber
 * @param {number} endNumber
 * @param {mongoose.ClientSession} [session]
 */
async function protectOtherGroupParticipants(
  groupId,
  startNumber,
  endNumber,
  session = null
) {
  const query = Participant.find({
    groupId: { $ne: groupId },
  }).select("name chestNumber groupId").populate("groupId", "name");

  if (session) query.session(session);
  const otherParticipants = await query;

  for (const p of otherParticipants) {
    let num;
    try {
      num = parseInt(normalizeChestNumber(p.chestNumber), 10);
    } catch (e) {
      continue;
    }

    if (num >= startNumber && num <= endNumber) {
      const otherGroupName = p.groupId?.name || "Another Group";
      throw new Error(
        `Proposed range [${startNumber}, ${endNumber}] collides with existing participant '${p.name}' (Chest #${p.chestNumber}) assigned to group '${otherGroupName}'`
      );
    }
  }
}

/**
 * Scans the configured range for a group and finds the next lowest available chest number.
 *
 * @param {string|mongoose.Types.ObjectId} groupId
 * @param {mongoose.ClientSession} [session]
 * @returns {Promise<{ nextChestNumber: string, startNumber: number, endNumber: number, totalAssigned: number, remainingCapacity: number }>}
 */
async function findNextAvailableChestNumber(groupId, session = null) {
  const configQuery = ChestNumberConfig.findOne({ groupId, isActive: true });
  if (session) configQuery.session(session);
  const config = await configQuery;

  if (!config) {
    const err = new Error("No active chest number range configured for this category group");
    err.code = "RANGE_NOT_CONFIGURED";
    throw err;
  }

  const { startNumber, endNumber } = config;

  // 1. Fetch all currently assigned chest numbers across ALL participants
  const partQuery = Participant.find().select("chestNumber");
  if (session) partQuery.session(session);
  const participants = await partQuery;

  const takenSet = new Set();
  participants.forEach((p) => {
    try {
      takenSet.add(normalizeChestNumber(p.chestNumber));
    } catch (e) {
      takenSet.add(String(p.chestNumber).trim());
    }
  });

  // 2. Fetch active reservations if model exists
  if (mongoose.models.ChestNumberReservation) {
    const now = new Date();
    const resQuery = mongoose.models.ChestNumberReservation.find({
      isCommitted: false,
      expiresAt: { $gt: now },
    }).select("chestNumber");
    if (session) resQuery.session(session);
    const reservations = await resQuery;
    reservations.forEach((r) => {
      try {
        takenSet.add(normalizeChestNumber(r.chestNumber));
      } catch (e) {
        takenSet.add(String(r.chestNumber).trim());
      }
    });
  }

  // 3. Find smallest available integer in [startNumber, endNumber]
  let nextNum = null;
  let assignedInRange = 0;

  for (let i = startNumber; i <= endNumber; i++) {
    const candidateStr = String(i);
    if (takenSet.has(candidateStr)) {
      assignedInRange++;
    } else if (nextNum === null) {
      nextNum = candidateStr;
    }
  }

  const totalCapacity = endNumber - startNumber + 1;
  const remainingCapacity = totalCapacity - assignedInRange;

  if (!nextNum) {
    const err = new Error(
      `Chest number range [${startNumber}, ${endNumber}] for this group is completely exhausted (${assignedInRange}/${totalCapacity} used)`
    );
    err.code = "RANGE_EXHAUSTED";
    throw err;
  }

  return {
    nextChestNumber: nextNum,
    startNumber,
    endNumber,
    totalAssigned: assignedInRange,
    remainingCapacity,
  };
}

/**
 * Validates whether a chest number is valid and acceptable for a given participant in a group.
 *
 * @param {string|number} rawChestNumber
 * @param {string|mongoose.Types.ObjectId} groupId
 * @param {string|mongoose.Types.ObjectId} [excludeParticipantId] - For update validation
 * @param {mongoose.ClientSession} [session]
 */
async function validateChestNumberForGroup(
  rawChestNumber,
  groupId,
  excludeParticipantId = null,
  session = null
) {
  const normalized = normalizeChestNumber(rawChestNumber);
  const intVal = parseInt(normalized, 10);

  // 1. Check uniqueness across existing participants
  const dupQuery = { chestNumber: normalized };
  if (excludeParticipantId) {
    dupQuery._id = { $ne: excludeParticipantId };
  }
  const findDup = Participant.findOne(dupQuery);
  if (session) findDup.session(session);
  const existingDup = await findDup;

  if (existingDup) {
    return {
      valid: false,
      code: "DUPLICATE_CHEST_NUMBER",
      message: `Chest number '${normalized}' is already assigned to participant '${existingDup.name}'`,
    };
  }

  // 2. Check group range configuration
  if (groupId) {
    const configQuery = ChestNumberConfig.findOne({ groupId, isActive: true });
    if (session) configQuery.session(session);
    const config = await configQuery;

    if (!config) {
      return {
        valid: false,
        code: "RANGE_NOT_CONFIGURED",
        message: "No active chest number range configured for this category group",
      };
    }

    if (intVal < config.startNumber || intVal > config.endNumber) {
      return {
        valid: false,
        code: "OUT_OF_RANGE",
        message: `Chest number '${normalized}' is outside the valid range [${config.startNumber}, ${config.endNumber}] configured for this group`,
      };
    }
  }

  return {
    valid: true,
    normalized,
    intVal,
  };
}

module.exports = {
  normalizeChestNumber,
  validateRangeInterval,
  isRangeOverlapping,
  checkGlobalNonOverlap,
  protectExistingGroupParticipants,
  protectOtherGroupParticipants,
  findNextAvailableChestNumber,
  validateChestNumberForGroup,
};
