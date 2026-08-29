const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamParticipants,
} = require("../controllers/teamController");

router.route("/").get(protect, getTeams).post(protect, restrictTo("admin"), createTeam);

router.route("/:id").get(protect, getTeamById).put(protect, restrictTo("admin"), updateTeam).delete(protect, restrictTo("admin"), deleteTeam);

router.route("/:id/participants").get(protect,restrictTo('admin'), getTeamParticipants);

module.exports = router;
