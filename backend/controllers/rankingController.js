const Participant = require("../models/Participant");
const ProgramResult = require("../models/ProgramResult");
const JudgeMark = require("../models/JudgeMark");
const Group = require("../models/Group");
const Program = require("../models/Program");

const escapeRegex = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const sendError = (res, status, message, error) => {
  console.error(message, error);
  res.status(status).json({ message, error: error?.message });
};

// @desc    Get paginated, globally ranked individual marks
// @route   GET /api/rankings/individual
// @access  Admin/Public
const getIndividualRankings = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 50;
    const groupId = req.query.groupId;
    const search = req.query.search;

    if (page < 1) return res.status(400).json({ message: "Page must be 1 or greater" });
    if (limit < 1) return res.status(400).json({ message: "Limit must be 1 or greater" });
    if (limit > 200) limit = 200;

    const filter = {};

    if (groupId && groupId !== "All" && groupId !== "") {
      const mongoose = require("mongoose");
      if (!mongoose.isValidObjectId(groupId)) {
        return res.status(400).json({ message: "Invalid group ID format" });
      }
      filter.groupId = groupId;
    }

    if (search && search.trim() !== "") {
      const safeQuery = escapeRegex(search.trim());
      filter.$or = [
        { name: { $regex: safeQuery, $options: "i" } },
        { chestNumber: { $regex: safeQuery, $options: "i" } },
      ];
    }

    // 1. FILTER participants matching criteria
    // 2. SORT entire matching dataset by totalScore DESC, _id ASC
    // 3. COUNT total matching
    const total = await Participant.countDocuments(filter);

    // 4. SKIP and 5. LIMIT
    const skip = (page - 1) * limit;

    const participants = await Participant.find(filter)
      .sort({ totalScore: -1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .populate("teamId", "name")
      .populate("groupId", "name")
      .select("-image -programs") // Keep it lightweight
      .lean();

    // The rank for each participant is their index in the global sorted dataset: skip + index + 1
    const rankedParticipants = participants.map((p, index) => ({
      ...p,
      rank: skip + index + 1
    }));

    res.json({
      participants: rankedParticipants,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    sendError(res, 500, "Failed to fetch individual rankings", error);
  }
};

// @desc    Get all program results for a specific participant
// @route   GET /api/rankings/individual/:participantId/results
// @access  Admin/Public
const getParticipantResults = async (req, res) => {
  try {
    const { participantId } = req.params;

    // Fetch ProgramResults where this participant was awarded points
    const results = await ProgramResult.find({
      $or: [{ participantId }, { participantIds: participantId }]
    })
      .populate("programId", "name language isConversation")
      .lean();

    // Fetch JudgeMarks for this participant to get the total marks given
    const marks = await JudgeMark.find({ participantId })
      .populate("programId", "name language isConversation")
      .lean();

    res.json({ results, marks });
  } catch (error) {
    sendError(res, 500, "Failed to fetch participant results", error);
  }
};

module.exports = {
  getIndividualRankings,
  getParticipantResults
};
