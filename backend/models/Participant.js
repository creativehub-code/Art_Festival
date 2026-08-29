const mongoose = require("mongoose");

const participantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    image: {
      type: String, // Base64 string
      default: "",
    },
    chestNumber: {
      type: String,
      required: true,
      unique: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    },
    totalScore: {
      type: Number,
      default: 0,
    },
    programs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Program",
      },
    ],
  },
  {
    timestamps: true,
  },
);

participantSchema.index({ teamId: 1 });
participantSchema.index({ groupId: 1 });
participantSchema.index({ programs: 1 }); // Used by review marks participant-count aggregation

// Indexes for Individual Marks ranking
participantSchema.index({ totalScore: -1, _id: 1 });
participantSchema.index({ groupId: 1, totalScore: -1, _id: 1 });

module.exports = mongoose.model("Participant", participantSchema);
