const mongoose = require("mongoose");

const stageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    position: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

stageSchema.index({ position: 1, name: 1 });

stageSchema.pre("save", async function () {
  if (this.isModified("name")) {
    const existing = await mongoose.model("Stage").findOne({
      _id: { $ne: this._id },
      name: { $regex: new RegExp(`^${this.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    });
    if (existing) {
      const err = new Error(`Stage '${this.name}' already exists.`);
      err.code = 11000;
      throw err;
    }
  }
});

module.exports = mongoose.model("Stage", stageSchema);
