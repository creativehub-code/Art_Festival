const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const connectDB = require("./config/db");

dotenv.config();

// Connect to Database
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;


app.set('trust proxy', 1);
// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per 15 minutes (higher for admin dashboard)
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per 15 minutes
  message: "Too many login/setup attempts from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 write operations per minute
  message: "Too many write operations from this IP, please try again after a minute",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "GET", // Apply only to POST, PUT, DELETE
});

// Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "https://musabaqa-app.vercel.app",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "5mb" }));

// Security Middlewares
app.use(helmet());

// Express 5 compatible NoSQL sanitization
app.use((req, res, next) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.query) mongoSanitize.sanitize(req.query);
  if (req.params) mongoSanitize.sanitize(req.params);
  next();
});


// Global API Rate Limiting
app.use("/api", apiLimiter);

// Specific Route Rate Limiting
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/setup", authLimiter);
app.use("/api/participants", writeLimiter);
app.use("/api/programs", writeLimiter);
app.use("/api/marks", writeLimiter);

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/participants", require("./routes/participantRoutes"));
app.use("/api/teams", require("./routes/teamRoutes"));
app.use("/api/groups", require("./routes/groupRoutes"));
app.use("/api/programs", require("./routes/programRoutes"));
app.use("/api/marks", require("./routes/markRoutes"));
app.use("/api/judges", require("./routes/judgeRoutes"));
app.use("/api/judgeGroups", require("./routes/judgeGroupRoutes"));
app.use("/api/settings", require("./routes/settingsRoutes"));
app.use("/api/conversation-pairs", require("./routes/conversationPairRoutes"));
app.use("/api/public", require("./routes/publicRoutes"));


// Basic Route
app.get("/", (req, res) => {
  res.send("Art Festival API is running");
});

// Global Error Handler (to avoid leaking internal error details)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: process.env.NODE_ENV === 'production' 
      ? "An internal server error occurred" 
      : err.message 
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
