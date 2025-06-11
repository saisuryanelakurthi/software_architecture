const express = require("express");
const Enrollment = require("../models/enrollment");
const router = express.Router();
const {
  verifyRole,
  restrictStudentToOwnData, // Assuming this should be restrictUserToOwnEnrollmentData or similar if needed
  fetchStudents,
  fetchCourses,
} = require("./auth/util"); // Ensure path is correct
const { ROLES } = require("../../consts");

// Create a new enrollment
router.post(
  "/",
  verifyRole([ROLES.ADMIN, ROLES.STUDENT]), // Or ROLES.ADMIN, ROLES.PROFESSOR depending on who can enroll
  async (req, res) => {
    try {
      const { studentId, courseId } = req.body;

      if (!studentId || !courseId) {
        return res
          .status(400)
          .json({ message: "Student ID and Course ID are required" });
      }

      // Fetch and Validate Student (ensure fetchStudents in util.js works and authenticates)
      const students = await fetchStudents();
      const studentExists = students.some(s => s._id.toString() === studentId.toString()); 
      if (!studentExists) {
        return res.status(404).json({ message: "Student with the provided ID does not exist" });
      }

      // Fetch and Validate Course (ensure fetchCourses in util.js works and authenticates)
      const courses = await fetchCourses();
      const courseExists = courses.some(c => c._id.toString() === courseId.toString());
      if (!courseExists) {
        return res.status(404).json({ message: "Course with the provided ID does not exist" });
      }

      const enrollment = new Enrollment({ student: studentId, course: courseId });
      await enrollment.save();

      res.status(201).json(enrollment);
    } catch (error) {
      console.error("Error creating enrollment:", error);
      if (error.code === 11000) { // MongoDB duplicate key error
         return res.status(409).json({ message: "Student is already enrolled in this course." });
      }
      res.status(500).json({
        message: "Server Error: Unable to create enrollment",
        error: error.message,
      });
    }
  }
);

// Get all enrollments (Protected for Admin/Professor)
router.get(
  "/",
  verifyRole([ROLES.ADMIN, ROLES.PROFESSOR]),
  async (req, res) => {
    try {
      let enrollments = await Enrollment.find().populate('student', 'name email').populate('course', 'name code'); // Example of populating
      res.status(200).json(enrollments);
    } catch (error) {
      console.error("Error fetching all enrollments:", error);
      res.status(500).json({
        message: "Server Error: Unable to fetch enrollments",
        error: error.message,
      });
    }
  }
);

// Get a specific enrollment by ID
router.get(
  "/:id",
  verifyRole([ROLES.ADMIN, ROLES.PROFESSOR, ROLES.STUDENT]), 
  async (req, res) => {
    try {
        const enrollmentId = req.params.id;
        const enrollment = await Enrollment.findById(enrollmentId).populate('student', 'name email').populate('course', 'name code');
        
        if (!enrollment) {
            return res.status(404).json({ message: "Enrollment not found" });
        }

        // Ownership check for students
        if (req.user.roles.includes(ROLES.STUDENT) && enrollment.student._id.toString() !== req.user.userId) {
             return res.status(403).json({ message: "Access forbidden: You can only view your own enrollments." });
        }

        return res.status(200).json(enrollment);
    } catch (error) {
      console.error("Error fetching enrollment by ID:", error);
       if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: "Invalid enrollment ID format" });
      }
      res.status(500).json({
        message: "Server Error: Unable to fetch enrollment",
        error: error.message
      });
    }
  }
);

// Get enrollments by student ID
router.get(
  "/student/:id", 
  verifyRole([ROLES.ADMIN, ROLES.PROFESSOR, ROLES.STUDENT]),
  restrictStudentToOwnData, 
  async (req, res) => {
    try {
      // req.params.id here refers to the student's User ID (userId from JWT or DB ID)
      let enrollments = await Enrollment.find({ student: req.params.id })
                                        .populate('course', 'name code description schedule'); // Populate course details

      if (!enrollments || enrollments.length === 0) {
        return res
          .status(404)
          .json({ message: "No enrollments found for this student ID" });
      }
      

      res.status(200).json(enrollments);
    } catch (error) {
      console.error("Error fetching enrollments for student:", error);
      if (error.kind === 'ObjectId') {
           return res.status(400).json({ message: "Invalid student ID format" });
      }
      res.status(500).json({
        message: "Server Error: Unable to fetch enrollments for student",
        error: error.message
      });
    }
  }
);

// Get enrollments by course ID
router.get(
  "/course/:id", // This :id is the course's DB ID
  verifyRole([ROLES.ADMIN, ROLES.PROFESSOR]),
  async (req, res) => {
    try {
      const courseId = req.params.id;
      let enrollments = await Enrollment.find({ course: courseId })
                                        .populate('student', 'name email'); // Populate student details

      if (!enrollments || enrollments.length === 0) {
        return res
          .status(404)
          .json({ message: "No enrollments found for this course ID" });
      }
      
      res.status(200).json(enrollments);
    } catch (error) {
      console.error("Error fetching enrollments for course:", error);
       if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: "Invalid course ID format" });
      }
      res.status(500).json({
        message: "Server Error: Unable to fetch enrollments for course",
        error: error.message
      });
    }
  }
);

// Delete an enrollment by ID
router.delete(
  "/:id", // This :id is the enrollment's DB ID
  verifyRole([ROLES.ADMIN, ROLES.STUDENT]),
  async (req, res) => {
    try {
      const enrollmentId = req.params.id;
      const enrollment = await Enrollment.findById(enrollmentId);

      if (!enrollment) {
        return res.status(404).json({ message: "Enrollment not found" });
      }

      // Ownership Check for Students:
      if (req.user.roles.includes(ROLES.STUDENT) && enrollment.student.toString() !== req.user.userId) {
         return res.status(403).json({ message: "Access forbidden: You can only delete your own enrollments." });
      }

      await Enrollment.findByIdAndDelete(enrollmentId);

      res
        .status(200)
        .json({ message: "Enrollment deleted successfully", enrollment });
    } catch (error) {
      console.error("Error deleting enrollment:", error);
      if (error.kind === "ObjectId") {
        return res
          .status(400)
          .json({ message: "Invalid enrollment ID format" });
      }
      res.status(500).json({
        message: "Server Error: Unable to delete enrollment",
        error: error.message
      });
    }
  }
);

module.exports = router;