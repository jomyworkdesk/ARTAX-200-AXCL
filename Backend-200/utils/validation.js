/**
 * Input validation utilities
 * Provides simple validation functions for common use cases
 */

/**
 * Validate an object has required fields
 * @param {Object} obj - The object to validate
 * @param {Array<string>} requiredFields - Array of required field names
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
const validateRequired = (obj, requiredFields) => {
    const errors = [];
    
    if (!obj || typeof obj !== "object") {
        return { isValid: false, errors: ["Input must be an object"] };
    }

    requiredFields.forEach((field) => {
        if (!obj[field] || (typeof obj[field] === "string" && obj[field].trim() === "")) {
            errors.push(`Field '${field}' is required`);
        }
    });

    return { isValid: errors.length === 0, errors };
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validate string length
 * @param {string} str - String to validate
 * @param {number} minLength - Minimum length
 * @param {number} maxLength - Maximum length
 * @returns {boolean}
 */
const validateStringLength = (str, minLength = 1, maxLength = 255) => {
    if (typeof str !== "string") return false;
    return str.length >= minLength && str.length <= maxLength;
};

/**
 * Validate number is within range
 * @param {number} num - Number to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {boolean}
 */
const validateNumberRange = (num, min, max) => {
    if (typeof num !== "number" || isNaN(num)) return false;
    return num >= min && num <= max;
};

/**
 * Sanitize string input (remove leading/trailing whitespace, prevent XSS)
 * @param {string} str - String to sanitize
 * @returns {string}
 */
const sanitizeString = (str) => {
    if (typeof str !== "string") return "";
    return str.trim().replace(/[<>]/g, "");
};

/**
 * Validate login credentials
 * @param {Object|string} payloadOrUsername - Login payload object or username
 * @param {string} passwordArg - Password when passing username/password separately
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
const validateLoginCredentials = (payloadOrUsername, passwordArg) => {
    const errors = [];
    const databaseName =
        typeof payloadOrUsername === "object" && payloadOrUsername !== null
            ? payloadOrUsername.DatabaseName
            : null;
    const username =
        typeof payloadOrUsername === "object" && payloadOrUsername !== null
            ? payloadOrUsername.UserName
            : payloadOrUsername;
    const password =
        typeof payloadOrUsername === "object" && payloadOrUsername !== null
            ? payloadOrUsername.Password
            : passwordArg;

    if (!username || typeof username !== "string" || username.trim() === "") {
        errors.push("Username is required");
    } else if (!validateStringLength(username, 3, 50)) {
        errors.push("Username must be between 3 and 50 characters");
    }

    if (!password || typeof password !== "string" || password.trim() === "") {
        errors.push("Password is required");
    } else if (!validateStringLength(password, 6, 255)) {
        errors.push("Password must be between 6 and 255 characters");
    }

    if (!databaseName || typeof databaseName !== "string" || databaseName.trim() === "") {
        errors.push("DatabaseName is required");
    } else if (!validateStringLength(databaseName, 1, 128)) {
        errors.push("DatabaseName must be between 1 and 128 characters");
    }

    return { isValid: errors.length === 0, errors };
};

/**
 * Validate signup data
 * @param {Object} data - Signup data object
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
const validateSignupData = (data) => {
    const errors = [];

    if (!data.AgentId || typeof data.AgentId !== "number") {
        errors.push("AgentId is required and must be a number");
    }

    if (!data.DatabaseName || typeof data.DatabaseName !== "string" || data.DatabaseName.trim() === "") {
        errors.push("DatabaseName is required");
    } else if (!validateStringLength(data.DatabaseName, 1, 128)) {
        errors.push("DatabaseName must be between 1 and 128 characters");
    }

    if (!data.UserName || typeof data.UserName !== "string" || data.UserName.trim() === "") {
        errors.push("UserName is required");
    } else if (!validateStringLength(data.UserName, 3, 50)) {
        errors.push("UserName must be between 3 and 50 characters");
    }

    if (!data.Password || typeof data.Password !== "string" || data.Password.trim() === "") {
        errors.push("Password is required");
    } else if (!validateStringLength(data.Password, 6, 255)) {
        errors.push("Password must be between 6 and 255 characters");
    }

    return { isValid: errors.length === 0, errors };
};

/**
 * Validate reset password identity data
 * @param {Object} data - Reset password identity data
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
const validateResetIdentityData = (data) => {
    const errors = [];

    if (!data.UserName || typeof data.UserName !== "string" || data.UserName.trim() === "") {
        errors.push("UserName is required");
    } else if (!validateStringLength(data.UserName, 1, 100)) {
        errors.push("UserName must be between 1 and 100 characters");
    }

    if (!data.FirstName || typeof data.FirstName !== "string" || data.FirstName.trim() === "") {
        errors.push("FirstName is required");
    } else if (!validateStringLength(data.FirstName, 1, 100)) {
        errors.push("FirstName must be between 1 and 100 characters");
    }

    if (!data.DisplayName || typeof data.DisplayName !== "string" || data.DisplayName.trim() === "") {
        errors.push("DisplayName is required");
    } else if (!validateStringLength(data.DisplayName, 1, 255)) {
        errors.push("DisplayName must be between 1 and 255 characters");
    }

    return { isValid: errors.length === 0, errors };
};

/**
 * Validate reset password data
 * @param {Object} data - Reset password payload
 * @returns {Object} { isValid: boolean, errors: string[] }
 */
const validateResetPasswordData = (data) => {
    const identityValidation = validateResetIdentityData(data);
    const errors = [...identityValidation.errors];

    if (!data.Password || typeof data.Password !== "string" || data.Password.trim() === "") {
        errors.push("Password is required");
    } else if (!validateStringLength(data.Password, 8, 255)) {
        errors.push("Password must be between 8 and 255 characters");
    } else {
        if (!/[A-Z]/.test(data.Password)) {
            errors.push("Password must contain at least one uppercase letter");
        }
        if (!/[0-9]/.test(data.Password)) {
            errors.push("Password must contain at least one number");
        }
    }

    return { isValid: errors.length === 0, errors };
};

module.exports = {
    validateRequired,
    validateEmail,
    validateStringLength,
    validateNumberRange,
    sanitizeString,
    validateLoginCredentials,
    validateSignupData,
    validateResetIdentityData,
    validateResetPasswordData
};
