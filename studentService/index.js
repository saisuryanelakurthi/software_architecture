const express =require("express");
const dotEnv =require("dotenv");
const connectDB =require("./config/db");
const studentRoute =require("./routes/studentRoute");
 
 {}
dotEnv.config();
 
const app =express();
connectDB();
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use("/api/students",studentRoute);
const PORT = process.env.PORT || 5003;
 
app.listen(PORT,()=> {
    console.log(`student service is running on port ${PORT}`);
 
});