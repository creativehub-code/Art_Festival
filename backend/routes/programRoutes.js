const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  getPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
  getPublicPrograms,
  getProgramParticipants,
  addTopic,
  updateTopic,
  deleteTopic,
} = require("../controllers/programController");

router.get("/", protect, getPrograms);
router.post("/", protect, restrictTo("admin"), createProgram);
router.put("/:id", protect, restrictTo("admin"), updateProgram);
router.patch("/:id", protect, restrictTo("admin"), updateProgram);
router.delete("/:id", protect, restrictTo("admin"), deleteProgram);
router.get("/public", getPublicPrograms);
router.get("/:programId/participants", protect, getProgramParticipants);

// Topic management
router.post("/:id/topics", protect, restrictTo("admin"), addTopic);
router.put("/:id/topics/:topicId", protect, restrictTo("admin"), updateTopic);
router.delete("/:id/topics/:topicId", protect, restrictTo("admin"), deleteTopic);

module.exports = router;
