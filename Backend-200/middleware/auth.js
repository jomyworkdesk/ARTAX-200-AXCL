const jwt = require("jsonwebtoken");
const appConfig = require("../config/appConfig");

const authMiddleware = (req, res, next) => {
    const authHeader = req.header("Authorization");
    if (!authHeader) {
        return res.status(401).json({ success: false, message: "Access denied. No token provided." });
    }

    try {
        const token = authHeader.replace(/^Bearer\s+/i, "").trim();
        const decoded = jwt.verify(token, appConfig.jwtSecret);
        req.user = decoded; // The payload (AgentId, UserName, SessionId) is now available in req.user
        req.session = {
            AgentId: decoded.AgentId || null,
            UserName: decoded.UserName || null,
            RoleId: decoded.RoleId || null,
            SessionId: decoded.SessionId || null,
            DatabaseName: decoded.DatabaseName || null
        };
        next();
    } catch (error) {
        const message =
            error.name === "TokenExpiredError"
                ? "Session expired. Please login again."
                : "Invalid token. Please login again.";
        res.status(401).json({ success: false, message });
    }
};

module.exports = authMiddleware;
