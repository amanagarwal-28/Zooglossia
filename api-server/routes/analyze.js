const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { getQueue } = require("../queue/analysisQueue");

const ALLOWED_AUDIO_TYPES = new Set([
    "audio/wav", "audio/x-wav", "audio/wave",
    "audio/flac", "audio/x-flac",
    "audio/mpeg", "audio/mp3",
    "audio/ogg", "audio/vorbis",
]);

const IOT_FIELDS = ["time_of_day", "last_meal_hours_ago", "motion_level", "room_temp_c", "activity_level"];

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter(_req, file, cb) {
        if (ALLOWED_AUDIO_TYPES.has(file.mimetype)) return cb(null, true);
        cb(Object.assign(new Error("Only audio files are accepted (wav, flac, mp3, ogg)"), { code: "INVALID_FILE_TYPE" }));
    },
});

function handleMulterError(err, req, res, next) {
    if (err?.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "Audio file too large (max 20 MB)" });
    }
    if (err?.code === "INVALID_FILE_TYPE") {
        return res.status(415).json({ error: err.message });
    }
    next(err);
}

// POST /analyze — enqueues job, returns jobId immediately
router.post("/", upload.single("audio"), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "audio file is required" });
        }

        // Write buffer to temp file so worker can stream it to AI service
        const ext = path.extname(req.file.originalname || ".wav");
        const filePath = path.join(os.tmpdir(), `zooglossia-${req.id || Date.now()}${ext}`);
        fs.writeFileSync(filePath, req.file.buffer);

        const iotParams = {};
        for (const field of IOT_FIELDS) {
            if (req.body[field] !== undefined) iotParams[field] = req.body[field];
        }

        const job = await getQueue().add("analyze", {
            filePath,
            originalName: req.file.originalname || "audio.wav",
            mimetype: req.file.mimetype,
            userEmail: req.user.email,
            iotParams,
        });

        res.status(202).json({
            jobId: job.id,
            message: "Analysis queued. Result will arrive via WebSocket (analysis_complete).",
        });
    } catch (err) {
        next(err);
    }
});

// GET /analyze/status/:jobId — poll job state
router.get("/status/:jobId", async (req, res, next) => {
    try {
        const job = await getQueue().getJob(req.params.jobId);
        if (!job) return res.status(404).json({ error: "Job not found" });

        const state = await job.getState();
        const response = { jobId: job.id, state };

        if (state === "completed") response.result = await job.returnvalue;
        if (state === "failed") response.error = job.failedReason;

        res.json(response);
    } catch (err) {
        next(err);
    }
});

router.use(handleMulterError);

module.exports = router;
