const express = require("express");
const QRCode = require("qrcode");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const encode = require("../base62");
const router = express.Router();

// ─── AUTH MIDDLEWARE ─────────────────────────────────────────
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader)
    return res.status(401).json({ error: "No token provided" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};


// ─── CREATE SHORT LINK ────────────────────────────────────────
router.post("/", authenticate, async (req, res) => {
  const { originalUrl, expiresAt, customAlias } = req.body;

if (!originalUrl)
    return res.status(400).json({
        error: "Original URL is required"
    });

try {
    new URL(originalUrl);
} catch {
    return res.status(400).json({
        error: "Invalid URL"
    });
}

try {

    let shortCode;

    // ---------- CUSTOM ALIAS ----------
    if (customAlias && customAlias.trim()) {

        shortCode = customAlias.trim();

        const [existing] = await pool.execute(
            "SELECT id FROM links WHERE short_code=?",
            [shortCode]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                error: "Custom alias already exists"
            });
        }

        await pool.execute(
            `INSERT INTO links
            (user_id, short_code, original_url, expires_at)
            VALUES (?,?,?,?)`,
            [
                req.userId,
                shortCode,
                originalUrl,
                expiresAt || null
            ]
        );

    }

    // ---------- AUTO GENERATED ----------
    else {

        // temporary value
        const [result] = await pool.execute(
            `INSERT INTO links
            (user_id, short_code, original_url, expires_at)
            VALUES (?,?,?,?)`,
            [
                req.userId,
                null,
                originalUrl,
                expiresAt || null
            ]
        );

        shortCode = encode(result.insertId);

        await pool.execute(
            "UPDATE links SET short_code=? WHERE id=?",
            [
                shortCode,
                result.insertId
            ]
        );

    }

    const shortUrl =
        `${process.env.BASE_URL}/${shortCode}`;

    const qrCode =
        await QRCode.toDataURL(shortUrl);

    res.json({
        shortCode,
        shortUrl,
        originalUrl,
        qrCode
    });

}
catch(err){

    console.error(err);

    res.status(500).json({
        error:"Failed to create link"
    });

}
})

// ─── GET ALL LINKS ────────────────────────────────────────────
router.get("/", authenticate, async (req, res) => {
  try {
    const [links] = await pool.execute(
      `SELECT
        id,
        short_code,
        original_url,
        clicks,
        expires_at,
        created_at
      FROM links
      WHERE user_id = ?
      ORDER BY created_at DESC`,
      [req.userId]
    );

    const result = links.map((link) => ({
      ...link,
      shortUrl: `${process.env.BASE_URL}/${link.short_code}`,
    }));

    res.json(result);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to fetch links",
    });
  }
});

// ─── GET QR CODE ──────────────────────────────────────────────
router.get("/:shortCode/qr", authenticate, async (req, res) => {
  const { shortCode } = req.params;
  const shortUrl = `${process.env.BASE_URL}/${shortCode}`;

  try {
    const qrCode = await QRCode.toDataURL(shortUrl);

    res.json({ qrCode });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to generate QR code",
    });
  }
});

// ─── DELETE LINK ──────────────────────────────────────────────
router.delete("/:id", authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.execute(
      "SELECT * FROM links WHERE id = ? AND user_id = ?",
      [id, req.userId]
    );

    if (rows.length === 0)
      return res.status(404).json({
        error: "Link not found",
      });

    await pool.execute(
      "DELETE FROM links WHERE id = ?",
      [id]
    );

    res.json({
      message: "Link deleted successfully",
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to delete link",
    });
  }
});

module.exports = router;