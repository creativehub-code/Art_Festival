const mongoose = require("mongoose");
const Participant = require("../models/Participant");
const Team = require("../models/Team");
const Group = require("../models/Group");
const ConversationPair = require("../models/ConversationPair");
const sendError = require("../utils/errorResponse");

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// @desc    Search for eligible co-participants for a conversation program
// @route   GET /api/participants/search-eligible?q=<name|chestNo>&primaryId=<id>
// @access  Admin
const searchEligible = async (req, res) => {
  try {
    let { q, primaryId } = req.query;

    if (!primaryId) {
      return res.status(400).json({ message: "primaryId is required" });
    }
    // Sanitise: force string to prevent NoSQL injection
    primaryId = String(primaryId);
    q = q ? String(q).trim() : "";

    // Fetch the primary participant to extract team + group constraints
    const primary = await Participant.findById(primaryId).select("teamId groupId");
    if (!primary) {
      return res.status(404).json({ message: "Primary participant not found" });
    }
    if (!primary.teamId || !primary.groupId) {
      return res.status(400).json({
        message: "Primary participant must have a Team and Group assigned before searching for a partner",
      });
    }

    // Build an OR query on name or chestNumber — case-insensitive
    const safeQuery = escapeRegex(q);
    const searchFilter = q
      ? {
          $or: [
            { name: { $regex: safeQuery, $options: "i" } },
            { chestNumber: { $regex: safeQuery, $options: "i" } },
          ],
        }
      : {};

    const eligible = await Participant.find({
      ...searchFilter,
      teamId: primary.teamId,   // MUST be same team
      groupId: primary.groupId, // MUST be same group
      _id: { $ne: primaryId },  // Exclude the primary themselves
    })
      .select("-image")
      .populate("teamId", "name")
      .populate("groupId", "name")
      .limit(20);

    res.json(eligible);
  } catch (error) {
    sendError(res, 500, "Failed to search eligible participants", error);
  }
};

// @desc    Get all participants (Lightweight - No Image)
// @route   GET /api/participants
// @access  Public (Read-only), Admin/Judge (Read-only)
const getParticipants = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const skip = (page - 1) * limit;

    const [participants, total] = await Promise.all([
      Participant.find()
        .select("-image")
        .populate("teamId", "name")
        .populate("groupId", "name")
        .populate("programs", "name language")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Participant.countDocuments()
    ]);
    res.json({ data: participants, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    sendError(res, 500, "Failed to retrieve participants", error);
  }
};

// @desc    Get participants filtered by their program language (for judges)
// @route   GET /api/participants/by-language?language=Malayalam
// @access  Judge / Admin
const getParticipantsByLanguage = async (req, res) => {
  try {
    let { language } = req.query;
    if (!language) {
      return res.status(400).json({ message: "language query param required" });
    }
    
    // Security: Forced to be a string to prevent NoSQL injection (e.g., passing $ne: null)
    language = String(language);

    // Find all programs with that language first
    const Program = require("../models/Program");
    const programs = await Program.find({ language }).select("_id");
    const programIds = programs.map((p) => p._id);

    const participants = await Participant.find({ programs: { $in: programIds } })
      .select("-image")
      .populate("teamId", "name")
      .populate("groupId", "name")
      .populate("programs", "name language")
      .sort({ createdAt: 1 });

    res.json(participants);
  } catch (error) {
    sendError(res, 500, "Failed to retrieve participants by language", error);
  }
};

// @desc    Get single participant (No Image)
// @route   GET /api/participants/:id
// @access  Public/Admin
const getParticipantById = async (req, res) => {
  try {
    const participant = await Participant.findById(req.params.id)
      .select("-image") // Exclude image, use /photo endpoint
      .populate("teamId", "name")
      .populate("groupId", "name")
      .populate("programs", "name language");

    if (!participant) {
      return res.status(404).json({ message: "Participant not found" });
    }
    res.json(participant);
  } catch (error) {
    sendError(res, 500, "Failed to retrieve participant", error);
  }
};

