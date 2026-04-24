const Redis = require("ioredis");

let _client = null;

function getRedis() {
    if (!_client) {
        const url = process.env.REDIS_URL || "redis://localhost:6379";
        _client = new Redis(url, {
            maxRetriesPerRequest: null, // required by BullMQ
            enableReadyCheck: false,
        });
        _client.on("error", (err) => console.error("[redis] connection error:", err.message));
    }
    return _client;
}

module.exports = { getRedis };
