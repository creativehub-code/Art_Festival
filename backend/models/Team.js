const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    totalScore: {
      type: Number,
      default: 0,
    },
    rank: {
      type: Number,
    },
  },
  {
    timestamps: true,
  },
);

teamSchema.index({ totalScore: -1 });

module.exports = mongoose.model("Team", teamSchema);
