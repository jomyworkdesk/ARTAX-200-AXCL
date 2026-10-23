/**
 * Custom application error class
 */
class AppError extends Error {
    constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.timestamp = new Date();

        // Maintain proper stack trace for where our error was thrown
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Validation error
 */
class ValidationError extends AppError {
    constructor(message = "Validation failed", errors = []) {
        super(message, 400, "VALIDATION_ERROR");
        this.errors = errors;
    }
}

/**
 * Authentication error
 */
class AuthenticationError extends AppError {
    constructor(message = "Authentication failed") {
        super(message, 401, "AUTHENTICATION_ERROR");
    }
}

/**
 * Authorization error
 */
class AuthorizationError extends AppError {
    constructor(message = "Unauthorized access") {
        super(message, 403, "AUTHORIZATION_ERROR");
    }
}

/**
 * Not found error
 */
class NotFoundError extends AppError {
    constructor(message = "Resource not found") {
        super(message, 404, "NOT_FOUND");
    }
}

/**
 * Conflict error (e.g., duplicate resource)
 */
class ConflictError extends AppError {
    constructor(message = "Resource already exists") {
        super(message, 409, "CONFLICT");
    }
}

/**
 * Database error
 */
class DatabaseError extends AppError {
    constructor(message = "Database error", originalError = null) {
        super(message, 500, "DATABASE_ERROR");
        this.originalError = originalError;
    }
}

module.exports = {
    AppError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    NotFoundError,
    ConflictError,
    DatabaseError
};
