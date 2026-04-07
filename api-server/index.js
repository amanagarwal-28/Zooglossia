require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const authRoutes = require("./routes/auth");
const analyzeRoutes = require("./routes/analyze");
const petRoutes = require("./routes/pets");
const authMiddleware = require("./middleware/auth");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const server = http.createServer(app);

// ─── Socket.IO (real-time analysis push) ────────────────────────────────────
const io = new Server(server, {
    cors: { origin: process.env.ALLOWED_ORIGINS || "*" },
});
app.set("io", io);
io.on("connection", (socket) => {
    console.info(`[ws] client connected: ${socket.id}`);
    socket.on("disconnect", () =>
        console.info(`[ws] client disconnected: ${socket.id}`)
    );
});

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.ALLOWED_ORIGINS || "*" }));
app.use(express.json());

// ─── Routes ─────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", service: "zooglossia-api" }));
app.use("/auth", authRoutes);
app.use("/pets", authMiddleware, petRoutes);
app.use("/analyze", authMiddleware, analyzeRoutes);

// ─── Error handler (must be last) ───────────────────────────────────────────
app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
    console.info(`[api] Zooglossia API listening on port ${PORT}`)
);

module.exports = { app, server };
