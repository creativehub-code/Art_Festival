const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  getPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
} = require("../controllers/programController");

router.route("/").get(protect, getPrograms).post(protect, restrictTo("admin"), createProgram);
router.route("/:id").patch(protect, restrictTo("admin"), updateProgram).delete(protect, restrictTo("admin"), deleteProgram);

module.exports = router;
