const mongoose = require("mongoose");
const Group = require("../models/Group");
const sendError = require("../utils/errorResponse");

const getGroups = async (req, res) => {
  try {
    const groups = await Group.find().populate({
      path: "participantIds",
      populate: { path: "teamId", select: "name" },
    });
    res.json(groups);
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

module.exports = { getGroups, createGroup, deleteGroup };
