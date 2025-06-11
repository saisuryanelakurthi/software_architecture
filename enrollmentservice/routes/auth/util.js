const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const axios = require("axios");
const fs = require("fs");
const path = require("path");


const { ROLES, STUDENT_SERVICE_URL, COURSE_SERVICE_URL } = require("../../../consts");
const { get } = require("http");

dotenv.config(); 

const axiosInstance = axios.create();


const kid = "1"; // Key ID for JWKS

const jku = `http://localhost:${process.env.PORT || 5002}/.well-known/jwks.json`; // Added fallback for PORT

// Define additional headers for JWTs issued by this service
const customHeadersForIssuedTokens = {
  kid,
  jku,
};

// Path private and public keys for this service
let privateKey;
let publicKey;

try {
  privateKey = fs.readFileSync(
    path.join(__dirname, "../auth/keys/private.key"),
    "utf8"
  );
  publicKey = fs.readFileSync(
    path.join(__dirname, "../auth/keys/public.key"),
    "utf8"
  );
} catch (err) {
  console.error("Failed to read private or public key files:", err.message);
  console.error("Ensure 'private.key' and 'public.key' exist in 'enrollmentService/routes/auth/keys/'");
  
}


/**
 * Fetch the JWKS from a given URI.
 * @param {string} jwksUri - The JWKS URI from the JWT header.
 * @returns {Promise<Array>} - A promise that resolves to the JWKS keys.
 */
async function fetchJWKS(jwksUri) {
  try {
    const response = await axiosInstance.get(jwksUri);
    if (response.data && response.data.keys) {
      return response.data.keys;
    }
    throw new Error("JWKS response did not contain keys.");
  } catch (error) {
    console.error(`Error fetching JWKS from ${jwksUri}:`, error.message);
    throw error; // Re-throw the error to be caught by the caller
  }
}

/**
 * Get the public key from JWKS.
 * @param {string} keyId - The key ID from the JWT header.
 * @param {Array} keys - The JWKS keys.
 * @returns {string} - The corresponding public key in PEM format.
 */
function getPublicKeyFromJWKS(keyId, keys) {
  const key = keys.find((k) => k.kid === keyId);

  if (!key) {
    throw new Error(`Unable to find a signing key in JWKS that matches the 'kid': ${keyId}`);
  }

  
  if (key.n) { 
      return `-----BEGIN PUBLIC KEY-----\n${key.n}\n-----END PUBLIC KEY-----`;
  }
  throw new Error("Public key format in JWKS not directly usable or 'n' component missing.");
}

/**
 * Verify a JWT token using the JWKS URI in the `jku` header.
 * @param {string} token - The JWT token to verify.
 * @returns {Promise<object>} - A promise that resolves to the decoded JWT payload.
 */
async function verifyJWTWithJWKS(token) {
  const decodedHeader = jwt.decode(token, { complete: true }).header;
  const { kid: tokenKid, alg, jku: tokenJku } = decodedHeader;

  if (!tokenKid || !tokenJku) {
    throw new Error("JWT header is missing 'kid' or 'jku'");
  }

  if (alg !== "RS256") {
    throw new Error(`Unsupported algorithm: ${alg}. Expected RS256.`);
  }

  const keys = await fetchJWKS(tokenJku);
  const signingPublicKey = getPublicKeyFromJWKS(tokenKid, keys);

  return jwt.verify(token, signingPublicKey, { algorithms: ["RS256"] });
}

/**
 * Generate a JWT using this service's private key.
 * @param {object} payload - The payload for the JWT.
 * @returns {string} - The generated JWT.
 */
function generateJWTWithPrivateKey(payload) {
  if (!privateKey) {
    console.error("Private key is not loaded. Cannot generate JWT.");
    throw new Error("Private key is not available for JWT generation.");
  }
  // Sign the JWT using RS256 (asymmetric encryption)
  const token = jwt.sign(payload, privateKey, {
    algorithm: "RS256",
    header: customHeadersForIssuedTokens, // Use headers specific to tokens issued by this service
    expiresIn: "6h", // Set expiration
  });
  return token;
}

