const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  submitMark,
  submitBatchMarks,
  getMarksByProgram,
  calculateScores,
  exportToGoogleSheets,
  streamMarks,
  getAllExportData,
  updateMarkStatus,
  editApprovedMark,
  getReviewPrograms,
  getReviewProgramDetail,
} = require("../controllers/markController");

router.post("/batch", protect, restrictTo("admin", "judge"), submitBatchMarks);
router.post("/", protect, restrictTo("admin", "judge"), submitMark);
router.get("/export-data", protect, restrictTo("admin"), getAllExportData);


// Review Marks endpoints — MUST be declared before /:programId to avoid route shadowing
router.get("/review/programs", protect, restrictTo("admin"), getReviewPrograms);
router.get("/review/program/:programId", protect, restrictTo("admin"), getReviewProgramDetail);

// SSE stream route MUST be declared before /:programId to avoid route conflict
router.get("/stream/:programId", protect, restrictTo("admin"), streamMarks);
router.get("/:programId", protect, restrictTo("admin", "judge"), getMarksByProgram);
router.post("/calculate/:programId", protect, restrictTo("admin"), calculateScores);
router.post("/export-sheets/:programId", protect, restrictTo("admin"), exportToGoogleSheets);
router.patch("/:id/status", protect, restrictTo("admin"), updateMarkStatus);
router.patch("/:id", protect, restrictTo("admin"), editApprovedMark);

module.exports = router;
