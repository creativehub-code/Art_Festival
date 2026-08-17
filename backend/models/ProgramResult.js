const mongoose = require("mongoose");

const programResultSchema = new mongoose.Schema(
  {
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
    participantIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Participant",
    }],
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
    },
    isConversation: {
      type: Boolean,
      default: false,
    },
    position: {
      type: Number, // 1 for first place, 2 for second place, 3 for third place
      required: true,
    },
    positionPoints: {
      type: Number, // Points awarded for this position
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Prevent a participant from having multiple results for the same program
programResultSchema.index({ programId: 1, participantId: 1 }, { unique: true });

module.exports = mongoose.model("ProgramResult", programResultSchema);
