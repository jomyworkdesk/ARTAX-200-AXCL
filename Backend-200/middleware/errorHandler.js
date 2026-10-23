const { AppError } = require("../utils/errors");
const appConfig = require("../config/appConfig");
const logger = require("../utils/logger");

/**
 * Central error handling middleware
 * Catches all errors and returns a consistent error response
 */
const errorHandler = (err, req, res, next) => {
    // Default error response
    let statusCode = err.statusCode || 500;
    let message = err.message || "Internal Server Error";
    let code = err.code || "INTERNAL_ERROR";
    let errors = err.errors || [];

    // Prisma errors
    if (err.code === "P2025") {
        statusCode = 404;
        message = "Resource not found";
        code = "NOT_FOUND";
    } else if (err.code === "P2002") {
        statusCode = 409;
        message = "Unique constraint violation";
        code = "CONFLICT";
    } else if (err.code?.startsWith("P")) {
        statusCode = 400;
        message = "Database error";
        code = "DATABASE_ERROR";
    }

    logger.error(
        err.message || "Unhandled application error",
        {
            code: err.code || "UNKNOWN",
            statusCode,
            stack: appConfig.nodeEnv === "development" ? err.stack : undefined,
            errors
        },
        {
            req,
            statusCode
        }
    );

    // Send error response
    const errorResponse = {
        success: false,
        message,
        code,
        ...(errors.length > 0 && { errors }),
        ...(appConfig.nodeEnv === "development" && { stack: err.stack })
    };

    res.status(statusCode).json(errorResponse);
};

/**
 * Async error wrapper - catches errors in async route handlers
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
 
/**
 * 404 Not Found middleware - must be last
 */
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        message: `Cannot ${req.method} ${req.url}`,
        code: "NOT_FOUND"
    });
};

module.exports = {
    errorHandler,
    asyncHandler,
    notFoundHandler
};
