const mongoose = require("mongoose");
const JudgeGroup = require("../models/JudgeGroup");
const Judge = require("../models/Judge");
const sendError = require("../utils/errorResponse");

// @desc    Get all judge groups
// @route   GET /api/judgeGroups
// @access  Public (should be Admin)
const getJudgeGroups = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const skip = (page - 1) * limit;

    const [judgeGroups, total] = await Promise.all([
      JudgeGroup.find()
        .populate("judges")
        .populate({
          path: "assignedPrograms",
          populate: { path: "groupId" },
        })
        .skip(skip)
        .limit(limit),
      JudgeGroup.countDocuments()
    ]);
    res.json({ data: judgeGroups, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    sendError(res, 500, "Failed to retrieve judge groups", error);
  }
};

// @desc    Create a new judge group
// @route   POST /api/judgeGroups
// @access  Public (should be Admin)
const createJudgeGroup = async (req, res) => {
  const { name, judges: newJudges, assignedProgramIds } = req.body;
  const session = await mongoose.startSession();

  try {
    let judgeGroupToReturn;

    await session.withTransaction(async () => {
      // 1. Create the JudgeGroup document first
      const judgeGroups = await JudgeGroup.create([{
        name,
        assignedPrograms: assignedProgramIds || [],
      }], { session });

      const judgeGroup = judgeGroups[0];

      // 2. Create the Judge documents
      const createdJudges = [];
      if (newJudges && newJudges.length > 0) {
        for (const judgeData of newJudges) {
          let email = judgeData.email ? judgeData.email.trim() : "";
          const existingJudge = await Judge.findOne({ email }).session(session);
          
          if (existingJudge) {
            // Throw an error to abort the transaction. No manual rollback needed.
            const err = new Error(`Judge email ${email} already exists.`);
            err.status = 400;
            throw err;
          }

          const judges = await Judge.create([{
            name: judgeData.name,
            email,
            password: judgeData.password,
            judgeGroupId: judgeGroup._id,
          }], { session });
          
          createdJudges.push(judges[0]._id);
        }
      }

      // 3. Update the JudgeGroup with the newly created Judge IDs
      judgeGroup.judges = createdJudges;
      await judgeGroup.save({ session });

      judgeGroupToReturn = judgeGroup;
    });

    res.status(201).json(judgeGroupToReturn);
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: "A judge with this email already exists." });
    }
    sendError(res, 500, "Failed to create judge group", error);
  } finally {
    await session.endSession();
  }
};

// @desc    Delete a judge group
// @route   DELETE /api/judgeGroups/:id
// @access  Public (should be Admin)
const deleteJudgeGroup = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const judgeGroup = await JudgeGroup.findById(req.params.id).session(session);

      if (!judgeGroup) {
        const err = new Error("Judge Group not found");
        err.status = 404;
        throw err;
      }

      // Delete all associated judges
      if (judgeGroup.judges && judgeGroup.judges.length > 0) {
        await Judge.deleteMany({ _id: { $in: judgeGroup.judges } }, { session });
      }

      await JudgeGroup.deleteOne({ _id: judgeGroup._id }, { session });
    });

    res.json({ message: "Judge Group and its associated judges removed" });
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).json({ message: error.message });
    }
    sendError(res, 500, "Failed to delete judge group", error);
  } finally {
    await session.endSession();
  }
};

// @desc    Update a judge group (e.g., adding/removing programs)
// @route   PATCH /api/judgeGroups/:id
// @access  Public (should be Admin)
const updateJudgeGroup = async (req, res) => {
  try {
    const { assignedProgramIds } = req.body;

    // We expect the frontend to pass the entire new array of assigned programs
    // if editing the group's assigned programs.
    const judgeGroup = await JudgeGroup.findByIdAndUpdate(
      req.params.id,
      { assignedPrograms: assignedProgramIds || [] },
      { new: true },
    );

    if (!judgeGroup) {
      return res.status(404).json({ message: "Judge Group not found" });
    }

    res.json(judgeGroup);
  } catch (error) {
    sendError(res, 500, "Failed to update judge group", error);
  }
};

module.exports = {
  getJudgeGroups,
  createJudgeGroup,
  updateJudgeGroup,
  deleteJudgeGroup,
};
