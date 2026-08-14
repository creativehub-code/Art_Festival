const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  getGroups,
  createGroup,
  deleteGroup,
} = require("../controllers/groupController");

router.route("/").get(protect, getGroups).post(protect, restrictTo("admin"), createGroup);
router.route("/:id").delete(protect, restrictTo("admin"), deleteGroup);

module.exports = router;
