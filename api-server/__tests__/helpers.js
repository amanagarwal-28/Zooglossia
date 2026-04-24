const express = require("express");
const authRoutes = require("../routes/auth");
const petRoutes = require("../routes/pets");
const analyzeRoutes = require("../routes/analyze");
const authMiddleware = require("../middleware/auth");
const errorHandler = require("../middleware/errorHandler");

function makeWavBuffer() {
    const sampleRate = 16000;
    const numSamples = 1600;
    const dataSize = numSamples * 2;
    const buf = Buffer.alloc(44 + dataSize);
    buf.write("RIFF", 0);
    buf.writeUInt32LE(36 + dataSize, 4);
    buf.write("WAVE", 8);
    buf.write("fmt ", 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(sampleRate, 24);
    buf.writeUInt32LE(sampleRate * 2, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write("data", 36);
    buf.writeUInt32LE(dataSize, 40);
    return buf;
}

function buildApp({ mockIo } = {}) {
    const app = express();
    app.use(express.json());

    const io = mockIo || { to: () => ({ emit: () => {} }) };
    app.set("io", io);

    app.use("/v1/auth", authRoutes);
    app.use("/v1/pets", authMiddleware, petRoutes);
    app.use("/v1/analyze", authMiddleware, analyzeRoutes);
    app.use(errorHandler);

    return app;
}

module.exports = { buildApp, makeWavBuffer };
