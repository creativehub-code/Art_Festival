const mongoose = require("mongoose");
const JudgeMark = require("../models/JudgeMark");
const JudgeGroup = require("../models/JudgeGroup");
const MarkAuditLog = require("../models/MarkAuditLog");
const Participant = require("../models/Participant");
const Team = require("../models/Team");
const Group = require("../models/Group");
const Program = require("../models/Program");
const Setting = require("../models/Setting");
const ProgramResult = require("../models/ProgramResult");
const ConversationPair = require("../models/ConversationPair");
const { updateGoogleSheet } = require("../utils/googleSheets");
const sendError = require("../utils/errorResponse");

// @desc    Submit or Updates marks (Judge)
// @route   POST /api/marks
// @access  Judge
const submitMark = async (req, res) => {
  try {
    const { programId, participantId, marksGiven } = req.body;

    // Security: Forced to use the authenticated judge's ID from req.user.
    // This prevents one judge from submitting marks as another.
    const judgeId = req.user.id;

    if (!programId || !participantId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const program = await Program.findById(programId).select("name language maxMarks");
    if (!program) {
      return res.status(404).json({ message: "Program not found" });
    }

    if (marksGiven === undefined || marksGiven === null) {
      return res.status(400).json({ message: "Marks must be provided." });
    }
    
    if (typeof marksGiven !== "number" && typeof marksGiven !== "string") {
      return res.status(400).json({ message: "Invalid marks format. Must be a number." });
    }
    
    if (typeof marksGiven === "string" && marksGiven.trim() === "") {
      return res.status(400).json({ message: "Marks cannot be empty." });
    }

    const marks = Number(marksGiven);
    if (isNaN(marks) || marks < 0 || marks > program.maxMarks) {
      return res.status(400).json({ 
        message: `Marks must be between 0 and ${program.maxMarks}` 
      });
    }

    const participant = await Participant.findById(participantId);
    if (!participant) {
      return res.status(404).json({ message: "Participant not found" });
    }
    if (!participant.programs.some(p => p.toString() === programId.toString())) {
      return res.status(400).json({ 
        message: "This participant is not registered for this program." 
      });
    }

    // ── SECURITY PATCH: IDOR / Broken Access Control Fix ─────────────────────────
    // Verify the requesting judge is actually assigned to this specific program
    // via a JudgeGroup. Without this check, any authenticated judge could submit
    // marks for programs they have no business scoring (IDOR vulnerability).
    const assignedGroup = await JudgeGroup.findOne({
      judges: judgeId,
      assignedPrograms: programId,
    });

    if (!assignedGroup) {
      return res.status(403).json({
        message: "Unauthorized: You are not assigned to judge this program.",
      });
    }
    // ─────────────────────────────────────────────────────────────────────────────

    // ── SECURITY PATCH: Strictly One Submission Per Judge Per Participant ──────
    // Use JudgeMark.create() which relies on the MongoDB unique compound index 
    // to atomically guarantee that no duplicate records can be created, even 
    // during concurrent race conditions. Second submissions are rejected entirely.
    let markEntry;
    try {
      markEntry = await JudgeMark.create({
        judgeId,
        programId,
        participantId,
        marksGiven: marks,
      });
    } catch (dbError) {
      if (dbError.code === 11000) {
        return res.status(409).json({
          message: "Conflict: You have already submitted marks for this participant.",
        });
      }
      throw dbError; // Re-throw other errors to the main catch block
    }
    // ─────────────────────────────────────────────────────────────────────────────

    // Populate for the SSE broadcast so the admin table can immediately render
    // judge name and participant details without a separate fetch.
    const populated = await JudgeMark.findById(markEntry._id)
      .populate({ path: "participantId", select: "name chestNumber teamId", populate: { path: "teamId", select: "name" } })
      .populate("judgeId", "name");

    // Program metadata for the admin toast notification was already fetched above.

    // Build the broadcast payload: the mark data + a _notification block for the toast.
    // The underscore prefix signals to the frontend that this field is UI-only metadata.
    const broadcastPayload = {
      ...populated.toObject(),
      _notification: {
        judgeName: populated.judgeId?.name || "A Judge",
        programName: program?.name || "a program",
        language: program?.language || "",
      },
    };

    // Broadcast to all admin SSE clients watching this program.

    // ── Conversation group: auto-mirror mark to ALL group members ──────────────
    // If this participant is the primary of a conversation group, upsert the
    // exact same mark for ALL other members so everyone's score stays in sync.
    const group = await ConversationPair.findOne({
      programId,
      primaryParticipantId: participantId,
    });
    
    if (group && group.participants && group.participants.length > 1) {
      const otherMemberIds = group.participants.filter(
        id => id.toString() !== participantId.toString()
      );
      
      const mirroringPromises = otherMemberIds.map(memberId => 
        JudgeMark.findOneAndUpdate(
          { judgeId, programId, participantId: memberId },
          { marksGiven: marks, status: "pending" },
          { upsert: true, new: true }
        )
      );
      
      await Promise.all(mirroringPromises);
    }

    res.json(markEntry);
  } catch (error) {
    sendError(res, 400, "Error submitting mark", error);
  }
};

// @desc    Get marks for a program (Admin/Judge)
// @route   GET /api/marks/:programId
const getMarksByProgram = async (req, res) => {
  try {
    const { programId } = req.params;

    // ── SECURITY PATCH: IDOR / Broken Access Control Fix ─────────────────────────
    if (req.user && req.user.role === "judge") {
      const assignedGroup = await JudgeGroup.findOne({
        judges: req.user.id,
        assignedPrograms: programId,
      });

      if (!assignedGroup) {
        return res.status(403).json({
          message: "Unauthorized: You are not assigned to view marks for this program.",
        });
      }
    }
    // ─────────────────────────────────────────────────────────────────────────────

    // 1. Get all submitted marks for this program
    const marks = await JudgeMark.find({ programId })
      .populate({
        path: "participantId",
        select: "name chestNumber teamId",
        populate: {
          path: "teamId",
          select: "name",
        },
      })
      .populate("judgeId", "name");

    // 2. Identify all assigned judges for this program (via JudgeGroups)
    const judgeGroups = await JudgeGroup.find({ assignedPrograms: programId }).populate("judges", "name");
    
    // Create a unique set of assigned judges
    const assignedJudgesMap = {}; // { id: name }
    judgeGroups.forEach(group => {
      if (group.judges && group.judges.length > 0) {
        group.judges.forEach(j => {
          assignedJudgesMap[j._id.toString()] = { 
            _id: j._id, 
            name: j.name || "Unknown Judge" 
          };
        });
      }
    });

    const assignedJudges = Object.values(assignedJudgesMap);

    res.json({
      marks,
      assignedJudges
    });
  } catch (error) {
    sendError(res, 500, "Failed to retrieve marks", error);
  }
};

// @desc    Calculate Scores and Update Totals (Admin Trigger)
// @route   POST /api/marks/calculate/:programId
const calculateScores = async (req, res) => {
  const { programId } = req.params;
  const session = await mongoose.startSession();

  try {
    let responseData = null;

    await session.withTransaction(async () => {
      // Fetch program to check if it's a conversation
      const program = await Program.findById(programId).session(session);
      if (!program) throw new Error("PROGRAM_NOT_FOUND");

      // 1. Get all APPROVED marks for this program
      const marks = await JudgeMark.find({ programId, status: "approved" }).session(session);

      if (marks.length === 0) {
        throw new Error("NO_MARKS_FOUND");
      }

      // 2. Clear old program results for this program if re-verifying
      await ProgramResult.deleteMany({ programId }, { session });

      // 3. Aggregate marks for each participant in THIS program
      const programScores = {};
      marks.forEach((mark) => {
        const pId = mark.participantId.toString();
        if (!programScores[pId]) programScores[pId] = 0;
        programScores[pId] += mark.marksGiven || 0;
      });

      // 4. Sort participants by total marks in descending order
      const sortedParticipants = Object.keys(programScores).sort(
        (a, b) => programScores[b] - programScores[a],
      );

      // 5. Fetch Points Settings
      let settings = await Setting.findOne().session(session);
      if (!settings) {
        settings = {
          firstPlacePoints: 5,
          secondPlacePoints: 3,
          thirdPlacePoints: 1,
        };
      }

      // 6. Assign Positions and Points (Handling exact ties)
      const positionAwards = [];
      let currentPosition = 1;
      let rankPoints = settings.firstPlacePoints;

      for (let i = 0; i < sortedParticipants.length; i++) {
        const pId = sortedParticipants[i];
        const currentScore = programScores[pId];

        // Change position only if score is less than the previous person
        if (i > 0) {
          const prevPId = sortedParticipants[i - 1];
          if (currentScore < programScores[prevPId]) {
            currentPosition++; // Dense rank (e.g., 1, 1, 2, 3)
          }
        }

        // Only top 3 true positions get points
        if (currentPosition === 1) rankPoints = settings.firstPlacePoints;
        else if (currentPosition === 2) rankPoints = settings.secondPlacePoints;
        else if (currentPosition === 3) rankPoints = settings.thirdPlacePoints;
        else rankPoints = 0;

        if (rankPoints > 0) {
          positionAwards.push({
            programId,
            participantId: pId,
            position: currentPosition,
            positionPoints: rankPoints,
          });
        }
      }

      // Enrich positionAwards with participantIds and teamId
      let pairs = [];
      if (program.isConversation) {
        pairs = await ConversationPair.find({ programId }).session(session);
      }
      const participantDocs = await Participant.find({ _id: { $in: sortedParticipants } }).session(session);
      
      const enrichedAwards = positionAwards.map(award => {
        let participantIds = [award.participantId];
        let teamId = null;
        
        if (program.isConversation) {
          const pair = pairs.find(p => p.primaryParticipantId.toString() === award.participantId.toString());
          if (pair) {
            participantIds = pair.participants.map(p => p.toString());
            teamId = pair.teamId;
          }
        } else {
          const part = participantDocs.find(p => p._id.toString() === award.participantId.toString());
          if (part) {
            teamId = part.teamId;
          }
        }
        
        return {
          ...award,
          participantIds,
          teamId,
          isConversation: program.isConversation
        };
      });

      // Save the new program results
      if (enrichedAwards.length > 0) {
        await ProgramResult.insertMany(enrichedAwards, { session });
      }

      // 7. Global Recalculation: Update totalScore for each affected participant
      // TotalScore = Sum of ALL Position Points (Judges marks are only for ranking)
      const primaryAffectedIds = marks.map((mark) => mark.participantId.toString());
      const affectedParticipantIds = new Set(primaryAffectedIds);
      
      if (program.isConversation) {
        const pairsForAffected = await ConversationPair.find({ programId, primaryParticipantId: { $in: primaryAffectedIds } }).session(session);
        pairsForAffected.forEach(pair => pair.participants.forEach(p => affectedParticipantIds.add(p.toString())));
      }
      
      const affectedTeamIds = new Set();

      for (const partId of affectedParticipantIds) {
        const allResults = await ProgramResult.find({ 
          $or: [{ participantId: partId }, { participantIds: partId }] 
        }).session(session);
        const totalPositionScore = allResults.reduce(
          (sum, r) => sum + (r.positionPoints || 0),
          0,
        );

        const finalScore = totalPositionScore;

        // Update Participant
        const updatedParticipant = await Participant.findByIdAndUpdate(
          partId,
          { totalScore: finalScore },
          { new: true, session },
        );

        if (updatedParticipant && updatedParticipant.teamId) {
          affectedTeamIds.add(updatedParticipant.teamId.toString());
        }
      }

      // 8. Global Recalculation: Update totalScore for each affected team
      for (const teamId of affectedTeamIds) {
        if (!teamId) continue;
        const teamResults = await ProgramResult.find({ teamId }).session(session);
        const teamTotalScore = teamResults.reduce(
          (sum, r) => sum + (r.positionPoints || 0),
          0,
        );

        await Team.findByIdAndUpdate(teamId, { totalScore: teamTotalScore }, { session });
      }

      // 9. Update program status to completed
      await Program.findByIdAndUpdate(programId, { status: "completed" }, { session });

      // 10. Populate the position awards for the frontend results panel
      const populatedResults = await ProgramResult.find({ programId })
        .populate({ path: "participantIds", select: "name chestNumber teamId", populate: { path: "teamId", select: "name" } })
        .sort({ position: 1 })
        .session(session);

      responseData = {
        message: "Scores & rankings recalculated successfully",
        participantsUpdated: affectedParticipantIds.size,
        teamsUpdated: affectedTeamIds.size,
        resultsAwarded: enrichedAwards.length,
        positionResults: populatedResults, // For the frontend results panel
      };
    });

    return res.json(responseData);

  } catch (error) {
    if (error.message === "NO_MARKS_FOUND") {
      return res.status(400).json({ message: "No marks found for this program to verify." });
    }
    sendError(res, 500, "Failed to calculate scores", error);
  } finally {
    await session.endSession();
  }
};

// @desc    Export Marks & Ranks to Google Sheets
// @route   POST /api/marks/export-sheets/:programId
const exportToGoogleSheets = async (req, res) => {
  try {
    const { programId } = req.params;

    // 1. Get Program Details
    const program = await Program.findById(programId).populate('groupId', 'name');
    if (!program) return res.status(404).json({ message: "Program not found" });

    // 2. Get all marks for this program
    const marks = await JudgeMark.find({ programId })
      .populate({
        path: "participantId",
        select: "name chestNumber teamId",
        populate: { path: "teamId", select: "name" },
      })
      .populate("judgeId", "name");

    if (marks.length === 0) {
      return res.status(400).json({ message: "No marks found to export." });
    }

    // 3. Identify all assigned judges for this program (via JudgeGroups)
    const judgeGroups = await JudgeGroup.find({ assignedPrograms: programId }).populate("judges", "name");
    
    // Create a unique set of assigned judges
    const assignedJudgesMap = {}; // { id: name }
    judgeGroups.forEach(group => {
      if (group.judges && group.judges.length > 0) {
        group.judges.forEach(j => {
          assignedJudgesMap[j._id.toString()] = j.name || "Unknown Judge";
        });
      }
    });

    const judgesList = Object.values(assignedJudgesMap); // All judge names for headers
    const judgeIdsList = Object.keys(assignedJudgesMap); // All judge IDs to map marks

    // 4. Aggregate marks for each participant
    const participantMap = {};
    
    marks.forEach((m) => {
      const pId = m.participantId?._id?.toString();
      const jId = m.judgeId?._id?.toString();

      if (!pId) return;

      if (!participantMap[pId]) {
        participantMap[pId] = {
          participant: m.participantId,
          totalScore: 0,
          judgeMarks: {}, // { "judgeId": mark }
        };
      }
      
      if (jId) {
        // Store mark by ID for precise matching
        participantMap[pId].judgeMarks[jId] = m.marksGiven || 0;
        participantMap[pId].totalScore += m.marksGiven || 0;
      }
    });

    // 5. Sort and Rank (Dense Ranking)
    const sortedParticipants = Object.values(participantMap).sort(
      (a, b) => b.totalScore - a.totalScore
    );

    let currentRank = 1;
    for (let i = 0; i < sortedParticipants.length; i++) {
        if (i > 0 && sortedParticipants[i].totalScore < sortedParticipants[i-1].totalScore) {
            currentRank++;
        }
        sortedParticipants[i].rank = currentRank;
    }

    // 6. Format Data for Google Sheets
    // Headers: [SI No, Name, Chest, Team, Judge1, Judge2..., Total, Rank]
    const headers = [
        "SI No", 
        "Participant Name", 
        "Chest No", 
        "Team", 
        ...judgesList, 
        "Total Marks", 
        "Rank"
    ];
    const sheetData = [headers];

    // Helper to prevent formula injection in Google Sheets
    const sanitizeForSheets = (val) => {
        if (typeof val === 'string' && /^[=+\-@]/.test(val)) {
            return "'" + val;
        }
        return val;
    };

    // Rows
    sortedParticipants.forEach((item, index) => {
        const row = [
            index + 1,
            sanitizeForSheets(item.participant?.name || "N/A"),
            sanitizeForSheets(item.participant?.chestNumber || "N/A"),
            sanitizeForSheets(item.participant?.teamId?.name || "N/A"),
        ];

        // Add each assigned judge's mark
        judgeIdsList.forEach(jId => {
            row.push(item.judgeMarks[jId] || 0);
        });

        row.push(item.totalScore);
        row.push(item.rank);
        
        sheetData.push(row);
    });

    // 7. Update Google Sheets
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) throw new Error("GOOGLE_SHEET_ID not configured in .env");

    const groupName = program.groupId ? program.groupId.name : 'General';
    const tabName = `${program.name} - ${groupName}`;
    await updateGoogleSheet(sheetId, tabName, sheetData);

    res.json({ message: `Successfully exported to Google Sheet tab: ${tabName}` });
  } catch (error) {
    sendError(res, 500, "Failed to export to Google Sheets", error);
  }
};

