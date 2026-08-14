const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  getSettings,
  updateSettings,
} = require("../controllers/settingsController");

router.route("/").get(protect, getSettings).put(protect, restrictTo("admin"), updateSettings);

module.exports = router;
