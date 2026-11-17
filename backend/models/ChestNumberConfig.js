const mongoose = require("mongoose");

const chestNumberConfigSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      unique: true,
    },
    startNumber: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "startNumber must be an integer",
      },
    },
    endNumber: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "endNumber must be an integer",
      },
    },
    allocationCounter: {
      type: Number,
      default: 0,
    },
    lastFencingToken: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
chestNumberConfigSchema.index({ startNumber: 1, endNumber: 1 });

module.exports = mongoose.model("ChestNumberConfig", chestNumberConfigSchema);
