const mongoose = require("mongoose");

const petSchema = new mongoose.Schema(
    {
        owner: {
            type: String,
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
        },
        species: {
            type: String,
            required: true,
            lowercase: true,
        },
        breed: {
            type: String,
            default: null,
        },
        age_years: {
            type: Number,
            default: null,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Pet", petSchema);
