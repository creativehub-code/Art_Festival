const mongoose = require("mongoose");
const Stage = require("../models/Stage");
const Program = require("../models/Program");
const sendError = require("../utils/errorResponse");

// @desc    Get all stages
// @route   GET /api/stages
// @access  Admin (protected) & Public (read-only via /api/public/stages)
const getStages = async (req, res) => {
  try {
    const stages = await Stage.find().sort({ position: 1, name: 1 });
    res.json(stages);
  } catch (error) {
    sendError(res, 500, "Failed to retrieve stages", error);
  }
};

// @desc    Create a new stage
// @route   POST /api/stages
// @access  Admin
const createStage = async (req, res) => {
  try {
    let { name, description, status, position } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Stage name is required." });
    }
    name = name.trim();

    // Auto-assign position if not provided
    if (position === undefined || position === null || position === "") {
      const maxDoc = await Stage.findOne().sort({ position: -1 }).select("position").lean();
      position = maxDoc ? maxDoc.position + 1 : 1;
    }

    const stage = await Stage.create({
      name,
      description: description ? description.trim() : "",
      status: status || "active",
      position: Number(position),
    });

    res.status(201).json(stage);
  } catch (error) {
    if (error.code === 11000 || (error.message && error.message.includes("already exists"))) {
      return res.status(400).json({ message: error.message || `A stage with this name already exists.` });
    }
    sendError(res, 500, "Failed to create stage", error);
  }
};

// @desc    Update a stage
// @route   PUT /api/stages/:id
// @access  Admin
const updateStage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid stage ID format." });
    }

    const stage = await Stage.findById(id);
    if (!stage) {
      return res.status(404).json({ message: "Stage not found." });
    }

    const { name, description, status, position } = req.body;

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ message: "Stage name cannot be empty." });
      }
      stage.name = name.trim();
    }
    if (description !== undefined) stage.description = description.trim();
    if (status !== undefined) {
      if (!["active", "inactive"].includes(status)) {
        return res.status(400).json({ message: "Status must be 'active' or 'inactive'." });
      }
      stage.status = status;
    }
    if (position !== undefined) stage.position = Number(position);

    await stage.save();
    res.json(stage);
  } catch (error) {
    if (error.code === 11000 || (error.message && error.message.includes("already exists"))) {
      return res.status(400).json({ message: error.message || `A stage with this name already exists.` });
    }
    sendError(res, 500, "Failed to update stage", error);
  }
};

// @desc    Delete a stage
// @route   DELETE /api/stages/:id
// @access  Admin
const deleteStage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid stage ID format." });
    }

    const stage = await Stage.findById(id);
    if (!stage) {
      return res.status(404).json({ message: "Stage not found." });
    }

    // Safely unassign any programs associated with this stage
    await Program.updateMany(
      { stageId: id },
      { $set: { stageId: null, stagePosition: null } }
    );

    await Stage.deleteOne({ _id: id });
    res.json({ message: "Stage deleted successfully." });
  } catch (error) {
    sendError(res, 500, "Failed to delete stage", error);
  }
};

module.exports = {
  getStages,
  createStage,
  updateStage,
  deleteStage,
};
