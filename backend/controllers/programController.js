const mongoose = require("mongoose");
const Program = require("../models/Program");
const JudgeMark = require("../models/JudgeMark");
const JudgeGroup = require("../models/JudgeGroup");
const Participant = require("../models/Participant");
const Language = require("../models/Language");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validate and parse a position value.
 * Returns a positive integer, or null if the value is absent/null/empty-string.
 * Throws an Error if the value is invalid (negative, zero, decimal, NaN, etc).
 */
function parsePosition(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw new Error(
      `Position must be a positive integer (received: ${JSON.stringify(value)})`
    );
  }
  return n;
}

/**
 * Make room for a new program at `targetPos` in the global ordering.
 * Increments globalPosition for all programs with globalPosition >= targetPos.
 * Optionally exclude one program id from the shift (the program being moved).
 */
async function shiftGlobalUp(targetPos, excludeId = null, session) {
  const filter = { globalPosition: { $gte: targetPos } };
  if (excludeId) filter._id = { $ne: excludeId };
  await Program.updateMany(filter, { $inc: { globalPosition: 1 } }, { session });
}

/**
 * Close the gap left by a program that moved away from `vacatedPos`.
 * Decrements globalPosition for all programs with globalPosition > vacatedPos.
 * Optionally exclude one id.
 */
async function shiftGlobalDown(vacatedPos, excludeId = null, session) {
  const filter = { globalPosition: { $gt: vacatedPos } };
  if (excludeId) filter._id = { $ne: excludeId };
  await Program.updateMany(filter, { $inc: { globalPosition: -1 } }, { session });
}

/**
 * Make room for a new program at `targetPos` within the given language.
 */
async function shiftLanguageUp(language, targetPos, excludeId = null, session) {
  const filter = { language, languagePosition: { $gte: targetPos } };
  if (excludeId) filter._id = { $ne: excludeId };
  await Program.updateMany(filter, { $inc: { languagePosition: 1 } }, { session });
}

/**
 * Close the gap after a program vacates `vacatedPos` within a language.
 */
async function shiftLanguageDown(language, vacatedPos, excludeId = null, session) {
  const filter = { language, languagePosition: { $gt: vacatedPos } };
  if (excludeId) filter._id = { $ne: excludeId };
  await Program.updateMany(filter, { $inc: { languagePosition: -1 } }, { session });
}

/**
 * Validate program criteria configuration.
 * Enforces non-empty titles, unique title names, and positive maxMarks > 0.
 * Automatically calculates the sum of criteria maxMarks.
 */
