const express = require("express");
const router = express.Router();
const { getPublicResults } = require("../controllers/markController");
const { getTeamLeaderboard } = require("../controllers/teamController");
const { getPublicPrograms } = require("../controllers/programController");
const { getStages } = require("../controllers/stageController");

// @desc    Get public results for a completed program
// @route   GET /api/public/results/:programId
// @access  Public
router.get("/results/:programId", getPublicResults);

// @desc    Get public team leaderboard
// @route   GET /api/public/teams/leaderboard
// @access  Public
router.get("/teams/leaderboard", getTeamLeaderboard);

// @desc    Get public programs list (completed only)
// @route   GET /api/public/programs
// @access  Public
router.get("/programs", getPublicPrograms);

// @desc    Get public stages list
// @route   GET /api/public/stages
// @access  Public
router.get("/stages", getStages);

module.exports = router;
