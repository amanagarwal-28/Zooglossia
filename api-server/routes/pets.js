const express = require("express");
const Pet = require("../models/Pet");
const logger = require("../logger");

const router = express.Router();

router.get("/", async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            Pet.find({ owner: req.user.email }).skip(skip).limit(limit).sort({ createdAt: -1 }),
            Pet.countDocuments({ owner: req.user.email }),
        ]);

        res.json({ data, page, limit, total, pages: Math.ceil(total / limit) });
    } catch (err) {
        next(err);
    }
});

router.post("/", async (req, res, next) => {
    try {
        const { name, species, breed, age_years } = req.body;
        if (!name || !species) {
            return res.status(400).json({ error: "name and species are required" });
        }

        const pet = new Pet({
            owner: req.user.email,
            name,
            species: species.toLowerCase(),
            breed: breed || null,
            age_years: age_years || null,
        });

        await pet.save();
        logger.info("[pets] pet created", { petId: pet._id, owner: req.user.email });
        res.status(201).json(pet);
    } catch (err) {
        next(err);
    }
});

router.get("/:id", async (req, res, next) => {
    try {
        const pet = await Pet.findOne({ _id: req.params.id, owner: req.user.email });
        if (!pet) return res.status(404).json({ error: "Pet not found" });
        res.json(pet);
    } catch (err) {
        next(err);
    }
});

router.delete("/:id", async (req, res, next) => {
    try {
        const pet = await Pet.findOneAndDelete({ _id: req.params.id, owner: req.user.email });
        if (!pet) return res.status(404).json({ error: "Pet not found" });
        logger.info("[pets] pet deleted", { petId: req.params.id, owner: req.user.email });
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});

module.exports = router;
