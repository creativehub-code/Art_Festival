const Admin = require("../models/Admin");
const Judge = require("../models/Judge");
const { signToken } = require("../utils/authUtils");
const bcrypt = require("bcryptjs");

const login = async (req, res) => {
  let { email, password } = req.body;
  const identifier = email ? email.trim().toLowerCase() : "";
  if (password) password = password.trim();

  try {
    const [admin, judgeByEmail, judgeByUsername] = await Promise.all([
      Admin.findOne({ email: identifier }).select("+password"),
      Judge.findOne({ email: identifier }).select("+password").populate("judgeGroupId"),
      Judge.findOne({ username: identifier }).select("+password").populate("judgeGroupId"),
    ]);

    const user = admin || judgeByEmail || judgeByUsername;
    const DUMMY_HASH = "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012";

    const isValid = user 
      ? await user.matchPassword(password || "") 
      : await bcrypt.compare(password || "", DUMMY_HASH);

    if (!user || !isValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = signToken(user._id, user.role);

    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    let responseUser;
    if (user.role === 'admin') {
      responseUser = { email: user.email, name: user.name, lastLogin: user.lastLogin };
    } else {
      responseUser = {
        _id: user._id,
        email: user.email || null,
        username: user.username || null,
        name: user.name,
        category: user.category || null,
        lastLogin: user.lastLogin,
        assignedPrograms: user.judgeGroupId ? user.judgeGroupId.assignedPrograms : [],
        judgeGroupId: user.judgeGroupId ? user.judgeGroupId._id : null,
      };
    }

    return res.json({
      role: user.role,
      user: responseUser,
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "An error occurred during login" });
  }
};

const setup = async (req, res) => {
  // ──────────────────────────────────────────────────────────────────────────
  // DEFENSE 1 — Environment variable kill-switch.
  // In production (Render), set ALLOW_INITIAL_SETUP=false *immediately* after
  // the first admin is created.  This gate is checked FIRST so that even a
  // database outage cannot be exploited to re-run setup.
  // ──────────────────────────────────────────────────────────────────────────
  if (process.env.ALLOW_INITIAL_SETUP !== "true") {
    return res.status(403).json({
      message: "Setup route is disabled. Contact the system administrator.",
    });
  }

  try {
    // ── Input validation ────────────────────────────────────────────────────
    let { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }

    name = String(name).trim();
    email = String(email).trim().toLowerCase();
    password = String(password).trim();

    // Basic password strength gate
    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long.",
      });
    }

    // Simple email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Invalid email format." });
    }

    // ── DEFENSE 2 — Atomic race-condition-safe admin creation ───────────────
    // countDocuments() + create() is NOT atomic: two concurrent requests can
    // both see count === 0 and both create an admin.  Instead we use a unique
    // index on the isInitialSetup field combined with a findOne guard
    // inside a try/catch.  The unique-index violation is our ultimate safety
    // net against two concurrent requests winning the initial-admin race with different emails.
    // ────────────────────────────────────────────────────────────────────────
    const existingAdmin = await Admin.findOne();
    if (existingAdmin) {
      return res.status(403).json({
        message: "Setup already completed. An admin account exists.",
      });
    }

    const admin = await Admin.create({ name, email, password, isInitialSetup: true });

    // ── Audit trail ─────────────────────────────────────────────────────────
    console.warn(
      `[SECURITY] Initial admin created — email: ${admin.email}, IP: ${req.ip}, time: ${new Date().toISOString()}`
    );

    res.status(201).json({
      message:
        "Admin created successfully. IMPORTANT: Set ALLOW_INITIAL_SETUP=false in your environment variables immediately.",
      admin: { name: admin.name, email: admin.email },
    });
  } catch (error) {
    // If the unique index rejects a duplicate email (race condition safety net)
    if (error.code === 11000) {
      return res.status(403).json({
        message: "Setup already completed. An admin account exists.",
      });
    }
    // Never leak raw Mongoose/MongoDB error messages to the client
    console.error("[SECURITY] Setup error:", error.message);
    res.status(400).json({ message: "Admin setup failed. Check server logs." });
  }
};

const getMe = async (req, res) => {
  try {
    // req.user is set by protect middleware
    res.json({ role: req.user.role, user: req.user });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

const logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  res.clearCookie('csrfToken', {
    httpOnly: true,
    secure: true,
    sameSite: 'none'
  });
  res.json({ message: "Logged out successfully." });
};

module.exports = { login, setup, getMe, logout };
