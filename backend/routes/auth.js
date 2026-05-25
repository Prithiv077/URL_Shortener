const express       = require("express");
const bcrypt        = require("bcryptjs");
const jwt           = require("jsonwebtoken");
const getConnection = require("../db");

const router = express.Router();

// ─── REGISTER ────────────────────────────────────────────────
// POST /api/auth/register
// Body: { email, password }
router.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  const conn = await getConnection();
  try {
    // Never store plain passwords — always hash first
    const hashed = await bcrypt.hash(password, 10);

    await conn.execute(
      "INSERT INTO users (email, password) VALUES (?, ?)",
      [email, hashed]
    );

    res.json({ message: "Registered successfully" });
  } catch (err) {
    // MySQL error 1062 = duplicate email
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Email already registered" });
    }
    res.status(500).json({ error: "Server error" });
  } finally {
    await conn.end(); // Always close connection
  }
});

// ─── LOGIN ───────────────────────────────────────────────────
// POST /api/auth/login
// Body: { email, password }
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  const conn = await getConnection();
  try {
    const [rows] = await conn.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0)
      return res.status(401).json({ error: "User not found" });

    // Compare entered password with the hashed one in DB
    const isMatch = await bcrypt.compare(password, rows[0].password);
    if (!isMatch)
      return res.status(401).json({ error: "Wrong password" });

    // Create JWT token — frontend saves this and sends it with every request
    const token = jwt.sign(
      { userId: rows[0].id, email: rows[0].email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, email: rows[0].email });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  } finally {
    await conn.end();
  }
});

module.exports = router;