const express = require("express");
const Professor = require("../models/professor"); // Your Professor model
// const bcrypt = require("bcrypt"); // bcrypt is not directly used in this file for GET, only in model's pre-save
// const { verifyRole, restrictProfessorToOwnData } = require("./auth/util"); // Uncomment if you have these utils
// const { ROLES } = require("../../consts"); // Uncomment if you have these utils
const router = express.Router();

// POST a new professor
router.post("/", async (req, res) => {
    const { name, email, phone, password } = req.body;

    // Basic validation
    if (!name || !email || !phone || !password) {
        return res.status(400).json({ message: "Please provide name, email, phone, and password" });
    }

    try {
        // Check if professor already exists
        const existingProfessor = await Professor.findOne({ email });
        if (existingProfessor) {
            return res.status(400).json({ message: "Professor with this email already exists" });
        }

        // Create a new professor instance (password will be hashed by the pre-save hook in your model)
        const newProfessor = new Professor({
            name,
            email,
            phone,
            password,
        });

        // Save the new professor
        const savedProfessor = await newProfessor.save();

        // Respond with the created professor (excluding password for this specific response)
        const professorResponse = savedProfessor.toObject();
        delete professorResponse.password; 
        
        res.status(201).json(professorResponse);

    } catch (error) {
        console.error("Error creating professor:", error);
        res.status(500).json({ message: "Server error while creating professor" });
    }
});

// GET all professors
// This route is called by authService to get professor data for login.
// It MUST include the password hash for bcrypt.compare to work in authService.
router.get("/", async (req, res) => {
    try {
        // REMOVED .select('-password') so authService can get the hashed password
        const professors = await Professor.find(); 
        res.status(200).json(professors);
    } catch (error) {
        console.error("Error fetching professors:", error);
        res.status(500).json({ message: "Server error while fetching professors" });
    }
});

// Example: GET a single professor by ID (you might want to exclude password here for general use)
router.get("/:id", async (req, res) => {
    try {
        // For single GETs that are not for auth purposes, excluding password is good.
        const professor = await Professor.findById(req.params.id).select('-password'); 
        if (!professor) {
            return res.status(404).json({ message: "Professor not found" });
        }
        res.status(200).json(professor);
    } catch (error) {
        console.error("Error fetching professor by ID:", error);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: "Invalid professor ID format" });
        }
        res.status(500).json({ message: "Server error while fetching professor" });
    }
});

// Add other PUT, DELETE routes as needed.

module.exports = router;
