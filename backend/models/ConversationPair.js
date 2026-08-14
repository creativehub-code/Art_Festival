const mongoose = require("mongoose");

const conversationPairSchema = new mongoose.Schema(
  {
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Program",
      required: true,
    },
    // Array of participant IDs in this group/conversation
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Participant",
        required: true,
      },
    ],
    // The participant whose chest number represents the pair in the judge UI
    primaryParticipantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Participant",
      required: true,
    },
    // Denormalised for fast eligibility validation queries
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure a participant can only be in one ConversationPair per program
conversationPairSchema.index({ programId: 1, participants: 1 }, { unique: true });

module.exports = mongoose.model("ConversationPair", conversationPairSchema);