// @desc    Get participant photo
// @route   GET /api/participants/:id/photo
// @access  Public
const getParticipantPhoto = async (req, res) => {
  try {
    const participant = await Participant.findById(req.params.id).select(
      "image",
    );

    if (!participant || !participant.image) {
      return res.status(404).send("Photo not found");
    }

    const matches = participant.image.match(
      /^data:([A-Za-z-+\/]+);base64,(.+)$/,
    );
    if (!matches || matches.length !== 3) {
      return res.status(400).send("Invalid image data");
    }

    const type = matches[1];
    const buffer = Buffer.from(matches[2], "base64");

    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": buffer.length,
    });
    res.end(buffer);
  } catch (error) {
    sendError(res, 500, "Failed to retrieve participant photo", error);
  }
};

// @desc    Create a participant
// @route   POST /api/participants
// @access  Admin
const createParticipant = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { name, chestNumber, teamId, groupId, programs, programTopics } = req.body;

    let validProgramTopics = [];
    if (programTopics && Array.isArray(programTopics) && programTopics.length > 0) {
      const Program = require("../models/Program");
      const programIds = programTopics.map(pt => pt.programId);
      const programsData = await Program.find({ _id: { $in: programIds } });
      const programsMap = Object.fromEntries(programsData.map(p => [p._id.toString(), p]));

      const uniquePrograms = new Set();
      for (const pt of programTopics) {
        if (!pt.programId || !pt.topicId) continue;
        const pidStr = pt.programId.toString();
        const tidStr = pt.topicId.toString();

        if (uniquePrograms.has(pidStr)) {
          return res.status(400).json({ message: "A participant can only have one topic per program" });
        }
        uniquePrograms.add(pidStr);

        const program = programsMap[pidStr];
        if (!program) return res.status(400).json({ message: `Program ${pidStr} not found` });

        const topicExists = program.topics.some(t => t._id.toString() === tidStr);
        if (!topicExists) return res.status(400).json({ message: "Topic does not belong to the selected program" });

        // Synchronize: Ensure program is in the participants `programs` array
        const pArray = programs || [];
        if (!pArray.some(p => p.toString() === pidStr)) {
          return res.status(400).json({ message: "Cannot assign topic for a program the participant is not registered for" });
        }

        validProgramTopics.push({ programId: pt.programId, topicId: pt.topicId });
      }
    }

    const participantExists = await Participant.findOne({ chestNumber });
    if (participantExists) {
      return res
        .status(400)
        .json({ message: "Participant with this chest number already exists" });
    }

    let participant;

    await session.withTransaction(async () => {
      const newParticipant = new Participant({
        name,
        chestNumber,
        teamId,
        groupId,
        programs: programs || [],
        programTopics: validProgramTopics,
        image: req.body.image || "",
      });
      
      participant = await newParticipant.save({ session });
    });

    res.status(201).json(participant);
  } catch (error) {
    sendError(res, 400, "Failed to create participant", error);
  } finally {
    await session.endSession();
  }
};

