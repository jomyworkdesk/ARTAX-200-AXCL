const jwt = require("jsonwebtoken");
const authService = require("../services/authService");
const appConfig = require("../config/appConfig");

/**
 * Get SQL Server databases for login/signup selection
 */
const getDatabases = async (req, res) => {
    try {
        const response = await authService.getDatabases();
        return res.status(200).json(response);
    } catch (error) {
        console.error("Error fetching databases:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

/**
 * Get all active agents available for signup
 */
const getAgents = async (req, res) => {
    try {
        const response = await authService.getAgents(req.query.DatabaseName);
        return res.status(200).json(response);
    } catch (error) {
        console.error("Error fetching agents:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

/**
 * Sign up a new user
 */
const signup = async (req, res) => {
    try {
        const result = await authService.signup(req.body);
        return res.status(result.status).json(result.body);
    } catch (error) {
        console.error("Error creating signup:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

/**
 * Login with username and password
 */
const login = async (req, res) => {
    try {
        const forwardedFor = req.headers["x-forwarded-for"];
        const ipAddress = Array.isArray(forwardedFor)
            ? forwardedFor[0]
            : forwardedFor?.split(",")[0]?.trim() || req.ip || req.socket?.remoteAddress || null;
        const browser = req.headers["user-agent"] || null;

        const result = await authService.login({
            ...req.body,
            IPAddress: ipAddress,
            Browser: browser
        });

        if (result.body?.data?.SessionId) {
            req.session = {
                AgentId: result.body.data.AgentId || null,
                UserName: result.body.data.UserName || null,
                RoleId: result.body.data.RoleId || null,
                SessionId: result.body.data.SessionId,
                DatabaseName: result.body.data.DatabaseName || null
            };
            req.user = {
                AgentId: result.body.data.AgentId || null,
                UserName: result.body.data.UserName || null,
                RoleId: result.body.data.RoleId || null,
                SessionId: result.body.data.SessionId,
                DatabaseName: result.body.data.DatabaseName || null
            };
        }

        return res.status(result.status).json(result.body);
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

/**
 * Validate reset password identity details
 */
const validateResetDetails = async (req, res) => {
    try {
        const result = await authService.validateResetDetails(req.body);
        return res.status(result.status).json(result.body);
    } catch (error) {
        console.error("Reset validation error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

/**
 * Reset password
 */
const resetPassword = async (req, res) => {
    try {
        const result = await authService.resetPassword(req.body);
        return res.status(result.status).json(result.body);
    } catch (error) {
        console.error("Reset password error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

const getRequestBody = (body) => {
    if (typeof body !== "string") {
        return body || {};
    }

    try {
        return JSON.parse(body);
    } catch (error) {
        return {};
    }
};

/**
 * Insert a login log entry
 */
const insertLoginLog = async (req, res) => {
    try {
        const response = await authService.insertLoginLog(req.body);
        return res.status(201).json(response);
    } catch (error) {
        console.error("Error inserting login log:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

/**
 * Logout - update the logout time in the login log
 */
const logout = async (req, res) => {
    try {
        const body = getRequestBody(req.body);
        const { LogID, SessionId } = body;
        const authHeader = req.header("Authorization");
        let sessionIdFromToken = null;
        let agentIdFromToken = null;
        let databaseNameFromToken = null;

        if (authHeader) {
            try {
                const token = authHeader.replace("Bearer ", "");
                const decoded = jwt.verify(
                    token,
                    appConfig.jwtSecret
                );
                sessionIdFromToken = decoded.SessionId || null;
                agentIdFromToken = decoded.AgentId || null;
                databaseNameFromToken = decoded.DatabaseName || null;
            } catch (error) {
                // Continue with body values when token is invalid.
            }
        }

        const effectiveSessionId = SessionId || sessionIdFromToken;
        req.session = {
            ...(req.session || {}),
            SessionId: effectiveSessionId || null,
            AgentId: agentIdFromToken || req.session?.AgentId || null,
            DatabaseName: databaseNameFromToken || body.DatabaseName || req.session?.DatabaseName || null
        };

        const result = await authService.logout({
            LogID,
            SessionId: effectiveSessionId,
            AgentId: agentIdFromToken || body.AgentId,
            DatabaseName: databaseNameFromToken || body.DatabaseName
        });

        return res.status(result.status).json(result.body);
    } catch (error) {
        console.error("Error updating logout time:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

/**
 * Get pages available to the logged-in user's role
 */
const getAccessiblePages = async (req, res) => {
    try {
        const result = await authService.getAccessiblePages({
            RoleId: req.user?.RoleId,
            DatabaseName: req.user?.DatabaseName
        });
        return res.status(result.status).json(result.body);
    } catch (error) {
        console.error("Error fetching accessible pages:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

module.exports = {
    getDatabases,
    getAgents,
    signup,
    login,
    validateResetDetails,
    resetPassword,
    insertLoginLog,
    logout,
    getAccessiblePages
};
