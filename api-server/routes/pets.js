const express = require("express");
const Pet = require("../models/Pet");

const router = express.Router();

router.get("/", async (req, res, next) => {
    try {
        const userPets = await Pet.find({ owner: req.user.email });
        res.json(userPets);
    } catch (err) {
        next(err);
    }
});

router.post("/", async (req, res, next) => {
    try {
        console.log("[pets] POST /pets request from:", req.user.email);
        console.log("[pets] Body:", req.body);

        const { name, species, breed, age_years } = req.body;
        if (!name || !species) {
            console.log("[pets] Validation failed: missing name or species");
            return res.status(400).json({ error: "name and species are required" });
        }

        const pet = new Pet({
            owner: req.user.email,
            name,
            species: species.toLowerCase(),
            breed: breed || null,
            age_years: age_years || null,
        });

        console.log("[pets] Saving pet:", pet);
        await pet.save();
        console.log("[pets] Pet saved successfully:", pet._id);
        res.status(201).json(pet);
    } catch (err) {
        console.error("[pets] Error in POST /pets:", err);
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
        res.status(204).send();
    } catch (err) {
        next(err);
    }
});

module.exports = router;
