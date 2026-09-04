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
  addCriterion,
  updateCriterion,
  deleteCriterion,
  reorderCriteria,
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

// Criteria management
router.post("/:id/criteria", protect, restrictTo("admin"), addCriterion);
router.put("/:id/criteria/:criterionId", protect, restrictTo("admin"), updateCriterion);
router.delete("/:id/criteria/:criterionId", protect, restrictTo("admin"), deleteCriterion);
router.patch("/:id/criteria/reorder", protect, restrictTo("admin"), reorderCriteria);

module.exports = router;
