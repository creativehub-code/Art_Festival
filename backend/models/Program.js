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
    topics: [
      {
        title: {
          type: String,
          trim: true,
          required: true,
        },
      },
    ],
    // When true, this program requires exactly two participants registered as a pair
    isConversation: {
      type: Boolean,
      default: false,
    },

    // Event ordering: position among ALL programs across all languages (1-based, null = unset)
    globalPosition: {
      type: Number,
      default: null,
    },

    // Event ordering: position within this program's own language (1-based, null = unset)
    languagePosition: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

programSchema.index({ status: 1, updatedAt: -1 });
programSchema.index({ globalPosition: 1 });
programSchema.index({ language: 1, languagePosition: 1 });

module.exports = mongoose.model("Program", programSchema);