// Role-based Access Control Middleware
function verifyRole(requiredRoles) {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Authorization token is missing or malformed (Bearer token expected)" });
    }
    const token = authHeader.split(" ")[1];

    try {
      // Step 1: Verify the JWT token using JWKS from the token's 'jku' header
      const decoded = await verifyJWTWithJWKS(token);
      req.user = decoded; // Attach the decoded payload (user data) to the request object

      // Step 2: Check if the user has any of the required roles
      const userRoles = req.user.roles || []; // Ensure roles array exists
      const hasRequiredRole = userRoles.some((role) =>
        requiredRoles.includes(role)
      );

      if (hasRequiredRole) {
        return next(); // User has at least one of the required roles, so proceed
      } else {
        return res
          .status(403)
          .json({ message: "Access forbidden: Insufficient role" });
      }
    } catch (error) {
      console.error("Token verification or role check failed:", error.message);
      // Distinguish between different types of errors if possible
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: "Token expired", error: error.message });
      }
      if (error.message.includes("Unable to find a signing key") || error.message.includes("JWT header is missing")) {
         return res.status(403).json({ message: "Invalid token: Key or header issue", error: error.message });
      }
      return res
        .status(403) // Using 403 for "Forbidden" as authentication might be valid but token content/verification failed
        .json({ message: "Invalid or expired token", error: error.message });
    }
  };
}

async function fetchStudents() {
  console.log("Attempting to fetch students from:", STUDENT_SERVICE_URL);
  if (!STUDENT_SERVICE_URL || STUDENT_SERVICE_URL === "undefined/api/students" || STUDENT_SERVICE_URL === "undefined") {
    console.error("STUDENT_SERVICE_URL is not defined or invalid:", STUDENT_SERVICE_URL);
    throw new Error("Student service URL is misconfigured.");
  }
  try {
    const token = generateJWTWithPrivateKey({
      
      serviceName: "enrollmentService", 
      roles: [ROLES.ENROLLMENT_SERVICE], 
    });

    const response = await axiosInstance.get(STUDENT_SERVICE_URL, { 
      headers: {
        Authorization: `Bearer ${token}`,
        
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching students from ${STUDENT_SERVICE_URL}:`, error.response ? error.response.data : error.message);
    throw new Error(`Failed to fetch students from student service. Status: ${error.response ? error.response.status : 'N/A'}`);
  }
}

async function fetchCourses() {
  console.log("Attempting to fetch courses from:", COURSE_SERVICE_URL);
   if (!COURSE_SERVICE_URL || COURSE_SERVICE_URL === "undefined/api/courses" || COURSE_SERVICE_URL === "undefined") {
    console.error("COURSE_SERVICE_URL is not defined or invalid:", COURSE_SERVICE_URL);
    throw new Error("Course service URL is misconfigured.");
  }
  try {
    const token = generateJWTWithPrivateKey({
      // Payload for the token this service sends to courseService
      serviceName: "enrollmentService",
      roles: [ROLES.ENROLLMENT_SERVICE],
    });

    const response = await axiosInstance.get(COURSE_SERVICE_URL, { // Use the correctly imported URL
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching courses from ${COURSE_SERVICE_URL}:`, error.response ? error.response.data : error.message);
    throw new Error(`Failed to fetch courses from course service. Status: ${error.response ? error.response.status : 'N/A'}`);
  }
}

// Middleware to restrict student access to their own data
function restrictStudentToOwnData(req, res, next) {
  // Ensure req.user and req.user.roles are populated by verifyRole middleware
  if (req.user && req.user.roles && req.user.roles.includes(ROLES.STUDENT)) {
    
    if (req.user.id !== req.params.id) {
      return res.status(403).json({
        message: "Access forbidden: You can only access your own data",
      });
    }
  }
  next();
}

module.exports = {
  kid, 
  publicKey, 
  verifyRole,
  restrictStudentToOwnData,
  fetchStudents,
  fetchCourses,
  generateJWTWithPrivateKey, 
  verifyJWTWithJWKS, 
};
