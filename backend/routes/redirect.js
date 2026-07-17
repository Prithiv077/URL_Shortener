const express = require("express");
const pool = require("../db");
const { getChannel } = require("../rabbitMQ");
const { redisClient } = require("../redis");

const router = express.Router();

router.get("/:shortCode", async (req, res) => {
    const { shortCode } = req.params;

    if (shortCode.startsWith("api")) {
        return res.status(404).json({ error: "Not found" });
    }

    try {
        let link;

        // ---------- CHECK REDIS ----------
        const cached = await redisClient.get(shortCode);

        if (cached) {
            console.log("Cache Hit");
            link = JSON.parse(cached);
        } else {
            console.log("Cache Miss");

            const [rows] = await pool.execute(
                "SELECT * FROM links WHERE short_code = ?",
                [shortCode]
            );

            if (rows.length === 0) {
                return res.status(404).send("Short link not found");
            }

            link = rows[0];

            await redisClient.set(
                shortCode,
                JSON.stringify(link),
                {
                    EX: 3600
                }
            );
        }

        // ---------- EXPIRY CHECK ----------
        if (link.expires_at && new Date(link.expires_at) < new Date()) {
            return res.status(410).send("This link has expired");
        }

        // ---------- UPDATE CLICKS ----------
        const channel = getChannel();

        channel.sendToQueue(
        "clicks",
        Buffer.from(shortCode),
        {
          persistent: true
        }
);

        res.redirect(302, link.original_url);

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

module.exports = router;