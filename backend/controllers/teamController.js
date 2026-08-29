const mongoose = require("mongoose");
const Team = require("../models/Team");
const Participant = require("../models/Participant");
const sendError = require("../utils/errorResponse");

const getTeams = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const skip = (page - 1) * limit;

    const [teams, total] = await Promise.all([
      Team.find().sort({ totalScore: -1 }).skip(skip).limit(limit).lean(),
      Team.countDocuments()
    ]);

    // Aggregate member counts
    const teamsWithCounts = await Promise.all(
      teams.map(async (team) => {
        const memberCount = await Participant.countDocuments({ teamId: team._id });
        return { ...team, memberCount };
      })
    );

    res.json({ data: teamsWithCounts, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    sendError(res, 500, "Failed to retrieve teams", error);
  }
};

const getTeamById = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id).lean();
    if (!team) return res.status(404).json({ message: "Team not found" });
    const memberCount = await Participant.countDocuments({ teamId: team._id });
    res.json({ ...team, memberCount });
  } catch (error) {
    sendError(res, 500, "Failed to retrieve team", error);
  }
};

const createTeam = async (req, res) => {
  try {
    const { name } = req.body;
    const team = await Team.create({ name });
    res.status(201).json(team);
  } catch (error) {
    sendError(res, 400, "Failed to create team", error);
  }
};

const updateTeam = async (req, res) => {
  try {
    const { name } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name;

    const team = await Team.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!team) return res.status(404).json({ message: "Team not found" });
    res.json(team);
  } catch (error) {
    sendError(res, 400, "Failed to update team", error);
  }
};

const deleteTeam = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { id } = req.params;
    
    await session.withTransaction(async () => {
      const team = await Team.findByIdAndDelete(id, { session });
      if (!team) {
        throw new Error("TEAM_NOT_FOUND");
      }

      const Participant = require("../models/Participant");
      // Remove team reference from Participants
      await Participant.updateMany(
        { teamId: id },
        { $unset: { teamId: 1 } },
        { session }
      );
    });

    res.json({ message: "Team deleted successfully" });
  } catch (error) {
    if (error.message === "TEAM_NOT_FOUND") {
      return res.status(404).json({ message: "Team not found" });
    }
    sendError(res, 500, "Failed to delete team", error);
  } finally {
    await session.endSession();
  }
};

const getTeamLeaderboard = async (req, res) => {
  try {
    const teams = await Team.find()
      .select("name totalScore")
      .sort({ totalScore: -1 });
    res.json(teams);
  } catch (error) {
    sendError(res, 500, "Failed to retrieve team leaderboard", error);
  }
};

const getTeamParticipants = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [participants, total] = await Promise.all([
      Participant.find({ teamId: id })
        .select("-image")
        .populate("groupId", "name")
        .populate("programs", "name language")
        .skip(skip)
        .limit(limit)
        .lean(),
      Participant.countDocuments({ teamId: id }),
    ]);

    res.json({
      participants,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    sendError(res, 500, "Failed to retrieve team participants", error);
  }
};

module.exports = {
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamLeaderboard,
  getTeamParticipants,
};

