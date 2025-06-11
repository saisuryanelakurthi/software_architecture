const express = require("express");
const bcrypt = require("bcryptjs"); 
const { generateJWTWithPrivateKey, fetchStudents, fetchProfessors } = require("./util");
const { ROLES } = require("../../../consts");
const router = express.Router();
const {authServiceLogger} = require("../../../logging"); 

// Student Login
router.post("/student", async (req, res) => {
    const { email, password } = req.body;
    authServiceLogger.info({ message: "Student login attempt initiated", email: email, action: "student-login-attempt" });
    try {
        if (!email || !password) {
    authServiceLogger.warn({ message: "Student login failed: Email or password missing", email: email, action: "student-login-fail", reason: "missing_credentials" });
            return res.status(400).json({ message: "Email and password are required" });
        }
        const students = await fetchStudents();
        const student = students.find((s) => s.email === email);
        authServiceLogger.info({ message: "Fetched students for login attempt", email: email, action: "student-login-fetch-students" });
        if (!student || !student.password) { 
            return res.status(401).json({ message: "Invalid email or password (student not found or no password)" });
        }
        const isPasswordValid = await bcrypt.compare(password, student.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        const token = await generateJWTWithPrivateKey({
            userId: student._id,
            email: student.email,
            roles: [ROLES.STUDENT], 
        });
        authServiceLogger.info({ message: "Student login successful", email: student.email, userId: student._id, action: "student-login-success" });
        res.json({ token, user: { id: student._id, email: student.email, name: student.name, roles: [ROLES.STUDENT] } });
    } catch (error) {
        console.error("Student login error:", error);
        res.status(500).json({ message: "Server error during student login" });
    }
});

// Professor Login 
router.post("/professor", async (req, res) => {
    const { email, password } = req.body;
    authServiceLogger.info({ message: "Professor login attempt initiated", email: email, action: "professor-login-attempt" });
    try {
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }
        const professors = await fetchProfessors(); // This needs to return password hashes
        const professor = professors.find((p) => p.email === email);

        if (!professor || !professor.password) { // Check if professor and professor.password exist
            return res.status(401).json({ message: "Invalid email or password (professor not found or no password hash)" });
        }

        const isPasswordValid = await bcrypt.compare(password, professor.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        let userRoles = [ROLES.PROFESSOR]; 
        
        if (professor.email === "admin@example.com") {
            userRoles = [ROLES.ADMIN, ROLES.PROFESSOR]; 
        }

        const token = await generateJWTWithPrivateKey({
            userId: professor._id,
            email: professor.email,
            roles: userRoles, 
        });
        
      
        const userResponse = {
            id: professor._id,
            email: professor.email,
            name: professor.name,
            roles: userRoles
        };

        res.json({ token, user: userResponse });

    } catch (error) {
        console.error("Professor login error:", error);
        
        if (error.message && error.message.includes("fetchProfessors")) {
             return res.status(503).json({ message: "Service unavailable: Could not connect to professor service."});
        }
        res.status(500).json({ message: "Server error during professor login" });
    }
});

module.exports = router;
