const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  getStages,
  createStage,
  updateStage,
  deleteStage,
} = require("../controllers/stageController");

router.get("/", protect, getStages);
router.post("/", protect, restrictTo("admin"), createStage);
router.put("/:id", protect, restrictTo("admin"), updateStage);
router.delete("/:id", protect, restrictTo("admin"), deleteStage);

module.exports = router;
