const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();

// In-memory user store — replace with MongoDB model when DB is connected
const users = new Map();

router.post("/register", async (req, res, next) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ error: "email, password, and name are required" });
        }
        if (users.has(email)) {
            return res.status(409).json({ error: "Email already registered" });
        }
        const hash = await bcrypt.hash(password, 12);
        users.set(email, { email, name, hash });
        res.status(201).json({ message: "User registered" });
    } catch (err) {
        next(err);
    }
});

router.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = users.get(email);
        if (!user || !(await bcrypt.compare(password, user.hash))) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const token = jwt.sign(
            { email: user.email, name: user.name },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );
        res.json({ token, name: user.name });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
