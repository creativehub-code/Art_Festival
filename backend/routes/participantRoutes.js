const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  getParticipants,
  getParticipantsByLanguage,
  getParticipantById,
  getParticipantPhoto,
  createParticipant,
  updateParticipant,
  deleteParticipant,
  searchEligible,
} = require("../controllers/participantController");

// For MVP, we might skip middleware for read, but should protect write.
// Since we don't have middleware protecting routes yet, we'll just define endpoints.
// TODO: Add auth middleware for POST/PUT/DELETE

router.route("/by-language").get(protect, getParticipantsByLanguage);
router.route("/:id/photo").get(protect, getParticipantPhoto);
// Eligible co-participant search for conversation programs — must be before /:id
router.get("/search-eligible", protect, restrictTo("admin"), searchEligible);
router.route("/").get(protect, getParticipants).post(protect, restrictTo("admin"), createParticipant);

router
  .route("/:id")
  .get(protect, getParticipantById)
  .put(protect, restrictTo("admin"), updateParticipant)
  .delete(protect, restrictTo("admin"), deleteParticipant);

module.exports = router;
