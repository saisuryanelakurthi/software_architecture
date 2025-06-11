const express = require("express");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");
const publicKeyRoute = require("./routes/auth/publicKeyRoute");
const loginRoute = require("./routes/auth/loginRoute");
const { correlationIdMiddleware } = require("../correlationId");

dotenv.config();


const app = express();

const limiter = rateLimit({
  windowMs: 60 * 1000 * 1000, 
  max: 10, 
  message: "Too many requests, please try again later.",
  headers: true, 
});
// Middleware
app.use(express.json());
app.use(correlationIdMiddleware);

// Public Key
app.use("/.well-known/jwks.json", publicKeyRoute);

// Routes
app.use("/api/login", limiter, loginRoute);

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Auth Server running on port ${PORT}`);
});
