const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");

const router = express.Router();

// Validation helper
function validate(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ error: errors.array()[0].msg });
        return false;
    }
    return true;
}

router.post(
    "/register",
    [
        body("email").isEmail().normalizeEmail().withMessage("A valid email is required"),
        body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
        body("name").trim().notEmpty().withMessage("Name is required").isLength({ max: 100 }),
    ],
    async (req, res, next) => {
        if (!validate(req, res)) return;
        try {
            const { email, password, name } = req.body;

            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(409).json({ error: "Email already registered" });
            }

            const hash = await bcrypt.hash(password, 12);
            const user = new User({ email, name: name.trim(), hash });
            await user.save();
            res.status(201).json({ message: "User registered" });
        } catch (err) {
            next(err);
        }
    });

router.post(
    "/login",
    [
        body("email").isEmail().normalizeEmail().withMessage("A valid email is required"),
        body("password").notEmpty().withMessage("Password is required"),
    ],
    async (req, res, next) => {
        if (!validate(req, res)) return;
        try {
            const { email, password } = req.body;
            const user = await User.findOne({ email });
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
