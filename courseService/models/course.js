const mongoose = require("mongoose");

//Course Schema
const courseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  code: {
    type: String,
    required: true,
    unique: true, 
  },
  description: {
    type: String,
    required: true,
  },
  schedule: {
    days: [String], //e.g. ['Monday', 'Wednesday']
    time: String, //e.g. '10:00 AM - 12:00 PM'
  },
  createdBy: {
    type: String,
    required: true,
  },
});

const Course = mongoose.model("Course", courseSchema);

module.exports = Course;
