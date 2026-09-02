const mongoose = require("mongoose");
const Program = require("../models/Program");
const JudgeMark = require("../models/JudgeMark");
const JudgeGroup = require("../models/JudgeGroup");
const Participant = require("../models/Participant");

const getPrograms = async (req, res) => {
  try {
    const programs = await Program.find().populate("groupId");

    // 1. Get unique judge counts for ALL programs in ONE query
    const markStats = await JudgeMark.aggregate([
      { $group: { _id: "$programId", judges: { $addToSet: "$judgeId" } } },
      { $project: { _id: 1, submittedCount: { $size: "$judges" } } }
    ]);
    const markStatsMap = Object.fromEntries(markStats.map(s => [s._id.toString(), s.submittedCount]));

    // 2. Identify programs with ANY marks
    const programsWithMarks = await JudgeMark.distinct("programId");
    const hasMarksSet = new Set(programsWithMarks.map(id => id.toString()));

    // 3. Get all judge group assignments in ONE query
    const allJudgeGroups = await JudgeGroup.find();
    const programAssignmentMap = {}; // { programId: Set(judgeIds) }
    
    allJudgeGroups.forEach(group => {
      if (group.assignedPrograms && group.judges) {
        group.assignedPrograms.forEach(pId => {
          const pidStr = pId.toString();
          if (!programAssignmentMap[pidStr]) programAssignmentMap[pidStr] = new Set();
          group.judges.forEach(jId => programAssignmentMap[pidStr].add(jId.toString()));
        });
      }
    });

    // 4. Participant counts per program — single aggregation, no N+1
    const participantCounts = await Participant.aggregate([
      { $unwind: '$programs' },
      { $group: { _id: '$programs', participantCount: { $sum: 1 } } },
    ]);
    const participantCountMap = Object.fromEntries(
      participantCounts.map(p => [p._id.toString(), p.participantCount])
    );

    // 5. Combine data and sort
    const programsWithMarkStatus = programs.map(program => {
      const pidStr = program._id.toString();
      return {
        ...program.toObject(),
        hasMarks: hasMarksSet.has(pidStr),
        submittedCount: markStatsMap[pidStr] || 0,
        totalAssigned: programAssignmentMap[pidStr] ? programAssignmentMap[pidStr].size : 0,
        participantCount: participantCountMap[pidStr] || 0,
      };
    });

    // 6. Sort by Category (Senior, Junior, etc.) and then Name
    programsWithMarkStatus.sort((a, b) => {
      const catA = a.groupId?.name || "";
      const catB = b.groupId?.name || "";
      if (catA !== catB) return catA.localeCompare(catB);
      return a.name.localeCompare(b.name);
    });

    res.json(programsWithMarkStatus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createProgram = async (req, res) => {
  try {
    // SECURITY PATCH: Mass Assignment / Over-posting Fix
    // Explicitly destructure ONLY safe, permitted fields from req.body.
    // Any extra fields sent in the request (e.g., _id, __v, totalScore)
    // are silently ignored and never reach the database.
    const { name, maxMarks, groupId, status, language, isConversation, topics } = req.body;

    const payload = {};
    if (name !== undefined)           payload.name = name;
    if (maxMarks !== undefined)       payload.maxMarks = maxMarks;
    if (groupId !== undefined)        payload.groupId = groupId;
    if (status !== undefined)         payload.status = status;
    if (language !== undefined)       payload.language = language;
    if (isConversation !== undefined) payload.isConversation = isConversation;
    if (topics !== undefined)         payload.topics = topics;

    const program = await Program.create(payload);
    res.status(201).json(program);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateProgram = async (req, res) => {
  try {
    const { id } = req.params;

    // SECURITY PATCH: Mass Assignment / Over-posting Fix
    // Explicitly destructure ONLY safe, permitted fields from req.body.
    // runValidators: true ensures Mongoose schema enums (e.g., language,
    // status) are fully respected, treating the DB as the last line of defence.
    const { name, maxMarks, groupId, status, language, isConversation, topics } = req.body;

    const updateData = {};
    if (name !== undefined)           updateData.name = name;
    if (maxMarks !== undefined)       updateData.maxMarks = maxMarks;
    if (groupId !== undefined)        updateData.groupId = groupId;
    if (status !== undefined)         updateData.status = status;
    if (language !== undefined)       updateData.language = language;
    if (isConversation !== undefined) updateData.isConversation = isConversation;
    if (topics !== undefined)         updateData.topics = topics;

    const program = await Program.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }
    res.json(program);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteProgram = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;

    await session.withTransaction(async () => {
      const program = await Program.findByIdAndDelete(id, { session });
      if (!program) {
        throw new Error("PROGRAM_NOT_FOUND");
      }

      const Participant = require("../models/Participant");
      const ProgramResult = require("../models/ProgramResult");
      const ConversationPair = require("../models/ConversationPair");

      // 1. Remove the programId from Participant.programs using $pull
      await Participant.updateMany(
        { programs: id },
        { $pull: { programs: id } },
        { session }
      );

      // 2. Remove the programId from JudgeGroup.assignedPrograms using $pull
      await JudgeGroup.updateMany(
        { assignedPrograms: id },
        { $pull: { assignedPrograms: id } },
        { session }
      );

      // 3. Delete all JudgeMark records belonging to the program
      await JudgeMark.deleteMany({ programId: id }, { session });

      // 4. Delete all ProgramResult records belonging to the program
      await ProgramResult.deleteMany({ programId: id }, { session });

      // 5. Delete all ConversationPair records belonging to the program
      await ConversationPair.deleteMany({ programId: id }, { session });
    });

    res.json({ message: "Program deleted successfully" });
  } catch (error) {
    if (error.message === "PROGRAM_NOT_FOUND") {
      return res.status(404).json({ message: "Program not found" });
    }
    res.status(500).json({ message: error.message });
  } finally {
    await session.endSession();
  }
};

const getPublicPrograms = async (req, res) => {
  try {
    const programs = await Program.find({ status: "completed" })
      .select("name language updatedAt")
      .sort({ updatedAt: -1 });
    res.json(programs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get participants registered for a specific program (Lightweight - No Image)
// @route   GET /api/programs/:programId/participants
// @access  Protected (Judge / Admin)
const getProgramParticipants = async (req, res) => {
  try {
    const { programId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(programId)) {
      return res.status(400).json({ message: "Invalid program ID format" });
    }

    const program = await Program.findById(programId);
    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    const query = { programs: programId };
    if (program.groupId) {
      query.groupId = program.groupId;
    }

    const participants = await Participant.find(query)
      .select("-image")
      .populate("teamId", "name")
      .populate("groupId", "name")
      .populate("programs", "name language")
      .sort({ chestNumber: 1, name: 1 });

    res.json(participants);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addTopic = async (req, res) => {
  try {
    const { id } = req.params;
    let { title } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Topic title is required" });
    }
    title = title.trim();

    const program = await Program.findById(id);
    if (!program) return res.status(404).json({ message: "Program not found" });

    // Check duplicate
    const isDuplicate = program.topics.some(
      (t) => t.title.toLowerCase() === title.toLowerCase()
    );
    if (isDuplicate) {
      return res.status(400).json({ message: "Topic already exists" });
    }

    program.topics.push({ title });
    await program.save();
    res.status(201).json(program);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateTopic = async (req, res) => {
  try {
    const { id, topicId } = req.params;
    let { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Topic title is required" });
    }
    title = title.trim();

    const program = await Program.findById(id);
    if (!program) return res.status(404).json({ message: "Program not found" });

    const topic = program.topics.id(topicId);
    if (!topic) return res.status(404).json({ message: "Topic not found" });

    // Check duplicate (excluding current topic)
    const isDuplicate = program.topics.some(
      (t) => t.title.toLowerCase() === title.toLowerCase() && t._id.toString() !== topicId
    );
    if (isDuplicate) {
      return res.status(400).json({ message: "Topic already exists" });
    }

    topic.title = title;
    await program.save();
    res.json(program);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteTopic = async (req, res) => {
  try {
    const { id, topicId } = req.params;

    const program = await Program.findById(id);
    if (!program) return res.status(404).json({ message: "Program not found" });

    const topicIndex = program.topics.findIndex(t => t._id.toString() === topicId);
    if (topicIndex === -1) {
      return res.status(404).json({ message: "Topic not found" });
    }

    // Check if topic is in use by any Participant
    const Participant = require("../models/Participant");
    const inUseByParticipant = await Participant.exists({ "programTopics.topicId": topicId });
    if (inUseByParticipant) {
      return res.status(400).json({ message: "Cannot delete topic because it is currently assigned to one or more participants." });
    }

    // Check if topic is in use by any ConversationPair
    const ConversationPair = require("../models/ConversationPair");
    const inUseByPair = await ConversationPair.exists({ topicId });
    if (inUseByPair) {
      return res.status(400).json({ message: "Cannot delete topic because it is currently assigned to a group/pair." });
    }

    program.topics.splice(topicIndex, 1);
    await program.save();
    res.json(program);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
  getPublicPrograms,
  getProgramParticipants,
  addTopic,
  updateTopic,
  deleteTopic,
};

