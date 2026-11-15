const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
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
  approveAllProgramMarks,
  editApprovedMark,
  getReviewPrograms,
  getReviewProgramDetail,
  recalculateCompletedProgramGrades,
} = require("../controllers/markController");

// FIX P-04: Dedicated rate limiter for the grade recalculation endpoint.
// This endpoint is significantly more expensive than a standard write (it touches
// hundreds of records inside a transaction). The generic writeLimiter (120/min)
// is insufficient. 10 requests per 5 minutes per authenticated user is generous
// for a manual admin action while preventing accidental or malicious hammering.
const recalcLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  message: "Too many grade recalculation requests. Please wait 5 minutes before retrying.",
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false },
  keyGenerator: (req) => {
    // Key by authenticated user ID when available, fall back to IP
    if (req.user && req.user.id) return String(req.user.id);
    return req.ip || "unknown";
  },
});

router.post("/batch", protect, restrictTo("admin", "judge"), submitBatchMarks);
router.post("/", protect, restrictTo("admin", "judge"), submitMark);
router.get("/export-data", protect, restrictTo("admin"), getAllExportData);


// Review Marks endpoints — MUST be declared before /:programId to avoid route shadowing
router.get("/review/programs", protect, restrictTo("admin"), getReviewPrograms);
router.get("/review/program/:programId", protect, restrictTo("admin"), getReviewProgramDetail);

// SSE stream route MUST be declared before /:programId to avoid route conflict
router.get("/stream/:programId", protect, restrictTo("admin"), streamMarks);
// Bulk approve-all endpoint — declared before /:programId to avoid route shadowing
router.post("/approve-all/:programId", protect, restrictTo("admin"), approveAllProgramMarks);
router.post("/recalculate-grades/:programId", protect, restrictTo("admin"), recalcLimiter, recalculateCompletedProgramGrades);
router.get("/:programId", protect, restrictTo("admin", "judge"), getMarksByProgram);
router.post("/calculate/:programId", protect, restrictTo("admin"), calculateScores);
router.post("/export-sheets/:programId", protect, restrictTo("admin"), exportToGoogleSheets);
router.patch("/:id/status", protect, restrictTo("admin"), updateMarkStatus);
router.patch("/:id", protect, restrictTo("admin"), editApprovedMark);

module.exports = router;