// @desc    Get public results for a completed program
// @route   GET /api/public/results/:programId
const getPublicResults = async (req, res) => {
  try {
    const { programId } = req.params;
    const program = await Program.findById(programId);

    if (!program || program.status !== "completed") {
      return res.status(403).json({ message: "Results for this program are not published yet." });
    }

    const results = await ProgramResult.find({ programId })
      .populate({
        path: "participantIds",
        select: "name chestNumber teamId",
        populate: {
          path: "teamId",
          select: "name",
        },
      })
      .select("position positionPoints participantIds isConversation")
      .sort({ position: 1 });

    res.json(results);
  } catch (error) {
    sendError(res, 500, "Failed to retrieve public results", error);
  }
};

// @desc    Open an SSE stream for live mark updates on a program (Admin)
// @route   GET /api/marks/stream/:programId
// @access  Admin
const streamMarks = (req, res) => {
  const { programId } = req.params;

  // --- SSE Headers ---
  // Content-Type must be text/event-stream.
  // Cache-Control: no-cache prevents proxies from buffering the stream.
  // X-Accel-Buffering: no disables Nginx proxy buffering (important for production).
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  // Send an initial comment to confirm the stream is open.
  // This also prevents some proxies from closing the connection immediately.
  res.write(": connected\n\n");

  // Register the client in the SSE manager.
  sseManager.addClient(programId, res);

  // --- Memory Leak Prevention (CRITICAL) ---
  // When the client disconnects (navigates away, closes tab, component unmounts),
  // Express fires the 'close' event on req. We must clean up immediately.
  req.on("close", () => {
    sseManager.removeClient(programId, res);
  });
};

