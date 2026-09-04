const mongoose = require("mongoose");

const judgeMarkSchema = new mongoose.Schema(
  {
    judgeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Judge",
      required: true,
    },
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Program",
      required: true,
    },
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Participant",
      required: true,
    },
    marksGiven: {
      type: Number,
      required: true,
      min: 0,
    },
    criteriaMarks: [
      {
        criterionId: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        title: {
          type: String,
        },
        marksGiven: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
    submitted: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  },
);

judgeMarkSchema.index({ judgeId: 1, programId: 1, participantId: 1 }, { unique: true });

module.exports = mongoose.model("JudgeMark", judgeMarkSchema);
