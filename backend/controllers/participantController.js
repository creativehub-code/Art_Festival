const mongoose = require("mongoose");
const Participant = require("../models/Participant");
const Team = require("../models/Team");
const Group = require("../models/Group");
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
    const { name, chestNumber, teamId, groupId, programs } = req.body;

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
    const { name, chestNumber, teamId, groupId, programs, image } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (chestNumber !== undefined) updateData.chestNumber = chestNumber;
    if (teamId !== undefined) updateData.teamId = teamId;
    if (groupId !== undefined) updateData.groupId = groupId;
    if (programs !== undefined) updateData.programs = programs;
    if (image !== undefined) updateData.image = image;

    const oldTeamId = participant.teamId?.toString();
    const newTeamId = updateData.teamId;
    const teamChanged = updateData.teamId !== undefined && String(newTeamId) !== String(oldTeamId);

    const oldGroupId = participant.groupId?.toString();
    const newGroupId = updateData.groupId;
    const groupChanged = updateData.groupId !== undefined && String(newGroupId) !== String(oldGroupId);

    let updatedParticipant;

    await session.withTransaction(async () => {
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

