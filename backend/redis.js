const { createClient } = require("redis");

const redisClient = createClient({
    url: "redis://localhost:6379"
});

redisClient.on("error", (err) => {
    console.error("Redis Error:", err);
});

async function connectRedis() {
    if (!redisClient.isOpen) {
        await redisClient.connect();
        console.log("Redis Connected");
    }
}

module.exports = {
    redisClient,
    connectRedis
};