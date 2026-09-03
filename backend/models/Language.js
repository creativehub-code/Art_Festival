const mongoose = require("mongoose");

const languageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
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

languageSchema.index({ position: 1, name: 1 });

languageSchema.pre("save", async function () {
  if (this.isModified("name")) {
    const existing = await mongoose.model("Language").findOne({
      _id: { $ne: this._id },
      name: { $regex: new RegExp(`^${this.name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
    });
    if (existing) {
      const err = new Error(`Language '${this.name}' already exists.`);
      err.code = 11000;
      throw err;
    }
  }
});

module.exports = mongoose.model("Language", languageSchema);
