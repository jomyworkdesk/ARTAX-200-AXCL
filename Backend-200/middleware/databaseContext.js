const jwt = require("jsonwebtoken");
const appConfig = require("../config/appConfig");
const db = require("../db");

const getBearerToken = (authHeader) => {
    if (!authHeader) return null;
    return authHeader.replace(/^Bearer\s+/i, "").trim();
};

const databaseContext = (req, res, next) => {
    const token = getBearerToken(req.header("Authorization"));

    if (!token) {
        next();
        return;
    }

    try {
        const decoded = jwt.verify(token, appConfig.jwtSecret);

        req.user = req.user || decoded;
        req.session = req.session || {
            AgentId: decoded.AgentId || null,
            UserName: decoded.UserName || null,
            RoleId: decoded.RoleId || null,
            SessionId: decoded.SessionId || null,
            DatabaseName: decoded.DatabaseName || null
        };

        db.runWithDatabase(decoded.DatabaseName, next);
    } catch (error) {
        next();
    }
};

module.exports = databaseContext;
