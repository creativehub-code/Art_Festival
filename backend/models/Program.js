const mongoose = require("mongoose");

const programSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    maxMarks: {
      type: Number,
      default: 100,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    },
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "completed"],
      default: "upcoming",
    },
    language: {
      type: String,
      enum: ["Malayalam", "Arabic", "Urdu", "English"],
      required: true,
      default: "English",
    },
    // When true, this program requires exactly two participants registered as a pair
    isConversation: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

programSchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.model("Program", programSchema);
