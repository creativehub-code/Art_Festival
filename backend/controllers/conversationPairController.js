const mongoose = require("mongoose");
const ConversationPair = require("../models/ConversationPair");
const Participant = require("../models/Participant");
const Program = require("../models/Program");

// @desc    Register a conversation pair for a program
// @route   POST /api/conversation-pairs
// @access  Admin
const createPair = async (req, res) => {
  try {
    const { participantIds, programId, primaryParticipantId, topicId } = req.body;

    // ── 1. Presence check ─────────────────────────────────────────────────────
    if (!participantIds || !Array.isArray(participantIds) || participantIds.length < 2 || !programId || !primaryParticipantId) {
      return res.status(400).json({
        message: "participantIds (array of at least 2), programId, and primaryParticipantId are all required",
      });
    }

    // primaryParticipantId must be one of the participants
    if (!participantIds.includes(primaryParticipantId)) {
      return res.status(400).json({
        message: "primaryParticipantId must be one of the participantIds",
      });
    }

    // ── 2. Program check ──────────────────────────────────────────────────────
    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }
    if (!program.isConversation) {
      return res.status(400).json({ message: "This program is not a Conversation program" });
    }

    if (topicId) {
      const topicExists = program.topics.some(t => t._id.toString() === topicId.toString());
      if (!topicExists) {
        return res.status(400).json({ message: "Topic does not belong to the selected program" });
      }
    }

    // ── 3. Fetch all participants ─────────────────────────────────────────────
    const participants = await Participant.find({ _id: { $in: participantIds } }).select("name chestNumber teamId groupId");

    if (participants.length !== participantIds.length) {
      return res.status(404).json({ message: "One or more participants not found" });
    }

    // ── 4. Consistency check (Team & Group) ───────────────────────────────────
    const firstP = participants[0];
    const teamId = firstP.teamId?.toString();
    const groupId = firstP.groupId?.toString();

    if (!teamId || !groupId) {
      return res.status(400).json({ message: "All participants must belong to a Team and a Group" });
    }

    for (const p of participants) {
      if (p.teamId?.toString() !== teamId) {
        return res.status(400).json({
          message: `Participants must be from the same Team. ${p.name} is in a different team than ${firstP.name}`,
        });
      }
      if (p.groupId?.toString() !== groupId) {
        return res.status(400).json({
          message: `Participants must be from the same Group. ${p.name} is in a different group than ${firstP.name}`,
        });
      }
    }

    // ── 5. Duplicate pair check ───────────────────────────────────────────────
    const existingPair = await ConversationPair.findOne({
      programId,
      participants: { $in: participantIds },
    });
    if (existingPair) {
      return res.status(400).json({
        message: "One or more participants are already registered in a group/pair for this program",
      });
    }

    // ── 6. Create the pair record and synchronize participants ─────────────────
    const session = await mongoose.startSession();
    let populated;

    try {
      await session.withTransaction(async () => {
        const pairs = await ConversationPair.create([{
          programId,
          participants: participantIds,
          primaryParticipantId,
          teamId: firstP.teamId,
          groupId: firstP.groupId,
          topicId: topicId || null,
        }], { session });

        const pair = pairs[0];

        // ── 7. Add program to all participants' programs[] without duplicates ─────
        await Participant.updateMany(
          { _id: { $in: participantIds } },
          { $addToSet: { programs: programId } },
          { session }
        );

        // Also add the topic mapping to participants' programTopics for consistency
        if (topicId) {
          // First remove any existing mapping for this program to avoid duplicates
          await Participant.updateMany(
            { _id: { $in: participantIds } },
            { $pull: { programTopics: { programId } } },
            { session }
          );
          // Then push the new one
          await Participant.updateMany(
            { _id: { $in: participantIds } },
            { $push: { programTopics: { programId, topicId } } },
            { session }
          );
        }

        // ── 8. Return populated pair ──────────────────────────────────────────────
        populated = await ConversationPair.findById(pair._id)
          .session(session)
          .populate("participants", "name chestNumber")
          .populate("primaryParticipantId", "name chestNumber")
          .populate("programId", "name language");
      });
    } finally {
      await session.endSession();
    }

    res.status(201).json({ message: "Conversation group registered successfully", pair: populated });
  } catch (error) {
    console.error("createPair error:", error);
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Conflict: One or more participants are already registered in a group/pair for this program",
      });
    }
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all pairs for a program (for judge UI and admin display)
// @route   GET /api/conversation-pairs/by-program/:programId
// @access  Admin + Judge
const getPairsByProgram = async (req, res) => {
  try {
    const { programId } = req.params;
    const pairs = await ConversationPair.find({ programId })
      .populate("participants", "name chestNumber")
      .populate("primaryParticipantId", "name chestNumber")
      .sort({ createdAt: 1 });
    res.json(pairs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createPair, getPairsByProgram };
