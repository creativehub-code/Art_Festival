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
      required: true,
      trim: true,
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
    criteria: [
      {
        title: {
          type: String,
          trim: true,
          required: true,
        },
        maxMarks: {
          type: Number,
          required: true,
          min: 0,
        },
        position: {
          type: Number,
          default: 0,
        },
      },
    ],
    // When true, judges score using detailed criteria breakdown
    criteriaEnabled: {
      type: Boolean,
      default: false,
    },
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

    // Stage assignment: which physical stage this program runs on (null = no stage)
    stageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Stage",
      default: null,
    },

    // Event ordering: position within this program's assigned stage (1-based, null = unset)
    stagePosition: {
      type: Number,
      default: null,
    },
    // Number of result positions (1, 2, or 3)
    positionCount: {
      type: Number,
      enum: [1, 2, 3],
      default: 3,
    },

    // Judge Display Order: admin-controlled participant/pair ordering for the Judge Panel
    judgeDisplayOrderMode: {
      type: String,
      enum: ['default', 'asc', 'desc', 'custom'],
      default: 'default',
    },

    // Stores ordered ObjectIds of Participant (individual) or ConversationPair (conversation) documents
    // Only meaningful when judgeDisplayOrderMode === 'custom'
    customJudgeDisplayOrder: [{
      type: mongoose.Schema.Types.ObjectId,
    }],

    // ── Grade System ─────────────────────────────────────────────────────────
    // When true, grade points are calculated from the participant's percentage
    // and added on top of the existing position points.
    gradeSystemEnabled: {
      type: Boolean,
      default: false,
    },

    // Admin-configurable grade rules. Each rule maps a percentage range to a
    // grade name and grade point value. Ranges must not overlap.
    gradeRules: [
      {
        gradeName: {
          type: String,
          required: true,
          trim: true,
        },
        minPercentage: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
        },
        maxPercentage: {
          type: Number,
          required: true,
          min: 0,
          max: 100,
        },
        gradePoints: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
    // ─────────────────────────────────────────────────────────────────────────
  },
  {
    timestamps: true,
  },
);

programSchema.index({ status: 1, updatedAt: -1 });
programSchema.index({ globalPosition: 1 });
programSchema.index({ language: 1, languagePosition: 1 });
programSchema.index({ stageId: 1, stagePosition: 1 });

module.exports = mongoose.model("Program", programSchema);
