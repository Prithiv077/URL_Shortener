# URL SHORTENER — FULL PROJECT
### 3rd Year Full Stack Project | React + Node.js + MySQL + AWS

---

## FOLDER STRUCTURE

```
url-shortener/
├── backend/
│   ├── server.js
│   ├── db.js
│   ├── schema.sql
│   ├── .env.example
│   ├── package.json
│   └── routes/
│       ├── auth.js
│       ├── links.js
│       └── redirect.js
└── frontend/
    ├── package.json
    └── src/
        ├── index.js
        ├── App.js
        ├── App.css
        ├── api.js
        └── pages/
            ├── Login.js
            ├── Register.js
            └── Dashboard.js
```

---

## HOW TO RUN LOCALLY

```bash
# Step 1 — Run schema.sql in MySQL Workbench

# Step 2 — Backend
cd backend
npm install
cp .env.example .env       # then fill in your MySQL details
npm run dev                # runs on http://localhost:5000

# Step 3 — Frontend
cd frontend
npm install
npm start                  # runs on http://localhost:3000
```

---
---

# BACKEND FILES

---

## backend/package.json

```json
{
  "name": "url-shortener-backend",
  "version": "1.0.0",
  "description": "URL Shortener Backend - 3rd Year Project",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.0",
    "mysql2": "^3.6.0",
    "qrcode": "^1.5.3"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

---

## backend/.env.example

```
DB_HOST=your-rds-endpoint.rds.amazonaws.com
DB_USER=admin
DB_PASS=yourpassword
DB_NAME=urlshortener
JWT_SECRET=your_super_secret_key_here
BASE_URL=http://your-ec2-ip:5000
PORT=5000
```

> Copy this to `.env` and fill in your actual values before running.

---

## backend/schema.sql

```sql
-- Run this in MySQL Workbench before starting the backend
-- OR via CLI: mysql -u admin -p < schema.sql

CREATE DATABASE IF NOT EXISTS urlshortener;
USE urlshortener;

-- Stores registered users
CREATE TABLE IF NOT EXISTS users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  email      VARCHAR(255) UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,         -- bcrypt hashed, never plain text
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stores all shortened URLs
CREATE TABLE IF NOT EXISTS links (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  short_code   VARCHAR(20) UNIQUE NOT NULL,  -- e.g. "abc123"
  original_url TEXT NOT NULL,
  clicks       INT DEFAULT 0,
  expires_at   DATETIME DEFAULT NULL,        -- optional expiry
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  -- ON DELETE CASCADE: deleting a user also deletes all their links
);
```

---

## backend/db.js

```js
const mysql = require("mysql2/promise");
require("dotenv").config();

// Creates a fresh MySQL connection every time it's called.
// No connection pool — simpler to understand for a student project.
// Always call conn.end() after your query to close it.
const getConnection = async () => {
  const connection = await mysql.createConnection({
    host    : process.env.DB_HOST,
    port    : 3306,
    user    : process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  });
  return connection;
};

module.exports = getConnection;
```

---

## backend/server.js

```js
const express = require("express");
const cors    = require("cors");
require("dotenv").config();

const authRoutes     = require("./routes/auth");
const linkRoutes     = require("./routes/links");
const redirectRoutes = require("./routes/redirect");

const app = express();

// Middlewares
app.use(cors());           // allows React frontend to call this API
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
```

---

## backend/routes/auth.js

```js
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
```

---

## backend/routes/links.js

```js
const express       = require("express");
const QRCode        = require("qrcode");
const jwt           = require("jsonwebtoken");
const getConnection = require("../db");

const router = express.Router();

// ─── AUTH MIDDLEWARE ─────────────────────────────────────────
// This runs before every route in this file.
// It checks if the request has a valid JWT token.
// If valid, it adds req.userId so routes know who is logged in.
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader)
    return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1]; // "Bearer <token>" → take the token part

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next(); // pass to the actual route handler
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// ─── GENERATE SHORT CODE ──────────────────────────────────────
// Creates a random 6-character alphanumeric string e.g. "k7x2mq"
const generateShortCode = () => {
  return Math.random().toString(36).substring(2, 8);
};