// @desc    Get all marks and results for admin export
// @route   GET /api/marks/export-data
// @access  Admin
const getAllExportData = async (req, res) => {
  try {
    // 1. Get all submitted marks across all programs
    const allMarks = await JudgeMark.find()
      .populate({
        path: "participantId",
        select: "name chestNumber teamId",
        populate: {
          path: "teamId",
          select: "name",
        },
      })
      .populate("judgeId", "name")
      .lean(); // Use lean() for performance since we don't need Mongoose documents

    // 2. Get all public results across all completed programs
    const allResults = await ProgramResult.find()
      .populate({
        path: "participantId",
        select: "name chestNumber teamId",
        populate: {
          path: "teamId",
          select: "name",
        },
      })
      .select("position positionPoints participantId programId")
      .sort({ position: 1 })
      .lean();

    res.json({
      allMarks,
      allResults
    });
  } catch (error) {
    sendError(res, 500, "Failed to retrieve export data", error);
  }
};

// @desc    Update Mark Status (Approve/Reject)
// @route   PATCH /api/marks/:id/status
// @access  Admin
const updateMarkStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    const mark = await JudgeMark.findById(id);
    if (!mark) {
      return res.status(404).json({ message: "Mark not found." });
    }

    mark.status = status;
    if (status === "approved") {
      mark.submitted = true;
    }
    await mark.save();

    res.json({ message: `Mark ${status} successfully.`, mark });
  } catch (error) {
    sendError(res, 500, "Error updating mark status", error);
  }
};

