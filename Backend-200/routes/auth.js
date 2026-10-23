const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const auth = require("../middleware/auth");
const { validateRequestBody, sanitizeInput } = require("../middleware/validation");
const validation = require("../utils/validation");

// Sanitize all inputs
router.use(sanitizeInput);

// Get SQL Server databases for login/signup selection
router.get("/databases", authController.getDatabases);

// Get all agents available for signup
router.get("/agents", authController.getAgents);

// Signup
router.post(
    "/signup",
    validateRequestBody({
        customValidator: validation.validateSignupData
    }),
    authController.signup
);

// Login
router.post(
    "/login",
    validateRequestBody({
        customValidator: validation.validateLoginCredentials
    }),
    authController.login
);

// Pages available to the logged-in user's role
router.get("/pages/access", auth, authController.getAccessiblePages);

// Validate reset password details
router.post(
    "/validate-reset-details",
    validateRequestBody({
        customValidator: validation.validateResetIdentityData
    }),
    authController.validateResetDetails
);

// Reset password
router.post(
    "/reset-password",
    validateRequestBody({
        customValidator: validation.validateResetPasswordData
    }),
    authController.resetPassword
);

// Insert login log
router.post("/login-log", authController.insertLoginLog);

// Logout
router.put("/login-log/logout", authController.logout);
router.post("/login-log/logout", express.text({ type: "text/plain" }), authController.logout);

module.exports = router;
