const mongoose = require("mongoose");

const markAuditLogSchema = new mongoose.Schema(
  {
    markId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JudgeMark",
      required: true,
    },
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
    oldMark: {
      type: Number,
      required: true,
    },
    newMark: {
      type: Number,
      required: true,
    },
    changedByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    reason: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("MarkAuditLog", markAuditLogSchema);
