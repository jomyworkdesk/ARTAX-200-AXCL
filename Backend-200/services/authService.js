const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");
const authRepository = require("../repositories/authRepository");
const appConfig = require("../config/appConfig");
const portal = require("./portal");

const selectedDatabaseErrorMessage = "Selected database not found or cannot be accessed";
const ARTAX_PORTAL_DATABASE_NAME = "Artax_Portal";

const isArtaxPortalDatabase = (databaseName) =>
    String(databaseName || "").trim().toLowerCase() === ARTAX_PORTAL_DATABASE_NAME.toLowerCase();

const isSelectedDatabaseConnectionError = (error) => {
    const message = [
        error?.message,
        error?.originalError?.message,
        error?.precedingErrors?.map((item) => item?.message).join(" ")
    ].filter(Boolean).join(" ").toLowerCase();

    return error?.code === "ELOGIN" ||
        message.includes("cannot open database") ||
        message.includes("login failed for user");
};

const selectedDatabaseErrorResponse = () => ({
    status: 400,
    body: {
        success: false,
        message: selectedDatabaseErrorMessage
    }
});

const backgroundInsertLoginLog = (data) => {
    authRepository.insertLoginLog(data).catch((err) => {
        console.error("Background log error:", err);
    });
};

const getTokenExpirySecondsUntilMidnight = () => {
    const now = new Date();
    const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        0
    );
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
};

const getPortalUserDisplayName = (portalResponseData) => {
    const responseData = portalResponseData && typeof portalResponseData === "object"
        ? portalResponseData
        : {};
    const userData = responseData.data && typeof responseData.data === "object"
        ? responseData.data
        : {};

    return String(userData.name || userData.Name || responseData.name || responseData.Name || "").trim();
};

const loginArtaxPortal = async ({ UserName, Password }) => {
    const clientCode = String(await authRepository.getClientRefCode() || "").trim();

    if (!clientCode) {
        return {
            status: 400,
            body: {
                success: false,
                message: "Client code is not configured"
            }
        };
    }

    const portalResponse = await portal.validateClientUser({
        clientcode: clientCode,
        username: UserName,
        password: Password
    });

    if (!portalResponse.success) {
        const portalStatus = Number(portalResponse.statusCode || 0);
        return {
            status: portalStatus >= 500 ? 502 : 401,
            body: {
                success: false,
                message: portalResponse.message || "Invalid Artax Portal username or password"
            }
        };
    }

    const displayName = getPortalUserDisplayName(portalResponse.data) || UserName;
    const SessionId = randomUUID();
    const token = jwt.sign(
        {
            UserName,
            Name: displayName,
            ClientCode: clientCode,
            SessionId,
            DatabaseName: ARTAX_PORTAL_DATABASE_NAME,
            LoginType: "ArtaxPortal"
        },
        appConfig.jwtSecret,
        { expiresIn: getTokenExpirySecondsUntilMidnight() }
    );

    return {
        status: 200,
        body: {
            success: true,
            message: portalResponse.message || "Artax Portal login successful",
            data: {
                UserName,
                Name: displayName,
                ClientCode: clientCode,
                DatabaseName: ARTAX_PORTAL_DATABASE_NAME,
                LoginType: "ArtaxPortal",
                token,
                SessionId
            }
        }
    };
};

/**
 * Get available SQL Server databases
 */
const getDatabases = async () => {
    const clientCode = String(await authRepository.getClientRefCode() || "").trim();

    if (!clientCode) {
        return {
            success: false,
            message: "Client code is not configured",
            count: 0,
            data: []
        };
    }

    const portalResponse = await portal.getLoginClientDb({
        ClientCode: clientCode
    });

    if (!portalResponse.success) {
        return {
            success: false,
            message: portalResponse.message || "Failed to fetch databases",
            count: 0,
            data: []
        };
    }

    const databases = (portalResponse.data || [])
        .map((database) => database.DatabaseName)
        .filter(Boolean);

    return {
        success: true,
        message: portalResponse.message || "Client database fetched successfully",
        count: databases.length,
        data: databases.map((name) => ({ name, DatabaseName: name }))
    };
};

/**
 * Get all active agents without web login (for signup)
 */
const getAgents = async (DatabaseName) => {
    let agents;

    try {
        agents = await authRepository.getActiveAgentsWithoutWebLogin(DatabaseName);
    } catch (error) {
        if (isSelectedDatabaseConnectionError(error)) {
            return {
                success: false,
                message: selectedDatabaseErrorMessage,
                count: 0,
                data: []
            };
        }

        throw error;
    }

    return {
        success: true,
        count: agents.length,
        data: agents
    };
};

/**
 * Create a new web login (signup)
 */
const signup = async ({ AgentId, UserName, Password, DatabaseName }) => {
    if (!AgentId || !UserName || !Password || !DatabaseName) {
        return {
            status: 400,
            body: {
                success: false,
                message: "DatabaseName, AgentId, UserName and Password are required"
            }
        };
    }

    let duplicate;

    try {
        duplicate = await authRepository.findWebLoginByAgentIdOrUserName({
            AgentId,
            UserName,
            DatabaseName
        });
    } catch (error) {
        if (isSelectedDatabaseConnectionError(error)) {
            return selectedDatabaseErrorResponse();
        }

        throw error;
    }

    if (duplicate) {
        return {
            status: 409,
            body: {
                success: false,
                message: "User already exists for this agent or username"
            }
        };
    }

    const hashedPassword = await bcrypt.hash(Password, 10);
    let created;

    try {
        created = await authRepository.createWebLogin({
            AgentId,
            UserName,
            hashedPassword,
            DatabaseName
        });
    } catch (error) {
        if (isSelectedDatabaseConnectionError(error)) {
            return selectedDatabaseErrorResponse();
        }

        throw error;
    }

    return {
        status: 201,
        body: {
            success: true,
            message: "Signup created successfully",
            data: {
                AutoIndex: created?.AutoIndex || null,
                AgentId,
                UserName,
                DatabaseName,
                IsActive: true
            }
        }
    };
};

