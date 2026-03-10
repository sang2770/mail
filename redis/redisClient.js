const { createClient } = require("redis");

let redisClient;

function createMemoryStore() {
    const store = new Map();
    const expiryTimers = new Map();

    return {
        async get(key) {
            return store.has(key) ? store.get(key) : null;
        },
        async setEx(key, ttlSeconds, value) {
            store.set(key, value);

            if (expiryTimers.has(key)) {
                clearTimeout(expiryTimers.get(key));
            }

            const timeout = setTimeout(() => {
                store.delete(key);
                expiryTimers.delete(key);
            }, ttlSeconds * 1000);

            expiryTimers.set(key, timeout);
        },
        async del(key) {
            store.delete(key);
            if (expiryTimers.has(key)) {
                clearTimeout(expiryTimers.get(key));
                expiryTimers.delete(key);
            }
        },
    };
}

async function connectRedis() {
    if (redisClient) {
        return redisClient;
    }

    const useRedis = process.env.USE_REDIS === "true";
    if (!useRedis) {
        console.warn("USE_REDIS is not true, using in-memory store");
        redisClient = createMemoryStore();
        return redisClient;
    }

    const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    const client = createClient({
        url: redisUrl,
        socket: {
            connectTimeout: 3000,
            reconnectStrategy: () => false,
        },
    });

    client.on("error", (error) => {
        console.error("Redis error:", error.message);
    });

    try {
        await client.connect();
        redisClient = client;
        console.log("Redis connected");
    } catch (error) {
        console.warn("Redis unavailable, using in-memory store:", error.message);
        redisClient = createMemoryStore();
    }

    return redisClient;
}

function getRedisClient() {
    if (!redisClient) {
        throw new Error("Redis client not initialized");
    }
    return redisClient;
}

module.exports = {
    connectRedis,
    getRedisClient,
};
