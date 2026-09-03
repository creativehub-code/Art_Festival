const Language = require("../models/Language");
const Program = require("../models/Program");
const Judge = require("../models/Judge");
const sendError = require("../utils/errorResponse");

// @desc    Get all languages sorted by position ASC, then name ASC
// @route   GET /api/languages
// @access  Protected (Admin / Judge)
const getLanguages = async (req, res) => {
  try {
    const languages = await Language.find().sort({ position: 1, name: 1 }).lean();
    res.json(languages);
  } catch (error) {
    sendError(res, 500, "Failed to retrieve languages", error);
  }
};

// @desc    Create a new language
// @route   POST /api/languages
// @access  Protected (Admin only)
const createLanguage = async (req, res) => {
  try {
    const { name, position } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "Language name is required" });
    }

    const trimmedName = name.trim();

    // Case-insensitive duplicate check
    const existing = await Language.findOne({
      name: { $regex: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    });

    if (existing) {
      return res.status(400).json({ message: "Language already exists" });
    }

    let targetPosition = position;
    if (targetPosition === undefined || targetPosition === null || isNaN(Number(targetPosition))) {
      const maxLang = await Language.findOne().sort({ position: -1 }).exec();
      targetPosition = maxLang && typeof maxLang.position === "number" ? maxLang.position + 1 : 1;
    } else {
      targetPosition = Number(targetPosition);
    }

    const newLanguage = await Language.create({
      name: trimmedName,
      position: targetPosition,
    });

    res.status(201).json(newLanguage);
  } catch (error) {
    sendError(res, 400, "Failed to create language", error);
  }
};

// @desc    Delete a language (only if not referenced by any Program or Judge)
// @route   DELETE /api/languages/:id
// @access  Protected (Admin only)
const deleteLanguage = async (req, res) => {
  try {
    const { id } = req.params;
    const language = await Language.findById(id);

    if (!language) {
      return res.status(404).json({ message: "Language not found" });
    }

    const langRegex = new RegExp(`^${language.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");

    // Check references in Program and Judge
    const [programUseCount, judgeUseCount] = await Promise.all([
      Program.countDocuments({ language: { $regex: langRegex } }),
      Judge.countDocuments({ category: { $regex: langRegex } }),
    ]);

    if (programUseCount > 0 || judgeUseCount > 0) {
      return res.status(400).json({
        message: "Cannot delete this language because it is currently used by programs or judges.",
      });
    }

    await Language.findByIdAndDelete(id);

    res.json({ message: "Language deleted successfully" });
  } catch (error) {
    sendError(res, 500, "Failed to delete language", error);
  }
};

module.exports = {
  getLanguages,
  createLanguage,
  deleteLanguage,
};
