const express = require("express");
const router = express.Router();
const {
  getRanges,
  getRangeByGroup,
  suggestNextChestNumber,
  createOrUpdateRange,
  validateChestNumber,
  deleteRange,
} = require("../controllers/chestRangeController");
const { protect, restrictTo } = require("../middleware/authMiddleware");

// All chest range management endpoints are restricted to administrators
router.use(protect);
router.use(restrictTo("admin"));

router.route("/")
  .get(getRanges)
  .post(createOrUpdateRange);

router.post("/validate", validateChestNumber);

router.route("/:id")
  .get(getRangeByGroup)
  .delete(deleteRange);

router.get("/:id/next", suggestNextChestNumber);

router.route("/group/:groupId")
  .get(getRangeByGroup)
  .delete(deleteRange);

router.get("/group/:groupId/next", suggestNextChestNumber);

module.exports = router;
