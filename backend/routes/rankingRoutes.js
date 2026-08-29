const express = require("express");
const router = express.Router();
const { getIndividualRankings, getParticipantResults } = require("../controllers/rankingController");
const { protect, restrictTo } = require("../middleware/authMiddleware");

// Routes
router.get("/individual", protect,restrictTo("admin"),getIndividualRankings);
router.get("/individual/:participantId/results", protect,restrictTo("admin"), getParticipantResults);

module.exports = router;