// @desc    Edit Approved Mark
// @route   PATCH /api/marks/:id
// @access  Admin
const editApprovedMark = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    let updatedMark;
    await session.withTransaction(async () => {
      const { id } = req.params;
      const { newMark, reason } = req.body;
      const adminId = req.user.id;

      if (typeof newMark !== "number" || newMark < 0) {
        throw new Error("Invalid mark value.");
      }

      const mark = await JudgeMark.findById(id).session(session);
      if (!mark) {
        throw new Error("Mark not found.");
      }

      if (mark.status !== "approved") {
        throw new Error("Only approved marks can be edited.");
      }

      const oldMarkValue = mark.marksGiven;

      // 1. Create audit log
      await MarkAuditLog.create(
        [
          {
            markId: mark._id,
            judgeId: mark.judgeId,
            programId: mark.programId,
            participantId: mark.participantId,
            oldMark: oldMarkValue,
            newMark,
            changedByAdminId: adminId,
            reason: reason || "No reason provided",
          },
        ],
        { session }
      );

      // 2. Update mark
      mark.marksGiven = newMark;
      updatedMark = await mark.save({ session });
    });
    res.json({ message: "Mark updated successfully", mark: updatedMark });
  } catch (error) {
    if (["Invalid mark value.", "Mark not found.", "Only approved marks can be edited."].includes(error.message)) {
       return res.status(400).json({ message: error.message });
    }
    sendError(res, 500, "Error editing mark", error);
  } finally {
    await session.endSession();
  }
};

module.exports = {
  submitMark,
  getMarksByProgram,
  calculateScores,
  exportToGoogleSheets,
  getPublicResults,
  streamMarks,
  getAllExportData,
  updateMarkStatus,
  editApprovedMark,
};

