const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const judgeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true, // allow existing judges without username
    },
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
    },
    category: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    judgeGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JudgeGroup",
    },
    role: {
      type: String,
      enum: ["admin", "judge"],
      default: "judge",
      required: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// Hash password before saving (only if modified)
judgeSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Securely compare entered password with hashed password in DB
judgeSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("Judge", judgeSchema);
