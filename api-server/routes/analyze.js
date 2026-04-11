const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const multer = require("multer");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// Handle multer file-too-large error before it reaches the global handler
function handleMulterError(err, req, res, next) {
    if (err?.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "Audio file too large (max 20 MB)" });
    }
    next(err);
}

// POST /analyze  — multipart: audio file + optional IoT fields
router.post("/", upload.single("audio"), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "audio file is required" });
        }

        const form = new FormData();
        form.append("audio", req.file.buffer, {
            filename: req.file.originalname || "audio.wav",
            contentType: req.file.mimetype,
        });

        // Forward any IoT fields sent by client
        const iotFields = ["time_of_day", "last_meal_hours_ago", "motion_level", "room_temp_c", "activity_level"];
        for (const field of iotFields) {
            if (req.body[field] !== undefined) {
                form.append(field, String(req.body[field]));
            }
        }

        const aiResponse = await axios.post(`${AI_SERVICE_URL}/analyze`, form, {
            headers: form.getHeaders(),
            timeout: 120_000,
        });

        const result = aiResponse.data;

        // Push real-time event to connected WebSocket clients
        const io = req.app.get("io");
        io.to(req.user.email).emit("analysis_complete", { userId: req.user.email, result });

        res.json(result);
    } catch (err) {
        if (err.response) {
            const data = err.response.data;
            const msg = data?.detail || data?.error || (typeof data === "string" ? data : JSON.stringify(data));
            return res.status(err.response.status).json({ error: msg });
        }
        next(err);
    }
});

router.use(handleMulterError);

module.exports = router;
