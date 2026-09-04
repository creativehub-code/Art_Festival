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
// @route   GET /api/participants/search-eligible?q=<name|chestNo>&primaryId=<id>&teamId=<id>&groupId=<id>&programId=<id>
// @access  Admin
const searchEligible = async (req, res) => {
  try {
    let { q, primaryId, teamId, groupId, excludeId, programId } = req.query;

    let targetTeamId = teamId;
    let targetGroupId = groupId;
    let excludeIds = [];

    if (primaryId) {
      primaryId = String(primaryId);
      excludeIds.push(primaryId);
      const primary = await Participant.findById(primaryId).select("teamId groupId");
      if (!primary) {
        return res.status(404).json({ message: "Primary participant not found" });
      }
      if (!primary.teamId || !primary.groupId) {
        return res.status(400).json({
          message: "Primary participant must have a Team and Group assigned before searching for a partner",
        });
      }
      targetTeamId = primary.teamId.toString();
      targetGroupId = primary.groupId.toString();
    }

    if (excludeId) {
      excludeIds.push(String(excludeId));
    }

    if (!targetTeamId || !targetGroupId) {
      return res.status(400).json({
        message: "teamId and groupId (or primaryId) are required to search for eligible partners",
      });
    }

    q = q ? String(q).trim() : "";
    const safeQuery = escapeRegex(q);
    const searchFilter = q
      ? {
          $or: [
            { name: { $regex: safeQuery, $options: "i" } },
            { chestNumber: { $regex: safeQuery, $options: "i" } },
          ],
        }
      : {};

    // Exclude participants already paired in this program (if programId provided)
    if (programId) {
      const pairs = await ConversationPair.find({ programId }).select("participants");
      for (const pair of pairs) {
        for (const pId of pair.participants) {
          if (!primaryId || pId.toString() !== primaryId) {
            excludeIds.push(pId.toString());
          }
        }
      }
    }

    const eligible = await Participant.find({
      ...searchFilter,
      teamId: targetTeamId,   // MUST be same team
      groupId: targetGroupId, // MUST be same group
      _id: { $nin: excludeIds }, // Exclude self & already paired participants
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
      .populate("programs", "name language topics")
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
      .populate("programs", "name language isConversation");

    if (!participant) {
      return res.status(404).json({ message: "Participant not found" });
    }

    const conversationPairs = await ConversationPair.find({ participants: participant._id })
      .populate("participants", "name chestNumber teamId groupId")
      .populate("programId", "name language isConversation");

    res.json({
      ...participant.toObject(),
      conversationPairs,
    });
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
    const { name, chestNumber, teamId, groupId, programs, programTopics, groupPartners } = req.body;

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

    // Validate Group Programs and Partner Requirements
    const Program = require("../models/Program");
    const pArray = programs || [];
    const programDocs = await Program.find({ _id: { $in: pArray } });
    const groupPrograms = programDocs.filter(p => p.isConversation === true);

    const partnerMap = new Map();
    if (Array.isArray(groupPartners)) {
      groupPartners.forEach(gp => {
        if (gp.programId && gp.partnerId) partnerMap.set(gp.programId.toString(), gp.partnerId.toString());
      });
    } else if (groupPartners && typeof groupPartners === 'object') {
      Object.entries(groupPartners).forEach(([pid, partnerId]) => {
        if (partnerId) partnerMap.set(pid.toString(), partnerId.toString());
      });
    }

    for (const gp of groupPrograms) {
      const gpIdStr = gp._id.toString();
      const partnerId = partnerMap.get(gpIdStr);
      if (!partnerId) {
        return res.status(400).json({ message: `Group program '${gp.name}' requires a partner participant.` });
      }

      const partner = await Participant.findById(partnerId);
      if (!partner) {
        return res.status(400).json({ message: `Partner for group program '${gp.name}' not found.` });
      }

      if (partner.teamId?.toString() !== teamId?.toString()) {
        return res.status(400).json({ message: `Partner for '${gp.name}' must belong to the same Team.` });
      }

      if (partner.groupId?.toString() !== groupId?.toString()) {
        return res.status(400).json({ message: `Partner for '${gp.name}' must belong to the same Group.` });
      }

      // Check if partner is already registered in a ConversationPair for this program
      const existingPair = await ConversationPair.findOne({
        programId: gp._id,
        participants: partner._id,
      });
      if (existingPair) {
        return res.status(400).json({ message: `Partner ${partner.name} is already paired in another group for program '${gp.name}'.` });
      }
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

      // Handle ConversationPair creation for Group Programs
      for (const gp of groupPrograms) {
        const gpIdStr = gp._id.toString();
        const partnerId = partnerMap.get(gpIdStr);

        const topicObj = validProgramTopics.find(pt => pt.programId.toString() === gpIdStr);
        const topicId = topicObj ? topicObj.topicId : null;

        await ConversationPair.create([{
          programId: gp._id,
          participants: [participant._id, partnerId],
          primaryParticipantId: participant._id,
          teamId,
          groupId,
          topicId,
        }], { session });

        await Participant.findByIdAndUpdate(
          partnerId,
          { $addToSet: { programs: gp._id } },
          { session }
        );

        if (topicId) {
          const partnerDoc = await Participant.findById(partnerId).session(session);
          if (partnerDoc) {
            let pTopics = [...(partnerDoc.programTopics || [])];
            const existingIdx = pTopics.findIndex(t => t.programId && t.programId.toString() === gpIdStr);
            if (existingIdx !== -1) {
              pTopics.splice(existingIdx, 1);
            }
            pTopics.push({ programId: gp._id, topicId });
            partnerDoc.programTopics = pTopics;
            await partnerDoc.save({ session });
          }
        }
      }
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
    const { name, chestNumber, teamId, groupId, programs, programTopics, image, groupPartners } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (chestNumber !== undefined) updateData.chestNumber = chestNumber;
    if (teamId !== undefined) updateData.teamId = teamId;
    if (groupId !== undefined) updateData.groupId = groupId;
    if (programs !== undefined) updateData.programs = programs;
    if (image !== undefined) updateData.image = image;

    // Handle programTopics logic
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
        
        if (!finalPrograms.some(p => p.toString() === pidStr)) {
          continue;
        }

        uniquePrograms.add(pidStr);

        const program = programsMap[pidStr];
        if (!program) return res.status(400).json({ message: `Program ${pidStr} not found` });

        const topicExists = program.topics.some(t => t._id.toString() === tidStr);
        if (!topicExists) return res.status(400).json({ message: "Topic does not belong to the selected program" });

        validProgramTopics.push({ programId: pt.programId, topicId: pt.topicId });
      }
    }
    updateData.programTopics = validProgramTopics;

    const finalTeamId = updateData.teamId !== undefined ? updateData.teamId : participant.teamId?.toString();
    const finalGroupId = updateData.groupId !== undefined ? updateData.groupId : participant.groupId?.toString();

    // Group Program & Partner Requirement Handling
    const Program = require("../models/Program");
    const programDocs = await Program.find({ _id: { $in: finalPrograms } });
    const groupPrograms = programDocs.filter(p => p.isConversation === true);

    const partnerMap = new Map();
    if (Array.isArray(groupPartners)) {
      groupPartners.forEach(gp => {
        if (gp.programId && gp.partnerId) partnerMap.set(gp.programId.toString(), gp.partnerId.toString());
      });
    } else if (groupPartners && typeof groupPartners === 'object') {
      Object.entries(groupPartners).forEach(([pid, partnerId]) => {
        if (partnerId) partnerMap.set(pid.toString(), partnerId.toString());
      });
    }

    const existingPairs = await ConversationPair.find({ participants: participant._id });
    const existingPairByProg = new Map(existingPairs.map(cp => [cp.programId.toString(), cp]));

    const validatedPairsToProcess = [];
    for (const gp of groupPrograms) {
      const gpIdStr = gp._id.toString();
      const existingPair = existingPairByProg.get(gpIdStr);
      const incomingPartnerId = partnerMap.get(gpIdStr);

      if (existingPair) {
        const currentPartnerId = existingPair.participants.find(p => p.toString() !== participant._id.toString())?.toString();
        if (!incomingPartnerId || incomingPartnerId === currentPartnerId) {
          validatedPairsToProcess.push({ gp, partnerId: currentPartnerId, existingPair, isNew: false });
          continue;
        }

        // Partner changed
        const partner = await Participant.findById(incomingPartnerId);
        if (!partner) {
          return res.status(400).json({ message: `Partner for group program '${gp.name}' not found.` });
        }
        if (partner._id.toString() === participant._id.toString()) {
          return res.status(400).json({ message: `Cannot select participant as their own partner.` });
        }
        if (partner.teamId?.toString() !== finalTeamId?.toString()) {
          return res.status(400).json({ message: `Partner for '${gp.name}' must belong to the same Team.` });
        }
        if (partner.groupId?.toString() !== finalGroupId?.toString()) {
          return res.status(400).json({ message: `Partner for '${gp.name}' must belong to the same Group.` });
        }
        const otherPair = await ConversationPair.findOne({
          programId: gp._id,
          participants: partner._id,
          _id: { $ne: existingPair._id }
        });
        if (otherPair) {
          return res.status(400).json({ message: `Partner ${partner.name} is already paired in another group for program '${gp.name}'.` });
        }
        validatedPairsToProcess.push({ gp, partnerId: incomingPartnerId, existingPair, isNew: false, partnerChanged: true, oldPartnerId: currentPartnerId });
      } else {
        // Newly added Group Program
        if (!incomingPartnerId) {
          return res.status(400).json({ message: `Group program '${gp.name}' requires a partner participant.` });
        }
        const partner = await Participant.findById(incomingPartnerId);
        if (!partner) {
          return res.status(400).json({ message: `Partner for group program '${gp.name}' not found.` });
        }
        if (partner._id.toString() === participant._id.toString()) {
          return res.status(400).json({ message: `Cannot select participant as their own partner.` });
        }
        if (partner.teamId?.toString() !== finalTeamId?.toString()) {
          return res.status(400).json({ message: `Partner for '${gp.name}' must belong to the same Team.` });
        }
        if (partner.groupId?.toString() !== finalGroupId?.toString()) {
          return res.status(400).json({ message: `Partner for '${gp.name}' must belong to the same Group.` });
        }
        const otherPair = await ConversationPair.findOne({
          programId: gp._id,
          participants: partner._id
        });
        if (otherPair) {
          return res.status(400).json({ message: `Partner ${partner.name} is already paired in another group for program '${gp.name}'.` });
        }
        validatedPairsToProcess.push({ gp, partnerId: incomingPartnerId, isNew: true });
      }
    }

    const finalProgramSet = new Set(finalPrograms.map(p => p.toString()));
    const removedPairs = existingPairs.filter(cp => !finalProgramSet.has(cp.programId.toString()));

    let updatedParticipant;

    await session.withTransaction(async () => {
      // Process Group Program Pairs
      for (const item of validatedPairsToProcess) {
        const { gp, partnerId, existingPair, isNew, partnerChanged } = item;
        const gpIdStr = gp._id.toString();
        const topicObj = validProgramTopics.find(pt => pt.programId.toString() === gpIdStr);
        const topicId = topicObj ? topicObj.topicId : null;

        if (isNew) {
          await ConversationPair.create([{
            programId: gp._id,
            participants: [participant._id, partnerId],
            primaryParticipantId: participant._id,
            teamId: finalTeamId,
            groupId: finalGroupId,
            topicId,
          }], { session });

          await Participant.findByIdAndUpdate(
            partnerId,
            { $addToSet: { programs: gp._id } },
            { session }
          );
        } else if (partnerChanged) {
          existingPair.participants = [participant._id, partnerId];
          if (topicId !== undefined) existingPair.topicId = topicId;
          await existingPair.save({ session });

          await Participant.findByIdAndUpdate(
            partnerId,
            { $addToSet: { programs: gp._id } },
            { session }
          );
        } else {
          if (topicId !== undefined && existingPair.topicId?.toString() !== topicId?.toString()) {
            existingPair.topicId = topicId;
            await existingPair.save({ session });
          }
        }
      }

      // Process removed Group Programs
      for (const cp of removedPairs) {
        await ConversationPair.findByIdAndDelete(cp._id).session(session);
      }

      // Group Program Topic Synchronization for any remaining topic changes
      if (validProgramTopics.length > 0) {
        for (const pt of validProgramTopics) {
          const programIdStr = pt.programId.toString();
          const newTopicIdStr = pt.topicId.toString();
          
          const conversationPair = await ConversationPair.findOne({
            programId: pt.programId,
            participants: participant._id
          }).session(session);

          if (conversationPair) {
            const currentPairTopicIdStr = conversationPair.topicId ? conversationPair.topicId.toString() : null;
            if (currentPairTopicIdStr !== newTopicIdStr) {
              conversationPair.topicId = pt.topicId;
              await conversationPair.save({ session });

              const otherMembers = conversationPair.participants.filter(
                id => id.toString() !== participant._id.toString()
              );

              if (otherMembers.length > 0) {
                const otherParticipants = await Participant.find({ _id: { $in: otherMembers } }).session(session);
                
                for (const otherP of otherParticipants) {
                  let pTopics = [...(otherP.programTopics || [])];
                  const existingIdx = pTopics.findIndex(t => t.programId && t.programId.toString() === programIdStr);
                  if (existingIdx !== -1) {
                    pTopics.splice(existingIdx, 1);
                  }
                  pTopics.push({ programId: pt.programId, topicId: pt.topicId });
                  otherP.programTopics = pTopics;
                  await otherP.save({ session });
                }
              }
            }
          }
        }
      }

      // Finally update the current participant
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

