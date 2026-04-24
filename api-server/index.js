require("dotenv").config();
const { initSentry, Sentry } = require("./sentry");
initSentry(); // must be before any other imports that touch express

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const logger = require("./logger");
const authRoutes = require("./routes/auth");
const analyzeRoutes = require("./routes/analyze");
const petRoutes = require("./routes/pets");
const authMiddleware = require("./middleware/auth");
const errorHandler = require("./middleware/errorHandler");
const { startWorker } = require("./queue/analysisWorker");

const app = express();
const server = http.createServer(app);

// ─── Security Headers ────────────────────────────────────────────────────────
app.use(helmet({
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    contentSecurityPolicy: false,
}));

// Enforce HTTPS in production
app.use((req, res, next) => {
    if (process.env.NODE_ENV === "production" && req.headers["x-forwarded-proto"] !== "https") {
        return res.redirect(301, `https://${req.hostname}${req.url}`);
    }
    next();
});

// Attach unique request ID for tracing
app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    res.setHeader("X-Request-ID", req.id);
    next();
});

// Request logging
app.use((req, _res, next) => {
    logger.info("request", { method: req.method, url: req.url, requestId: req.id });
    next();
});

// ─── MongoDB Connection ──────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/zooglossia";
mongoose.connect(MONGO_URI)
    .then(() => logger.info("[db] MongoDB connected"))
    .catch((err) => logger.error("[db] MongoDB connection error", { message: err.message }));

// ─── Socket.IO ───────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : [];

const resolveCorsOrigin = (origin, callback) => {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== "production") return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS"));
};

const io = new Server(server, { cors: { origin: resolveCorsOrigin } });
app.set("io", io);

io.use((socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error("Unauthorized"));
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = { email: decoded.email, name: decoded.name };
        next();
    } catch {
        next(new Error("Unauthorized"));
    }
});

io.on("connection", (socket) => {
    if (socket.user?.email) socket.join(socket.user.email);
    logger.info("[ws] client connected", { socketId: socket.id, email: socket.user?.email });
    socket.on("disconnect", () =>
        logger.info("[ws] client disconnected", { socketId: socket.id })
    );
});

// ─── Analysis Job Queue ──────────────────────────────────────────────────────
startWorker(io);

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
    origin: resolveCorsOrigin,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));

// ─── Rate Limiting ──────────────────────────────────────────────────────────
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
});
const analyzeLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Analysis rate limit exceeded, please slow down." },
});

app.use(express.json());

// ─── Routes ─────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", service: "zooglossia-api" }));
app.use("/v1/auth", authLimiter, authRoutes);
app.use("/v1/pets", authMiddleware, petRoutes);
app.use("/v1/analyze", authMiddleware, analyzeLimiter, analyzeRoutes);

// ─── Sentry error handler (before custom errorHandler) ──────────────────────
if (process.env.SENTRY_DSN_API) {
    app.use(Sentry.expressErrorHandler());
}

// ─── Error handler ──────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
    logger.info(`[api] Zooglossia API listening on port ${PORT}`)
);

module.exports = { app, server };
