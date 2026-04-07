const express = require("express");

const router = express.Router();

// Simple in-memory pet store — replace with MongoDB when DB is connected
const pets = new Map(); // key: `${userEmail}:${petId}`
let nextId = 1;

router.get("/", (req, res) => {
    const userPets = [...pets.entries()]
        .filter(([k]) => k.startsWith(req.user.email + ":"))
        .map(([, v]) => v);
    res.json(userPets);
});

router.post("/", (req, res) => {
    const { name, species, breed, age_years } = req.body;
    if (!name || !species) {
        return res.status(400).json({ error: "name and species are required" });
    }
    const pet = { id: nextId++, name, species, breed: breed || null, age_years: age_years || null, owner: req.user.email };
    pets.set(`${req.user.email}:${pet.id}`, pet);
    res.status(201).json(pet);
});

router.get("/:id", (req, res) => {
    const pet = pets.get(`${req.user.email}:${req.params.id}`);
    if (!pet) return res.status(404).json({ error: "Pet not found" });
    res.json(pet);
});

router.delete("/:id", (req, res) => {
    const key = `${req.user.email}:${req.params.id}`;
    if (!pets.has(key)) return res.status(404).json({ error: "Pet not found" });
    pets.delete(key);
    res.status(204).send();
});

module.exports = router;
