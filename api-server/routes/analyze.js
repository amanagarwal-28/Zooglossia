const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const multer = require("multer");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

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
        io.emit("analysis_complete", { userId: req.user.email, result });

        res.json(result);
    } catch (err) {
        if (err.response) {
            return res.status(err.response.status).json({ error: err.response.data });
        }
        next(err);
    }
});

module.exports = router;
