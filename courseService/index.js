const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

const courseRoutes = require("./routes/courseRoute");

dotenv.config();


const app = express();


connectDB();

app.use(express.json());

app.use("/api/courses", courseRoutes);


const PORT = process.env.PORT || 5004;
app.listen(PORT, () => {
  console.log(`Course Server running on port ${PORT}`);
});
