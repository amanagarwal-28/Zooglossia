const { Worker } = require("bullmq");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const { getRedis } = require("./redis");
const logger = require("../logger");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
const IOT_FIELDS = ["time_of_day", "last_meal_hours_ago", "motion_level", "room_temp_c", "activity_level"];

function startWorker(io) {
    const worker = new Worker(
        "analysis",
        async (job) => {
            const { filePath, originalName, mimetype, userEmail, iotParams } = job.data;

            const form = new FormData();
            form.append("audio", fs.createReadStream(filePath), {
                filename: originalName || "audio.wav",
                contentType: mimetype,
            });
            for (const field of IOT_FIELDS) {
                if (iotParams[field] !== undefined) {
                    form.append(field, String(iotParams[field]));
                }
            }

            let result;
            try {
                const aiResponse = await axios.post(`${AI_SERVICE_URL}/analyze`, form, {
                    headers: form.getHeaders(),
                    timeout: 300_000,
                });
                result = aiResponse.data;
            } finally {
                // Always clean up temp file
                fs.unlink(filePath, () => {});
            }

            // Emit real-time result to user's WebSocket room
            if (io) {
                io.to(userEmail).emit("analysis_complete", { userId: userEmail, result });
            }

            return result;
        },
        {
            connection: getRedis(),
            concurrency: 2,
        }
    );

    worker.on("failed", (job, err) => {
        logger.error("[queue] job failed", { jobId: job?.id, error: err.message });
        if (io && job?.data?.userEmail) {
            io.to(job.data.userEmail).emit("analysis_failed", { jobId: job.id, error: err.message });
        }
    });

    worker.on("completed", (job) => {
        logger.info("[queue] job completed", { jobId: job.id });
    });

    logger.info("[queue] analysis worker started");
    return worker;
}

module.exports = { startWorker };