// ─── CREATE SHORT LINK ────────────────────────────────────────
// POST /api/links
// Body: { originalUrl, expiresAt (optional) }
router.post("/", authenticate, async (req, res) => {
  const { originalUrl, expiresAt } = req.body;

  if (!originalUrl)
    return res.status(400).json({ error: "Original URL is required" });

  // Validate URL format using browser's built-in URL parser
  try {
    new URL(originalUrl);
  } catch {
    return res.status(400).json({ error: "Invalid URL format" });
  }

  const shortCode = generateShortCode();
  const shortUrl  = `${process.env.BASE_URL}/${shortCode}`;
  const conn      = await getConnection();

  try {
    await conn.execute(
      `INSERT INTO links (user_id, short_code, original_url, expires_at)
       VALUES (?, ?, ?, ?)`,
      [req.userId, shortCode, originalUrl, expiresAt || null]
    );

    // Generate QR code as a base64 PNG image string
    // Frontend uses it directly as: <img src={qrCode} />
    const qrCode = await QRCode.toDataURL(shortUrl);

    res.json({ shortCode, shortUrl, originalUrl, qrCode });
  } catch (err) {
    res.status(500).json({ error: "Failed to create link" });
  } finally {
    await conn.end();
  }
});

// ─── GET ALL LINKS FOR LOGGED-IN USER ─────────────────────────
// GET /api/links
router.get("/", authenticate, async (req, res) => {
  const conn = await getConnection();
  try {
    const [links] = await conn.execute(
      `SELECT id, short_code, original_url, clicks, expires_at, created_at
       FROM links
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.userId]
    );

    // Attach the full short URL to each link object
    const result = links.map((link) => ({
      ...link,
      shortUrl: `${process.env.BASE_URL}/${link.short_code}`,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch links" });
  } finally {
    await conn.end();
  }
});

// ─── GET QR CODE FOR A SPECIFIC LINK ──────────────────────────
// GET /api/links/:shortCode/qr
router.get("/:shortCode/qr", authenticate, async (req, res) => {
  const { shortCode } = req.params;
  const shortUrl = `${process.env.BASE_URL}/${shortCode}`;

  try {
    const qrCode = await QRCode.toDataURL(shortUrl);
    res.json({ qrCode });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});

// ─── DELETE A LINK ─────────────────────────────────────────────
// DELETE /api/links/:id
router.delete("/:id", authenticate, async (req, res) => {
  const { id } = req.params;
  const conn = await getConnection();

  try {
    // First check the link belongs to this user — security check
    const [rows] = await conn.execute(
      "SELECT * FROM links WHERE id = ? AND user_id = ?",
      [id, req.userId]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "Link not found" });

    await conn.execute("DELETE FROM links WHERE id = ?", [id]);

    res.json({ message: "Link deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete link" });
  } finally {
    await conn.end();
  }
});

module.exports = router;
```

---

## backend/routes/redirect.js

```js
const express       = require("express");
const getConnection = require("../db");

const router = express.Router();

// ─── REDIRECT SHORT URL ───────────────────────────────────────
// GET /:shortCode
//
// This is the CORE FEATURE of the whole app.
// When anyone visits http://your-server/abc123 —
// this route finds the original URL and redirects the browser there.
//
// Works for ANYONE — no login needed.
// Person A creates the link, Person B can use it from any device.
router.get("/:shortCode", async (req, res) => {
  const { shortCode } = req.params;

  // Skip if it's an API route accidentally hitting this handler
  if (shortCode.startsWith("api"))
    return res.status(404).json({ error: "Not found" });

  const conn = await getConnection();
  try {
    const [rows] = await conn.execute(
      "SELECT * FROM links WHERE short_code = ?",
      [shortCode]
    );

    if (rows.length === 0)
      return res.status(404).send("Short link not found");

    const link = rows[0];

    // Check if this link has an expiry date and if it's passed
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return res.status(410).send("This link has expired");
    }

    // Count this visit
    await conn.execute(
      "UPDATE links SET clicks = clicks + 1 WHERE short_code = ?",
      [shortCode]
    );

    // 302 = Temporary redirect
    // WHY 302 not 301?
    // 301 is permanent — browsers cache it — clicks won't count next time
    // 302 is temporary — browsers always re-request — every click is counted
    res.redirect(302, link.original_url);
  } catch (err) {
    res.status(500).send("Server error");
  } finally {
    await conn.end();
  }
});

module.exports = router;
```

---
---

# FRONTEND FILES

---

## frontend/package.json

```json
{
  "name": "url-shortener-frontend",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.14.0",
    "axios": "^1.4.0",
    "react-scripts": "5.0.1"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build"
  },
  "browserslist": {
    "production": [">0.2%", "not dead"],
    "development": ["last 1 chrome version"]
  }
}
```

---

## frontend/src/index.js

```js
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
```

---

## frontend/src/api.js

```js
import axios from "axios";

// Change baseURL to your EC2 public IP when deploying to AWS
// e.g. "http://13.233.xx.xx:5000/api"
const API = axios.create({
  baseURL: "http://localhost:5000/api",
});

// Interceptor: automatically adds JWT token to EVERY request
// So you don't have to manually add it in Login.js, Dashboard.js, etc.
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default API;
```

---

## frontend/src/App.js

```js
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login     from "./pages/Login";
import Register  from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import "./App.css";

// Check if user is logged in by looking for token in localStorage
const isLoggedIn = () => !!localStorage.getItem("token");

// Wrapper that blocks unauthenticated users from the dashboard
const PrivateRoute = ({ children }) => {
  return isLoggedIn() ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        {/* Redirect unknown routes based on login status */}
        <Route path="*" element={<Navigate to={isLoggedIn() ? "/dashboard" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

---

## frontend/src/App.css

```css
/* ── RESET & BASE ─────────────────────────────────────────── */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: "Courier New", Courier, monospace;
  background-color: #f5f5f0;
  color: #1a1a1a;
  font-size: 15px;
}

/* ── LAYOUT ───────────────────────────────────────────────── */
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.card {
  background: #fff;
  border: 2px solid #1a1a1a;
  padding: 32px;
  width: 100%;
  max-width: 420px;
}

.dashboard-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 30px 20px;
}

/* ── TYPOGRAPHY ───────────────────────────────────────────── */
h1 {
  font-size: 22px;
  font-weight: bold;
  margin-bottom: 6px;
  letter-spacing: -0.5px;
}

h2 {
  font-size: 18px;
  margin-bottom: 20px;
  border-bottom: 2px solid #1a1a1a;
  padding-bottom: 8px;
}

p.subtitle {
  font-size: 13px;
  color: #555;
  margin-bottom: 24px;
}

/* ── FORM ELEMENTS ────────────────────────────────────────── */
.form-group {
  margin-bottom: 16px;
}

label {
  display: block;
  font-size: 13px;
  font-weight: bold;
  margin-bottom: 5px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

input[type="text"],
input[type="email"],
input[type="password"],
input[type="datetime-local"],
input[type="url"] {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #1a1a1a;
  background: #f5f5f0;
  font-family: "Courier New", monospace;
  font-size: 14px;
  outline: none;
}

input:focus {
  background: #fff;
  border-color: #0057ff;
}

/* ── BUTTONS ──────────────────────────────────────────────── */
.btn {
  padding: 10px 20px;
  font-family: "Courier New", monospace;
  font-size: 14px;
  font-weight: bold;
  border: 2px solid #1a1a1a;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-primary {
  background: #1a1a1a;
  color: #fff;
  width: 100%;
  padding: 12px;
}

.btn-primary:hover {
  background: #0057ff;
  border-color: #0057ff;
}

.btn-danger {
  background: #fff;
  color: #cc0000;
  border-color: #cc0000;
  font-size: 12px;
  padding: 5px 10px;
}

.btn-danger:hover {
  background: #cc0000;
  color: #fff;
}

.btn-copy {
  background: #fff;
  color: #1a1a1a;
  font-size: 12px;
  padding: 5px 10px;
}

.btn-copy:hover {
  background: #1a1a1a;
  color: #fff;
}

/* ── NAVBAR ───────────────────────────────────────────────── */
.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #1a1a1a;
  padding-bottom: 16px;
  margin-bottom: 30px;
}

.navbar .logo {
  font-size: 20px;
  font-weight: bold;
  letter-spacing: -1px;
}

.navbar span {
  font-size: 13px;
  color: #555;
}

.btn-logout {
  background: none;
  border: 2px solid #1a1a1a;
  padding: 6px 14px;
  font-family: "Courier New", monospace;
  font-size: 13px;
  cursor: pointer;
  text-transform: uppercase;
}

.btn-logout:hover {
  background: #1a1a1a;
  color: #fff;
}

/* ── SHORTEN FORM ─────────────────────────────────────────── */
.shorten-box {
  border: 2px solid #1a1a1a;
  padding: 24px;
  margin-bottom: 30px;
  background: #fff;
}

.input-row {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.input-row input {
  flex: 1;
}

.input-row .btn {
  white-space: nowrap;
}

/* ── QR RESULT BOX ────────────────────────────────────────── */
.result-box {
  border: 2px dashed #1a1a1a;
  padding: 16px;
  margin-top: 16px;
  display: flex;
  gap: 20px;
  align-items: flex-start;
  background: #f5f5f0;
}

.result-box img {
  width: 100px;
  height: 100px;
  border: 2px solid #1a1a1a;
}

.result-info {
  flex: 1;
}

.result-info .short-url {
  font-size: 16px;
  font-weight: bold;
  color: #0057ff;
  word-break: break-all;
  margin-bottom: 8px;
}

.result-info .original-url {
  font-size: 12px;
  color: #666;
  word-break: break-all;
  margin-bottom: 10px;
}

/* ── LINKS LIST ───────────────────────────────────────────── */
.links-section h2 {
  margin-bottom: 16px;
}

.link-item {
  border: 2px solid #1a1a1a;
  padding: 14px 16px;
  margin-bottom: 10px;
  background: #fff;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.link-item .link-left {
  flex: 1;
  min-width: 0;
}

.link-item .short {
  font-weight: bold;
  color: #0057ff;
  font-size: 15px;
  word-break: break-all;
}

.link-item .original {
  font-size: 12px;
  color: #777;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 400px;
  margin-top: 3px;
}

.link-meta {
  font-size: 12px;
  color: #555;
  margin-top: 6px;
}

.link-meta span {
  margin-right: 12px;
}

.link-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

/* ── QR MODAL ─────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal {
  background: #fff;
  border: 3px solid #1a1a1a;
  padding: 30px;
  text-align: center;
  max-width: 280px;
}

.modal h3 {
  margin-bottom: 16px;
  font-size: 16px;
  text-transform: uppercase;
}

.modal img {
  width: 200px;
  height: 200px;
  border: 2px solid #1a1a1a;
  margin-bottom: 16px;
}

.modal p {
  font-size: 12px;
  color: #555;
  margin-bottom: 14px;
  word-break: break-all;
}

/* ── MISC ─────────────────────────────────────────────────── */
.error-msg {
  color: #cc0000;
  font-size: 13px;
  margin-top: 10px;
  border-left: 3px solid #cc0000;
  padding-left: 8px;
}

.success-msg {
  color: #006600;
  font-size: 13px;
  margin-top: 10px;
  border-left: 3px solid #006600;
  padding-left: 8px;
}

.link-text {
  font-size: 13px;
  margin-top: 20px;
  text-align: center;
}

.link-text a {
  color: #0057ff;
  text-decoration: none;
  font-weight: bold;
}

.empty-state {
  text-align: center;
  padding: 40px;
  border: 2px dashed #aaa;
  color: #888;
  font-size: 14px;
}
```

---

## frontend/src/pages/Login.js

```js
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api";

function Login() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await API.post("/auth/login", { email, password });
      // Save token — api.js interceptor will attach it to all future requests
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("email", res.data.email);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <h1>url-shortener</h1>
        <p className="subtitle">3rd Year Project — Login to continue</p>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <br />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="link-text">
          No account? <Link to="/register">Register here</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
```

---

## frontend/src/pages/Register.js

```js
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../api";

function Register() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 6) {
      return setError("Password must be at least 6 characters");
    }

    setLoading(true);
    try {
      await API.post("/auth/register", { email, password });
      setSuccess("Registered! Redirecting to login...");
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <h1>url-shortener</h1>
        <p className="subtitle">Create a new account</p>

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="min 6 characters"
              required
            />
          </div>

          {error   && <p className="error-msg">{error}</p>}
          {success && <p className="success-msg">{success}</p>}

          <br />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Registering..." : "Register"}
          </button>
        </form>

        <p className="link-text">
          Already have an account? <Link to="/login">Login here</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
```

---

## frontend/src/pages/Dashboard.js

```js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";

function Dashboard() {
  const [links,     setLinks]     = useState([]);
  const [url,       setUrl]       = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [result,    setResult]    = useState(null); // newly created link
  const [error,     setError]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [qrModal,   setQrModal]   = useState(null); // link shown in QR popup
  const [copied,    setCopied]    = useState("");
  const navigate = useNavigate();

  const email = localStorage.getItem("email");

  // Fetch all user's links when page first loads
  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    try {
      const res = await API.get("/links");
      setLinks(res.data);
    } catch (err) {
      if (err.response?.status === 401) handleLogout(); // token expired
    }
  };

  // Shorten a new URL
  const handleShorten = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const res = await API.post("/links", {
        originalUrl: url,
        expiresAt  : expiresAt || null,
      });
      setResult(res.data); // contains shortUrl + qrCode
      setUrl("");
      setExpiresAt("");
      fetchLinks(); // refresh list
    } catch (err) {
      setError(err.response?.data?.error || "Failed to shorten URL");
    } finally {
      setLoading(false);
    }
  };

  // Delete a link by ID
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this link?")) return;
    try {
      await API.delete(`/links/${id}`);
      setLinks(links.filter((l) => l.id !== id));
    } catch {
      alert("Failed to delete");
    }
  };

  // Copy short URL to clipboard
  const handleCopy = (shortUrl) => {
    navigator.clipboard.writeText(shortUrl);
    setCopied(shortUrl);
    setTimeout(() => setCopied(""), 2000);
  };

  // Fetch and show QR code for an existing link
  const handleShowQR = async (link) => {
    try {
      const res = await API.get(`/links/${link.short_code}/qr`);
      setQrModal({ ...link, qrCode: res.data.qrCode });
    } catch {
      alert("Failed to load QR");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    navigate("/login");
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
    });
  };

  return (
    <div className="dashboard-container">

      {/* NAVBAR */}
      <div className="navbar">
        <div className="logo">url-shortener</div>
        <span>{email}</span>
        <button className="btn-logout" onClick={handleLogout}>Logout</button>
      </div>

      {/* SHORTEN FORM */}
      <div className="shorten-box">
        <h2>Shorten a URL</h2>
        <form onSubmit={handleShorten}>
          <div className="input-row">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.example.com/very-long-url-here"
              required
            />
            <button className="btn btn-primary" type="submit" disabled={loading}
              style={{ width: "auto" }}>
              {loading ? "..." : "Shorten"}
            </button>
          </div>

          <div className="form-group">
            <label>Expiry Date (optional)</label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </form>

        {error && <p className="error-msg">{error}</p>}

        {/* RESULT BOX — shown after shortening */}
        {result && (
          <div className="result-box">
            <img src={result.qrCode} alt="QR Code" />
            <div className="result-info">
              <div className="short-url">{result.shortUrl}</div>
              <div className="original-url">→ {result.originalUrl}</div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="btn btn-copy" onClick={() => handleCopy(result.shortUrl)}>
                  {copied === result.shortUrl ? "Copied!" : "Copy"}
                </button>
                <a href={result.shortUrl} target="_blank" rel="noreferrer"
                  className="btn btn-copy" style={{ textDecoration: "none" }}>
                  Open
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LINKS LIST */}
      <div className="links-section">
        <h2>Your Links ({links.length})</h2>

        {links.length === 0 ? (
          <div className="empty-state">No links yet. Shorten one above!</div>
        ) : (
          links.map((link) => (
            <div className="link-item" key={link.id}>
              <div className="link-left">
                <div className="short">{link.shortUrl}</div>
                <div className="original" title={link.original_url}>
                  {link.original_url}
                </div>
                <div className="link-meta">
                  <span>👁 {link.clicks} clicks</span>
                  <span>📅 {formatDate(link.created_at)}</span>
                  {link.expires_at && (
                    <span>⏳ Expires {formatDate(link.expires_at)}</span>
                  )}
                </div>
              </div>
              <div className="link-actions">
                <button className="btn btn-copy" onClick={() => handleCopy(link.shortUrl)}>
                  {copied === link.shortUrl ? "Copied!" : "Copy"}
                </button>
                <button className="btn btn-copy" onClick={() => handleShowQR(link)}>
                  QR
                </button>
                <button className="btn btn-danger" onClick={() => handleDelete(link.id)}>
                  Del
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* QR MODAL POPUP */}
      {qrModal && (
        <div className="modal-overlay" onClick={() => setQrModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>QR Code</h3>
            <img src={qrModal.qrCode} alt="QR" />
            <p>{qrModal.shortUrl}</p>
            <button className="btn btn-primary" onClick={() => setQrModal(null)}>
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

export default Dashboard;
```

---
---

# MANUAL — HOW THE CODE WORKS

---

## How the Backend Works

**server.js** creates an Express app, attaches `cors()` and `express.json()` middleware, then registers 3 route files. The `/` route is registered last so it catches short codes like `/abc123` without conflicting with API routes.

**db.js** exports a `getConnection()` function that opens a fresh MySQL connection every time it's called. Every route calls this at the start and calls `conn.end()` in a `finally` block to close it. No connection pool is used — each request opens and closes its own connection. Simpler to understand.

**routes/auth.js — Register:** Takes email and password, hashes the password with bcrypt (so plain text is never stored), inserts into the users table. If the email already exists, MySQL throws error code `ER_DUP_ENTRY` which is caught and returned as a friendly message.

**routes/auth.js — Login:** Looks up the user by email, uses `bcrypt.compare()` to check the entered password against the stored hash. If they match, creates a JWT token signed with `JWT_SECRET` that expires in 7 days. Sends token back to frontend.

**routes/links.js — authenticate middleware:** Every route in this file runs this middleware first. It reads the `Authorization: Bearer <token>` header, verifies the JWT with `jwt.verify()`, and attaches `req.userId` so the actual route handler knows who is making the request.

**routes/links.js — Create Link:** Validates the URL using `new URL()`, generates a random 6-char code with `Math.random().toString(36).substring(2,8)`, saves to DB, then calls `QRCode.toDataURL()` to get a base64 PNG string. Returns the short URL and QR image to the frontend.

**routes/redirect.js:** This is the core feature. When anyone visits `/:shortCode`, it looks up the code in DB, checks expiry, increments the click counter, and calls `res.redirect(302, originalUrl)`. Uses 302 (not 301) so the browser doesn't cache the redirect — otherwise clicks wouldn't count after the first visit.

---

## How the Frontend Works

**api.js** creates an Axios instance with the backend base URL. An interceptor automatically reads the JWT token from localStorage and adds it as `Authorization: Bearer <token>` to every request, so individual components don't have to do this manually.

**App.js** sets up React Router with 3 routes. The `/dashboard` route is wrapped in a `PrivateRoute` component that checks localStorage for a token — if none exists, the user is redirected to `/login`.

**Login.js / Register.js** are simple controlled forms that use `useState` for inputs. On submit, they call the API, and on success save the token to localStorage and navigate to the dashboard.

**Dashboard.js** is the main page. On load, `useEffect` calls `GET /api/links` to fetch all the user's links. The shorten form calls `POST /api/links` which returns the short URL and a QR code (base64 image). The QR is displayed immediately inside a result box using `<img src={result.qrCode} />`. Each link in the list has Copy, QR, and Delete buttons. The QR button fetches a fresh QR and shows it in a modal overlay.

---

## How JWT Auth Works

1. User logs in → server creates `jwt.sign({ userId, email }, SECRET, { expiresIn: "7d" })`
2. Token looks like: `eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjF9.abc123`
3. Frontend stores it in `localStorage`
4. Every API request sends: `Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...`
5. Backend runs `jwt.verify(token, SECRET)` → gets back `{ userId, email }`
6. Now the backend knows who is making the request without storing sessions

---

## How QR Code Works

The `qrcode` npm package takes any string and generates a QR code:

```js
const qrCode = await QRCode.toDataURL("http://localhost:5000/abc123");
// Returns: "data:image/png;base64,iVBORw0KGgo..."
```

This base64 string is sent to the frontend and used directly as an image source. No file is saved anywhere on the server. Anyone who scans the QR code with their phone camera will open the short URL and be redirected.

---

## How Redirection Works (End to End)

```
1. User A (on laptop) → POST /api/links → saves "abc123" → "https://youtube.com/xyz" in DB
2. User A shares "http://your-ec2-ip:5000/abc123" with anyone
3. User B (on any device) → opens that URL in browser
4. Browser → GET http://your-ec2-ip:5000/abc123
5. Express → routes/redirect.js → finds abc123 in DB → clicks++ → res.redirect(302, "https://youtube.com/xyz")
6. Browser follows redirect → User B lands on YouTube
```

The link works for anyone because your backend runs on AWS EC2 which has a public IP address accessible from anywhere in the world.

---

## AWS Deployment Steps

### 1. RDS MySQL
- AWS Console → RDS → Create Database → MySQL → Free Tier
- DB name: `urlshortener`, keep Public Access OFF
- Copy the endpoint URL (looks like `urlshortener.xxx.ap-south-1.rds.amazonaws.com`)
- RDS Security Group → allow port 3306 from your EC2 security group only

### 2. EC2 Backend
```bash
ssh -i your-key.pem ec2-user@your-ec2-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Upload your backend code, then:
npm install
cp .env.example .env
# Edit .env — set DB_HOST to RDS endpoint, BASE_URL to http://your-ec2-ip:5000

# Run schema.sql against RDS
mysql -h your-rds-endpoint -u admin -p urlshortener < schema.sql

# Start with PM2 so it keeps running after you close SSH
npm install -g pm2
pm2 start server.js
pm2 startup && pm2 save
```

EC2 Security Group → allow inbound port 5000 from anywhere (0.0.0.0/0)

### 3. S3 Frontend
```bash
# In frontend/src/api.js, change baseURL to:
# "http://your-ec2-ip:5000/api"

cd frontend
npm run build

# Upload the build/ folder to an S3 bucket
# S3 bucket → Properties → Static Website Hosting → Enable
# Set index.html as Index document
# Bucket Policy → make it publicly readable
```

Your app is now live. Backend on EC2, frontend on S3, database on RDS.

---

## API Endpoints Summary

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /api/auth/register | No | Register new user |
| POST | /api/auth/login | No | Login, get JWT token |
| POST | /api/links | Yes | Create short link + QR |
| GET | /api/links | Yes | Get all user's links |
| GET | /api/links/:code/qr | Yes | Get QR for existing link |
| DELETE | /api/links/:id | Yes | Delete a link |
| GET | /:shortCode | No | Redirect to original URL |
