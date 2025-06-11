const fs = require("fs");
const jwt = require("jsonwebtoken");
const path = require("path");
const dotenv = require("dotenv");
const axios = require("axios");

let PROFESSOR_SERVICE_URL_FROM_CONSTS,
    STUDENT_SERVICE_URL_FROM_CONSTS,
    ROLES_FROM_CONSTS,
    AUTH_SERVICE_JWKS_URL_FROM_CONSTS;

try {
    const consts = require("../../../consts");

    PROFESSOR_SERVICE_URL_FROM_CONSTS = consts.PROFESSOR_SERVICE_URL;
    STUDENT_SERVICE_URL_FROM_CONSTS = consts.STUDENT_SERVICE_URL;
    ROLES_FROM_CONSTS = consts.ROLES;
    AUTH_SERVICE_JWKS_URL_FROM_CONSTS = consts.AUTH_SERVICE_JWKS_URL;
} catch (e) {
    console.error("[authService/util.js] CRITICAL ERROR: Could not require or read from ../../../consts.js", e);
    PROFESSOR_SERVICE_URL_FROM_CONSTS = undefined;
    STUDENT_SERVICE_URL_FROM_CONSTS = undefined;
    ROLES_FROM_CONSTS = {};
    AUTH_SERVICE_JWKS_URL_FROM_CONSTS = undefined;
}

dotenv.config();

const keysDirectoryPath = path.join(__dirname, "keys");

let privateKey;
try {
    privateKey = fs.readFileSync(
        path.join(keysDirectoryPath, "private.key"),
        "utf8"
    );
} catch (e) {
    console.error(`[authService/util.js] CRITICAL ERROR: Could not read private.key from ${keysDirectoryPath}`, e);
}

const kid = "1"; // Key ID for JWKS

async function generateJWTWithPrivateKey(payload) {
    if (!privateKey) {
        console.error("[authService/util.js] Private key is not loaded. Cannot generate JWT.");
        throw new Error("JWT generation failed due to missing private key.");
    }

    try {
        const authServicePort = process.env.PORT || 5001;
        const jku = `http://localhost:${authServicePort}/.well-known/jwks.json`;

        const token = jwt.sign(payload, privateKey, {
            algorithm: "RS256",
            expiresIn: "1h",
            header: { kid: kid, jku: jku },
        });

        return token;
    } catch (error) {
        console.error("[authService/util.js] Error generating JWT:", error);
        throw new Error("Failed to generate JWT.");
    }
}

async function fetchStudents() {
    if (!STUDENT_SERVICE_URL_FROM_CONSTS) {
        console.error("[authService/util.js] STUDENT_SERVICE_URL is undefined. Cannot fetch students.");
        throw new Error("Student service URL is not configured.");
    }

    try {
        const response = await axios.get(STUDENT_SERVICE_URL_FROM_CONSTS);
        return response.data;
    } catch (error) {
        console.error(`[authService/util.js] Error fetching students from ${STUDENT_SERVICE_URL_FROM_CONSTS}:`, error.message);
        if (error.isAxiosError) console.error("Axios error details:", error.toJSON());
        throw new Error(`Failed to fetch students. ${error.message}`);
    }
}

async function fetchProfessors() {
    if (!PROFESSOR_SERVICE_URL_FROM_CONSTS) {
        console.error("[authService/util.js] PROFESSOR_SERVICE_URL is undefined. Cannot fetch professors.");
        throw new Error("Professor service URL is not configured.");
    }

    console.log(`[authService/util.js] Fetching professors from: ${PROFESSOR_SERVICE_URL_FROM_CONSTS}`);

    try {
        const response = await axios.get(PROFESSOR_SERVICE_URL_FROM_CONSTS);
        return response.data;
    } catch (error) {
        console.error(`[authService/util.js] Error fetching professors from ${PROFESSOR_SERVICE_URL_FROM_CONSTS}:`, error.message);
        if (error.isAxiosError) console.error("Axios error details:", error.toJSON());
        throw new Error(`Failed to fetch professors. ${error.message}`);
    }
}

module.exports = {
    generateJWTWithPrivateKey,
    fetchStudents,
    fetchProfessors,
    kid,
    ROLES: ROLES_FROM_CONSTS,
};