/**
 * Login with username and password (web login)
 */
const login = async ({
    UserName,
    Password,
    IPAddress,
    Browser,
    Country,
    City,
    Latitude,
    Longitude,
    DatabaseName
}) => {
    if (!UserName || !Password || !DatabaseName) {
        return {
            status: 400,
            body: {
                success: false,
                message: "DatabaseName, UserName and Password are required"
            }
        };
    }

    if (isArtaxPortalDatabase(DatabaseName)) {
        return loginArtaxPortal({ UserName, Password });
    }

    let user;

    try {
        user = await authRepository.findActiveWebLoginByUserName(UserName, DatabaseName);
    } catch (error) {
        if (isSelectedDatabaseConnectionError(error)) {
            return selectedDatabaseErrorResponse();
        }

        throw error;
    }

    if (!user) {
        backgroundInsertLoginLog({
            UserName,
            LoginStatus: "Failed",
            FailureReason: "Invalid username or password",
            IPAddress,
            Browser,
            Country,
            City,
            Latitude,
            Longitude,
            DatabaseName
        });
        return {
            status: 401,
            body: {
                success: false,
                message: "Invalid username or password"
            }
        };
    }

    const isPasswordValid = await bcrypt.compare(Password, user.Password);
    if (!isPasswordValid) {
        backgroundInsertLoginLog({
            UserName,
            LoginStatus: "Failed",
            FailureReason: "Invalid username or password",
            IPAddress,
            Browser,
            Country,
            City,
            Latitude,
            Longitude,
            DatabaseName
        });
        return {
            status: 401,
            body: {
                success: false,
                message: "Invalid username or password"
            }
        };
    }

    const SessionId = randomUUID();
    const token = jwt.sign(
        { AgentId: user.AgentId, UserName: user.UserName, RoleId: user.RoleId, SessionId, DatabaseName },
        appConfig.jwtSecret,
        { expiresIn: getTokenExpirySecondsUntilMidnight() }
    );

    backgroundInsertLoginLog({
        AgentId: user.AgentId,
        UserName: user.UserName,
        LoginStatus: "Success",
        SessionId,
        IPAddress,
        Browser,
        Country,
        City,
        Latitude,
        Longitude,
        DatabaseName
    });

    return {
        status: 200,
        body: {
            success: true,
            message: "Login successful",
            data: {
                AgentId: user.AgentId,
                UserName: user.UserName,
                RoleId: user.RoleId,
                DatabaseName,
                IsActive: user.IsActive,
                token,
                SessionId
            }
        }
    };
};

/**
 * Validate reset password identity details against the agents table
 */
const validateResetDetails = async ({ UserName, FirstName, DisplayName }) => {
    if (!UserName || !FirstName || !DisplayName) {
        return {
            status: 400,
            body: {
                success: false,
                message: "UserName, FirstName and DisplayName are required"
            }
        };
    }

    const agent = await authRepository.findAgentByResetDetails({
        UserName,
        FirstName,
        DisplayName
    });

    if (!agent) {
        return {
            status: 404,
            body: {
                success: false,
                message: "Agent details do not match our records"
            }
        };
    }

    return {
        status: 200,
        body: {
            success: true,
            message: "Agent details verified successfully",
            data: {
                AgentId: agent.idAgents,
                UserName: agent.cAgentName,
                FirstName: agent.cFirstName,
                DisplayName: agent.cDisplayName
            }
        }
    };
};

/**
 * Reset password by validating details and saving into E_WebLogin
 */
const resetPassword = async ({ UserName, FirstName, DisplayName, Password }) => {
    const validationResult = await validateResetDetails({
        UserName,
        FirstName,
        DisplayName
    });

    if (validationResult.status !== 200) {
        return validationResult;
    }

    const hashedPassword = await bcrypt.hash(Password, 10);
    const saved = await authRepository.upsertWebLoginPassword({
        AgentId: validationResult.body.data.AgentId,
        UserName: validationResult.body.data.UserName,
        hashedPassword
    });

    return {
        status: 200,
        body: {
            success: true,
            message: "Password updated successfully",
            data: saved
        }
    };
};

/**
 * Insert a login log entry
 */
const insertLoginLog = async (payload) => {
    const created = await authRepository.insertLoginLog(payload);
    return {
        success: true,
        message: "Login log inserted successfully",
        LogID: created?.LogID || null
    };
};

/**
 * Update logout time for a login log
 */
const logout = async ({ LogID, SessionId, AgentId, DatabaseName }) => {
    if (!LogID && !SessionId) {
        return {
            status: 400,
            body: {
                success: false,
                message: "LogID or SessionId is required"
            }
        };
    }

    const updatedRows = await authRepository.updateLogoutTime({
        LogID,
        SessionId,
        AgentId,
        DatabaseName
    });

    if (updatedRows === 0) {
        return {
            status: 404,
            body: {
                success: false,
                message: "Log record not found"
            }
        };
    }

    return {
        status: 200,
        body: {
            success: true,
            message: "Logout time updated successfully"
        }
    };
};

const getAccessiblePages = async ({ RoleId, DatabaseName }) => {
    if (!RoleId || !DatabaseName) {
        return {
            status: 200,
            body: {
                success: true,
                count: 0,
                data: []
            }
        };
    }

    const pages = await authRepository.getPagesByRoleId({ RoleId, DatabaseName });
    return {
        status: 200,
        body: {
            success: true,
            count: pages.length,
            data: pages
        }
    };
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
