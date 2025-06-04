const express = require("express");
const bcrypt = require("bcryptjs"); 
const dotenv = require("dotenv");

const {
  generateJWTWithPrivateKey, 
  fetchStudents,
  fetchProfessors,
} = require("./util"); 
const { ROLES } = require("../../../consts");
const {authServiceLogger:logger}= require("../../../logger");

const router = express.Router();

dotenv.config();

// Student Login
router.post("/student", async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // Get the list of all students
    const students = await fetchStudents(); 
    const student = students.find((s) => s.email === email);

    if (!student) {
      logger.error('Password does not match')
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Compare submitted password with stored hashed password
    const isPasswordValid = await bcrypt.compare(password, student.password); //
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate JWT
    const token = await generateJWTWithPrivateKey({ 
      userId: student._id, 
      email: student.email,
      role: ROLES.STUDENT,
    });
    logger.info('user with ${email} logged in successfully');
    res.json({ token });

  } catch (error) {
    console.error("Student login error:", error);
    res.status(500).json({ message: "Server error during student login" });
  }
});

// Professor Login
router.post("/professor", async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // Fetch professors
    const professors = await fetchProfessors(); 
    const professor = professors.find((p) => p.email === email);

    if (!professor) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, professor.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate JWT
    const token = await generateJWTWithPrivateKey({ 
      userId: professor._id, 
      email: professor.email,
      roles: [ROLES.PROFESSOR],
    });
    res.json({ token });

  } catch (error) {
    console.error("Professor login error:", error);
    res.status(500).json({ message: "Server error during professor login" });
  }
});

module.exports = router;