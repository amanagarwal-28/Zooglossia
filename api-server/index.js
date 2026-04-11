require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");

const authRoutes = require("./routes/auth");
const analyzeRoutes = require("./routes/analyze");
const petRoutes = require("./routes/pets");
const authMiddleware = require("./middleware/auth");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const server = http.createServer(app);

// ─── MongoDB Connection ──────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/zooglossia";
mongoose.connect(MONGO_URI)
    .then(() => console.info("[db] MongoDB connected"))
    .catch((err) => console.error("[db] MongoDB connection error:", err.message));

// ─── Socket.IO (real-time analysis push) ────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : [];

const resolveCorsOrigin = (origin, callback) => {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== "production") return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS"));
};

const io = new Server(server, {
    cors: { origin: resolveCorsOrigin },
});
app.set("io", io);

io.use((socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error("Unauthorized"));
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = { email: decoded.email, name: decoded.name };
        next();
    } catch (_err) {
        next(new Error("Unauthorized"));
    }
});

io.on("connection", (socket) => {
    if (socket.user?.email) {
        socket.join(socket.user.email);
    }
    console.info(`[ws] client connected: ${socket.id} (${socket.user?.email || "unknown"})`);
    socket.on("disconnect", () =>
        console.info(`[ws] client disconnected: ${socket.id}`)
    );
});

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
    origin: resolveCorsOrigin,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));

// ─── Rate Limiting ──────────────────────────────────────────────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
});
const analyzeLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Analysis rate limit exceeded, please slow down." },
});

app.use(express.json());

// ─── Routes ─────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", service: "zooglossia-api" }));
app.use("/auth", authLimiter, authRoutes);
app.use("/pets", authMiddleware, petRoutes);
app.use("/analyze", authMiddleware, analyzeLimiter, analyzeRoutes);

// ─── Error handler (must be last) ───────────────────────────────────────────
app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
    console.info(`[api] Zooglossia API listening on port ${PORT}`)
);

module.exports = { app, server };
