const { Queue } = require("bullmq");
const { getRedis } = require("./redis");

let _queue = null;

function getQueue() {
    if (!_queue) {
        _queue = new Queue("analysis", {
            connection: getRedis(),
            defaultJobOptions: {
                attempts: 2,
                backoff: { type: "fixed", delay: 5000 },
                removeOnComplete: { age: 3600 },  // keep completed jobs 1 hour
                removeOnFail: { age: 86400 },      // keep failed jobs 24 hours
            },
        });
    }
    return _queue;
}

module.exports = { getQueue };
