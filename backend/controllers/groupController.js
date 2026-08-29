const mongoose = require("mongoose");
const Group = require("../models/Group");
const Participant = require("../models/Participant");
const sendError = require("../utils/errorResponse");

const getGroups = async (req, res) => {
  try {
    const groups = await Group.find().lean();
    
    // Aggregate member counts
    const groupsWithCounts = await Promise.all(
      groups.map(async (group) => {
        const memberCount = await Participant.countDocuments({ groupId: group._id });
        return { ...group, memberCount };
      })
    );
    
    res.json(groupsWithCounts);
  } catch (error) {
    sendError(res, 500, "Failed to retrieve groups", error);
  }
};

const createGroup = async (req, res) => {
  try {
    const { name } = req.body;
    const group = await Group.create({ name });
    res.status(201).json(group);
  } catch (error) {
    sendError(res, 400, "Failed to create group", error);
  }
};

const deleteGroup = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    
    await session.withTransaction(async () => {
      const group = await Group.findByIdAndDelete(id, { session });
      if (!group) {
        throw new Error("GROUP_NOT_FOUND");
      }

      const Participant = require("../models/Participant");
      const Program = require("../models/Program");

      // 1. Remove group reference from Participants
      await Participant.updateMany(
        { groupId: id },
        { $unset: { groupId: 1 } },
        { session }
      );

      // 2. Remove group reference from Programs
      await Program.updateMany(
        { groupId: id },
        { $unset: { groupId: 1 } },
        { session }
      );
    });

    res.json({ message: "Group deleted successfully" });
  } catch (error) {
    if (error.message === "GROUP_NOT_FOUND") {
      return res.status(404).json({ message: "Group not found" });
    }
    sendError(res, 500, "Failed to delete group", error);
  } finally {
    await session.endSession();
  }
};

const getGroupParticipants = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [participants, total] = await Promise.all([
      Participant.find({ groupId: id })
        .select("-image")
        .populate("teamId", "name")
        .populate("programs", "name language")
        .skip(skip)
        .limit(limit)
        .lean(),
      Participant.countDocuments({ groupId: id }),
    ]);

    res.json({
      participants,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    sendError(res, 500, "Failed to retrieve group participants", error);
  }
};

module.exports = { getGroups, createGroup, deleteGroup, getGroupParticipants };
