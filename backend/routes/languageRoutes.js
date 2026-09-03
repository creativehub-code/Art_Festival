const express = require("express");
const router = express.Router();
const { protect, restrictTo } = require("../middleware/authMiddleware");
const {
  getLanguages,
  createLanguage,
  deleteLanguage,
} = require("../controllers/languageController");

router
  .route("/")
  .get(protect, getLanguages)
  .post(protect, restrictTo("admin"), createLanguage);

router
  .route("/:id")
  .delete(protect, restrictTo("admin"), deleteLanguage);

module.exports = router;
