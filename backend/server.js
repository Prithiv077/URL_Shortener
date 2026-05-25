const express = require("express");
const cors    = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const authRoutes     = require("./routes/auth");
const linkRoutes     = require("./routes/links");
const redirectRoutes = require("./routes/redirect");

const app = express();


// ─── RATE LIMITER ───────────────────────────────────────────
// Prevents spam / abuse attacks
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP
  message: {
    error: "Too many requests. Please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
});


// Middlewares
app.use(cors());
app.use(apiLimiter);           // allows React frontend to call this API
app.use(express.json());   // lets us read req.body as JSON

// Routes
app.use("/api/auth",  authRoutes);     // POST /api/auth/register, /api/auth/login
app.use("/api/links", linkRoutes);     // GET/POST/DELETE /api/links
app.use("/",          redirectRoutes); // GET /:shortCode → redirect

// Health check — useful to test if server is running
app.get("/api/health", (req, res) => {
  res.json({ status: "Server is running" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});