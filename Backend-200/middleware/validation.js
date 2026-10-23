const validation = require("../utils/validation");

/**
 * Middleware for validating request body
 * @param {Object} options - Validation options
 * @param {Array<string>} options.requiredFields - Required fields to check
 * @param {Function} options.customValidator - Custom validation function
 * @returns {Function} Express middleware
 */
const validateRequestBody = (options = {}) => {
    return (req, res, next) => {
        const { requiredFields = [], customValidator } = options;

        // Check required fields
        if (requiredFields.length > 0) {
            const result = validation.validateRequired(req.body, requiredFields);
            if (!result.isValid) {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors: result.errors
                });
            }
        }

        // Run custom validator if provided
        if (customValidator && typeof customValidator === "function") {
            const result = customValidator(req.body);
            if (!result.isValid) {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors: result.errors
                });
            }
        }

        next();
    };
};

/**
 * Middleware for sanitizing input strings
 */
const sanitizeInput = (req, res, next) => {
    if (req.body && typeof req.body === "object") {
        Object.keys(req.body).forEach((key) => {
            if (typeof req.body[key] === "string") {
                req.body[key] = validation.sanitizeString(req.body[key]);
            }
        });
    }
    next();
};

module.exports = {
    validateRequestBody,
    sanitizeInput
};