function validateCriteria(criteria, criteriaEnabled) {
  if (!criteriaEnabled) return { validCriteria: criteria || [], totalMaxMarks: null };
  if (!criteria || !Array.isArray(criteria) || criteria.length === 0) {
    throw new Error("At least one criterion is required when Detailed Criteria Marking is enabled.");
  }
  const titlesSet = new Set();
  let total = 0;
  const validCriteria = criteria.map((c, idx) => {
    const title = c.title ? String(c.title).trim() : (c.name ? String(c.name).trim() : "");
    if (!title) {
      throw new Error(`Criterion ${idx + 1} name cannot be empty.`);
    }
    const titleLower = title.toLowerCase();
    if (titlesSet.has(titleLower)) {
      throw new Error(`Duplicate criterion name "${title}". Each criterion name must be unique.`);
    }
    titlesSet.add(titleLower);
    const maxMarks = Number(c.maxMarks);
    if (isNaN(maxMarks) || maxMarks <= 0) {
      throw new Error(`Criterion "${title}" max marks must be a positive number greater than 0.`);
    }
    total += maxMarks;
    return {
      _id: c._id || new mongoose.Types.ObjectId(),
      title,
      maxMarks,
      position: c.position !== undefined ? c.position : idx,
    };
  });
  return { validCriteria, totalMaxMarks: total };
}

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

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

    // 5. Combine data
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

    // 6. Sort: programs with globalPosition first (asc), then nulls by name
    programsWithMarkStatus.sort((a, b) => {
      const aPos = a.globalPosition;
      const bPos = b.globalPosition;
      if (aPos !== null && bPos !== null) return aPos - bPos;
      if (aPos !== null) return -1; // a has position, b doesn't → a first
      if (bPos !== null) return 1;  // b has position, a doesn't → b first
      // Both null: fall back to group name then program name
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
  const session = await mongoose.startSession();
  try {
    const { name, maxMarks, groupId, status, language, isConversation, topics, criteria, criteriaEnabled, globalPosition: gpRaw, languagePosition: lpRaw } = req.body;

    // Validate positions
    let globalPosition, languagePosition;
    try {
      globalPosition = parsePosition(gpRaw);
      languagePosition = parsePosition(lpRaw);
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }

    // Validate language existence
    if (language) {
      const langDoc = await Language.findOne({
        name: { $regex: new RegExp(`^${language.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      });
      if (!langDoc) {
        return res.status(400).json({ message: "Selected language does not exist." });
      }
    }

    // Validate criteria configuration
    const isCriteriaEnabled = Boolean(criteriaEnabled);
    const { validCriteria, totalMaxMarks } = validateCriteria(criteria, isCriteriaEnabled);

    const payload = {};
    if (name !== undefined)           payload.name = name;
    if (groupId !== undefined)        payload.groupId = groupId;
    if (status !== undefined)         payload.status = status;
    if (language !== undefined)       payload.language = language;
    if (isConversation !== undefined) payload.isConversation = isConversation;
    if (topics !== undefined)         payload.topics = topics;
    
    payload.criteriaEnabled = isCriteriaEnabled;
    payload.criteria = validCriteria;

    if (isCriteriaEnabled && totalMaxMarks !== null) {
      payload.maxMarks = totalMaxMarks;
    } else if (maxMarks !== undefined) {
      payload.maxMarks = maxMarks;
    }

    payload.globalPosition = globalPosition;
    payload.languagePosition = languagePosition;

    let program;
    await session.withTransaction(async () => {
      // Shift global positions to make room
      if (globalPosition !== null) {
        await shiftGlobalUp(globalPosition, null, session);
      }
      // Shift language positions to make room
      if (languagePosition !== null && payload.language) {
        await shiftLanguageUp(payload.language, languagePosition, null, session);
      }
      const [created] = await Program.create([payload], { session });
      program = created;
    });

    res.status(201).json(program);
  } catch (error) {
    res.status(400).json({ message: error.message });
  } finally {
    await session.endSession();
  }
};

const updateProgram = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;

    const { name, maxMarks, groupId, status, language, isConversation, topics, criteria, criteriaEnabled, globalPosition: gpRaw, languagePosition: lpRaw } = req.body;

    // Validate positions
    let newGlobalPosition, newLanguagePosition;
    try {
      newGlobalPosition = gpRaw !== undefined ? parsePosition(gpRaw) : undefined;
      newLanguagePosition = lpRaw !== undefined ? parsePosition(lpRaw) : undefined;
    } catch (e) {
      return res.status(400).json({ message: e.message });
    }

    // Validate language existence
    if (language !== undefined && language !== null && language !== "") {
      const langDoc = await Language.findOne({
        name: { $regex: new RegExp(`^${language.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      });
      if (!langDoc) {
        return res.status(400).json({ message: "Selected language does not exist." });
      }
    }

    const updateData = {};
    if (name !== undefined)           updateData.name = name;
    if (groupId !== undefined)        updateData.groupId = groupId;
    if (status !== undefined)         updateData.status = status;
    if (language !== undefined)       updateData.language = language;
    if (isConversation !== undefined) updateData.isConversation = isConversation;
    if (topics !== undefined)         updateData.topics = topics;

    if (newGlobalPosition !== undefined) updateData.globalPosition = newGlobalPosition;
    if (newLanguagePosition !== undefined) updateData.languagePosition = newLanguagePosition;

    let program;
    await session.withTransaction(async () => {
      // Fetch the current state of the program before updating
      const existing = await Program.findById(id).session(session);
      if (!existing) throw new Error("PROGRAM_NOT_FOUND");

      if (criteriaEnabled !== undefined || criteria !== undefined) {
        const isCriteriaEnabled = criteriaEnabled !== undefined ? Boolean(criteriaEnabled) : existing.criteriaEnabled;
        const effectiveCriteria = criteria !== undefined ? criteria : (existing.criteria || []);
        
        const { validCriteria, totalMaxMarks } = validateCriteria(effectiveCriteria, isCriteriaEnabled);
        
        updateData.criteriaEnabled = isCriteriaEnabled;
        if (criteria !== undefined) {
          updateData.criteria = validCriteria;
        }
        
        if (isCriteriaEnabled && totalMaxMarks !== null) {
          updateData.maxMarks = totalMaxMarks;
        } else if (maxMarks !== undefined) {
          updateData.maxMarks = maxMarks;
        }
      } else if (maxMarks !== undefined) {
        updateData.maxMarks = maxMarks;
      }

      const oldGlobalPos = existing.globalPosition;
      const oldLangPos = existing.languagePosition;
      const oldLanguage = existing.language;
      const newLanguage = language !== undefined ? language : oldLanguage;

      // ---------------------------------------------------------------
      // 1. Handle globalPosition shift
      // ---------------------------------------------------------------
      if (newGlobalPosition !== undefined) {
        const gp = newGlobalPosition; // may be null or a number

        if (gp === null && oldGlobalPos !== null) {
          // Program is being un-positioned: close the gap
          await shiftGlobalDown(oldGlobalPos, id, session);
        } else if (gp !== null && oldGlobalPos === null) {
          // Program is being positioned for the first time
          await shiftGlobalUp(gp, id, session);
        } else if (gp !== null && oldGlobalPos !== null && gp !== oldGlobalPos) {
          // Program is moving positions
          if (gp < oldGlobalPos) {
            // Moving up: shift others down to make room
            await shiftGlobalUp(gp, id, session);
            // Close the gap at old position (which is now +1 due to the shift above)
            await shiftGlobalDown(oldGlobalPos + 1, id, session);
          } else {
            // Moving down: close old gap first
            await shiftGlobalDown(oldGlobalPos, id, session);
            // Make room at new position (which is now -1 due to the close above)
            await shiftGlobalUp(gp, id, session);
          }
        }
      }

      // ---------------------------------------------------------------
      // 2. Handle languagePosition shift — also handles language change
      // ---------------------------------------------------------------
      if (newLanguagePosition !== undefined || (language !== undefined && language !== oldLanguage)) {
        const lp = newLanguagePosition !== undefined ? newLanguagePosition : oldLangPos;
        const languageChanged = language !== undefined && language !== oldLanguage;

        if (languageChanged) {
          // Remove from old language ordering
          if (oldLangPos !== null) {
            await shiftLanguageDown(oldLanguage, oldLangPos, id, session);
          }
          // Insert into new language ordering
          if (lp !== null) {
            await shiftLanguageUp(newLanguage, lp, id, session);
          }
          // Ensure updateData reflects new languagePosition
          updateData.languagePosition = lp;
        } else {
          // Same language, just changing position
          const lp_new = newLanguagePosition; // may be null or a number
          if (lp_new === null && oldLangPos !== null) {
            await shiftLanguageDown(oldLanguage, oldLangPos, id, session);
          } else if (lp_new !== null && oldLangPos === null) {
            await shiftLanguageUp(oldLanguage, lp_new, id, session);
          } else if (lp_new !== null && oldLangPos !== null && lp_new !== oldLangPos) {
            if (lp_new < oldLangPos) {
              await shiftLanguageUp(oldLanguage, lp_new, id, session);
              await shiftLanguageDown(oldLanguage, oldLangPos + 1, id, session);
            } else {
              await shiftLanguageDown(oldLanguage, oldLangPos, id, session);
              await shiftLanguageUp(oldLanguage, lp_new, id, session);
            }
          }
        }
      }

      program = await Program.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
        session,
      });
    });

    res.json(program);
  } catch (error) {
    if (error.message === "PROGRAM_NOT_FOUND") {
      return res.status(404).json({ message: "Program not found" });
    }
    res.status(400).json({ message: error.message });
  } finally {
    await session.endSession();
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

      // Close ordering gaps left by deletion
      if (program.globalPosition !== null) {
        await shiftGlobalDown(program.globalPosition, null, session);
      }
      if (program.languagePosition !== null && program.language) {
        await shiftLanguageDown(program.language, program.languagePosition, null, session);
      }

      const ProgramResult = require("../models/ProgramResult");
      const ConversationPair = require("../models/ConversationPair");
      const MarkAuditLog = require("../models/MarkAuditLog");

      // 1. Remove the programId from Participant.programs and Participant.programTopics using $pull
      await Participant.updateMany(
        { programs: id },
        { $pull: { programs: id } },
        { session }
      );
      await Participant.updateMany(
        { "programTopics.programId": id },
        { $pull: { programTopics: { programId: id } } },
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
      
      // 6. Delete all MarkAuditLog records belonging to the program
      await MarkAuditLog.deleteMany({ programId: id }, { session });
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
      .select("name language updatedAt globalPosition")
      .sort({ globalPosition: 1, updatedAt: -1 });
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

const addCriterion = async (req, res) => {
  try {
    const { id } = req.params;
    let { title, maxMarks } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Criterion title is required" });
    }
    title = title.trim();

    const marksNum = Number(maxMarks);
    if (isNaN(marksNum) || marksNum <= 0) {
      return res.status(400).json({ message: "Criterion max marks must be greater than 0" });
    }

    const program = await Program.findById(id);
    if (!program) return res.status(404).json({ message: "Program not found" });

    // Check duplicate criterion title
    const isDuplicate = (program.criteria || []).some(
      (c) => c.title.toLowerCase() === title.toLowerCase()
    );
    if (isDuplicate) {
      return res.status(400).json({ message: "Criterion with this title already exists" });
    }

    const nextPosition = (program.criteria || []).length;
    if (!program.criteria) program.criteria = [];
    program.criteria.push({ title, maxMarks: marksNum, position: nextPosition });

    // Sum criteria max marks to update program.maxMarks
    program.maxMarks = program.criteria.reduce((sum, c) => sum + Number(c.maxMarks), 0);

    await program.save();
    res.status(201).json(program);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateCriterion = async (req, res) => {
  try {
    const { id, criterionId } = req.params;
    let { title, maxMarks } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Criterion title is required" });
    }
    title = title.trim();

    const marksNum = Number(maxMarks);
    if (isNaN(marksNum) || marksNum <= 0) {
      return res.status(400).json({ message: "Criterion max marks must be greater than 0" });
    }

    const program = await Program.findById(id);
    if (!program) return res.status(404).json({ message: "Program not found" });

    const criterion = program.criteria ? program.criteria.id(criterionId) : null;
    if (!criterion) return res.status(404).json({ message: "Criterion not found" });

    // Check duplicate (excluding self)
    const isDuplicate = program.criteria.some(
      (c) => c.title.toLowerCase() === title.toLowerCase() && c._id.toString() !== criterionId
    );
    if (isDuplicate) {
      return res.status(400).json({ message: "Criterion with this title already exists" });
    }

    criterion.title = title;
    criterion.maxMarks = marksNum;

    // Recalculate total maxMarks
    program.maxMarks = program.criteria.reduce((sum, c) => sum + Number(c.maxMarks), 0);

    await program.save();
    res.json(program);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteCriterion = async (req, res) => {
  try {
    const { id, criterionId } = req.params;

    const program = await Program.findById(id);
    if (!program) return res.status(404).json({ message: "Program not found" });

    const criterionIndex = (program.criteria || []).findIndex(c => c._id.toString() === criterionId);
    if (criterionIndex === -1) {
      return res.status(404).json({ message: "Criterion not found" });
    }

    // Check if criterion is in use in any JudgeMark
    const inUseByMark = await JudgeMark.exists({ programId: id, "criteriaMarks.criterionId": criterionId });
    if (inUseByMark) {
      return res.status(400).json({ message: "Cannot delete criterion because marks have already been submitted using it." });
    }

    program.criteria.splice(criterionIndex, 1);
    if (program.criteria.length > 0) {
      program.maxMarks = program.criteria.reduce((sum, c) => sum + Number(c.maxMarks), 0);
    }

    await program.save();
    res.json(program);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const reorderCriteria = async (req, res) => {
  try {
    const { id } = req.params;
    const { criteriaOrder } = req.body;

    if (!Array.isArray(criteriaOrder)) {
      return res.status(400).json({ message: "criteriaOrder must be an array of criterion IDs" });
    }

    const program = await Program.findById(id);
    if (!program) return res.status(404).json({ message: "Program not found" });

    const criteriaMap = new Map((program.criteria || []).map(c => [c._id.toString(), c]));
    const reordered = [];

    criteriaOrder.forEach((critId, index) => {
      if (criteriaMap.has(critId)) {
        const crit = criteriaMap.get(critId);
        crit.position = index;
        reordered.push(crit);
        criteriaMap.delete(critId);
      }
    });

    criteriaMap.forEach((crit) => {
      crit.position = reordered.length;
      reordered.push(crit);
    });

    program.criteria = reordered;
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
  addCriterion,
  updateCriterion,
  deleteCriterion,
  reorderCriteria,
};