// @desc    Update participant
// @route   PUT /api/participants/:id
// @access  Admin
const updateParticipant = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const participant = await Participant.findById(req.params.id);

    if (!participant) {
      return res.status(404).json({ message: "Participant not found" });
    }

    // Security: Whitelist fields to prevent mass assignment
    const { name, chestNumber, teamId, groupId, programs, programTopics, image } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (chestNumber !== undefined) updateData.chestNumber = chestNumber;
    if (teamId !== undefined) updateData.teamId = teamId;
    if (groupId !== undefined) updateData.groupId = groupId;
    if (programs !== undefined) updateData.programs = programs;
    if (image !== undefined) updateData.image = image;

    // Handle programTopics logic
    // If programs is updated, we must ensure programTopics stays synchronized.
    let finalPrograms = programs !== undefined ? programs : participant.programs.map(p => p.toString());
    let incomingProgramTopics = programTopics !== undefined ? programTopics : participant.programTopics || [];
    
    let validProgramTopics = [];
    if (incomingProgramTopics && Array.isArray(incomingProgramTopics) && incomingProgramTopics.length > 0) {
      const Program = require("../models/Program");
      const programIds = incomingProgramTopics.map(pt => pt.programId);
      const programsData = await Program.find({ _id: { $in: programIds } });
      const programsMap = Object.fromEntries(programsData.map(p => [p._id.toString(), p]));

      const uniquePrograms = new Set();
      for (const pt of incomingProgramTopics) {
        if (!pt.programId || !pt.topicId) continue;
        const pidStr = pt.programId.toString();
        const tidStr = pt.topicId.toString();

        if (uniquePrograms.has(pidStr)) {
          return res.status(400).json({ message: "A participant can only have one topic per program" });
        }
        
        // Sync check: ONLY keep this topic mapping if the participant is actually registered in this program
        if (!finalPrograms.some(p => p.toString() === pidStr)) {
          continue; // Strip it out
        }

        uniquePrograms.add(pidStr);

        const program = programsMap[pidStr];
        if (!program) return res.status(400).json({ message: `Program ${pidStr} not found` });

        const topicExists = program.topics.some(t => t._id.toString() === tidStr);
        if (!topicExists) return res.status(400).json({ message: "Topic does not belong to the selected program" });

        validProgramTopics.push({ programId: pt.programId, topicId: pt.topicId });
      }
    }
    // Always update programTopics to ensure synchronization
    updateData.programTopics = validProgramTopics;

    const oldTeamId = participant.teamId?.toString();
    const newTeamId = updateData.teamId;
    const teamChanged = updateData.teamId !== undefined && String(newTeamId) !== String(oldTeamId);

    const oldGroupId = participant.groupId?.toString();
    const newGroupId = updateData.groupId;
    const groupChanged = updateData.groupId !== undefined && String(newGroupId) !== String(oldGroupId);

    let updatedParticipant;

    await session.withTransaction(async () => {
      // 1. Group Program Topic Synchronization
      if (validProgramTopics.length > 0) {
        for (const pt of validProgramTopics) {
          const programIdStr = pt.programId.toString();
          const newTopicIdStr = pt.topicId.toString();
          
          // Find if this participant is part of a ConversationPair for this program
          const conversationPair = await ConversationPair.findOne({
            programId: pt.programId,
            participants: participant._id
          }).session(session);

          if (conversationPair) {
            // Is it a change?
            const currentPairTopicIdStr = conversationPair.topicId ? conversationPair.topicId.toString() : null;
            if (currentPairTopicIdStr !== newTopicIdStr) {
              // A. Update ConversationPair
              conversationPair.topicId = pt.topicId;
              await conversationPair.save({ session });

              // B. Update programTopics for all OTHER members
              const otherMembers = conversationPair.participants.filter(
                id => id.toString() !== participant._id.toString()
              );

              if (otherMembers.length > 0) {
                // We use updateMany with aggregation pipeline for complex array updates, 
                // OR we can just find them and update them in memory. In memory is safer to ensure we don't duplicate/corrupt.
                const otherParticipants = await Participant.find({ _id: { $in: otherMembers } }).session(session);
                
                for (const otherP of otherParticipants) {
                  let pTopics = [...(otherP.programTopics || [])];
                  
                  // Remove old mapping for this program
                  const existingIdx = pTopics.findIndex(t => t.programId && t.programId.toString() === programIdStr);
                  if (existingIdx !== -1) {
                    pTopics.splice(existingIdx, 1);
                  }
                  
                  // Add new mapping
                  pTopics.push({ programId: pt.programId, topicId: pt.topicId });
                  
                  // Save
                  otherP.programTopics = pTopics;
                  await otherP.save({ session });
                }
              }
            }
          }
        }
      }

      // 2. Finally update the current participant
      updatedParticipant = await Participant.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true, session },
      );

      if (!updatedParticipant) {
        throw new Error("PARTICIPANT_NOT_FOUND");
      }
    });

    res.json(updatedParticipant);
  } catch (error) {
    if (error.message === "PARTICIPANT_NOT_FOUND") {
      return res.status(404).json({ message: "Participant not found" });
    }
    sendError(res, 400, "Failed to update participant", error);
  } finally {
    await session.endSession();
  }
};

// @desc    Delete participant
// @route   DELETE /api/participants/:id
// @access  Admin
const deleteParticipant = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;

    await session.withTransaction(async () => {
      const participant = await Participant.findByIdAndDelete(id, { session });

      if (!participant) {
        throw new Error("PARTICIPANT_NOT_FOUND");
      }
    });

    res.json({ message: "Participant removed" });
  } catch (error) {
    if (error.message === "PARTICIPANT_NOT_FOUND") {
      return res.status(404).json({ message: "Participant not found" });
    }
    sendError(res, 500, "Failed to delete participant", error);
  } finally {
    await session.endSession();
  }
};

module.exports = {
  getParticipants,
  getParticipantsByLanguage,
  getParticipantById,
  getParticipantPhoto,
  createParticipant,
  updateParticipant,
  deleteParticipant,
  searchEligible,
};

