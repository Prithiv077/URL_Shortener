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