const appConfig = require("../config/appConfig");
const db = require("../db");
const jwt = require("jsonwebtoken");

/**
 * Logger levels
 */
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

/**
 * Get the current log level based on NODE_ENV
 */
const getCurrentLogLevel = () => {
    if (appConfig.nodeEnv === "production") {
        return LOG_LEVELS.INFO;
    }
    return LOG_LEVELS.DEBUG;
};

/**
 * Format timestamp as ISO string
 */
const getTimestamp = () => {
    return new Date().toISOString();
};

/**
 * Safely serialize log data without crashing on circular values
 */
const serializeData = (value) => {
    if (value === undefined) {
        return null;
    }

    if (value === null || typeof value !== "object") {
        return String(value);
    }

    const seen = new WeakSet();

    return JSON.stringify(value, (key, currentValue) => {
        if (currentValue instanceof Error) {
            return {
                name: currentValue.name,
                message: currentValue.message,
                stack:
                    appConfig.nodeEnv === "development"
                        ? currentValue.stack
                        : undefined
            };
        }

        if (typeof currentValue === "object" && currentValue !== null) {
            if (seen.has(currentValue)) {
                return "[Circular]";
            }

            seen.add(currentValue);
        }

        return currentValue;
    });
};

/**
 * Format log message
 */
const formatLog = (level, message, data = {}) => {
    return JSON.stringify({
        timestamp: getTimestamp(),
        level,
        message,
        ...data
    });
};

const extractBearerToken = (authorizationHeader) => {
    if (!authorizationHeader || typeof authorizationHeader !== "string") {
        return null;
    }

    if (!authorizationHeader.startsWith("Bearer ")) {
        return null;
    }

    return authorizationHeader.slice(7).trim() || null;
};

const decodeRequestToken = (req) => {
    const token = extractBearerToken(req?.headers?.authorization || req?.header?.("Authorization"));

    if (!token) {
        return {};
    }

    try {
        const decoded = jwt.verify(token, appConfig.jwtSecret);
        return {
            AgentId: decoded.AgentId || decoded.agentId || null,
            UserName: decoded.UserName || decoded.userName || null,
            SessionId: decoded.SessionId || decoded.sessionId || null
        };
    } catch (error) {
        return {};
    }
};

/**
 * Extract common request metadata for DB logging
 */
const buildRequestMetadata = (requestContext = {}) => {
    const req = requestContext.req || requestContext.request;
    const user = requestContext.user || req?.user || {};
    const session = requestContext.session || req?.session || {};
    const body = req?.body || {};
    const tokenUser = decodeRequestToken(req);

    return {
        Method: requestContext.method || req?.method || null,
        Url: requestContext.url || req?.originalUrl || req?.url || null,
        StatusCode: requestContext.statusCode ?? null,
        DurationMs: requestContext.durationMs ?? null,
        UserId:
            requestContext.userId ??
            requestContext.AgentId ??
            requestContext.agentId ??
            session.AgentId ??
            session.agentId ??
            user.AgentId ??
            user.agentId ??
            user.UserId ??
            tokenUser.AgentId ??
            body.AgentId ??
            body.agentId ??
            user.id ??
            null,
        UserName:
            requestContext.userName ||
            requestContext.UserName ||
            requestContext.username ||
            session.UserName ||
            session.userName ||
            user.UserName ||
            user.userName ||
            tokenUser.UserName ||
            body.UserName ||
            body.userName ||
            user.username ||
            null,
        SessionId:
            requestContext.SessionId ||
            requestContext.sessionId ||
            session.SessionId ||
            session.sessionId ||
            user.SessionId ||
            user.sessionId ||
            tokenUser.SessionId ||
            body.SessionId ||
            body.sessionId ||
            null,
        IPAddress:
            requestContext.ipAddress ||
            req?.ip ||
            req?.headers?.["x-forwarded-for"] ||
            req?.socket?.remoteAddress ||
            null,
        UserAgent: requestContext.userAgent || req?.headers?.["user-agent"] || null
    };
};

/**
 * Map routes to readable action names for persisted logs
 */
const PROCESS_ROUTES = [
    { methods: ["OPTIONS"], pattern: /^\/api(?:\/.*)?$/, process: "Validate API access" },
    { methods: ["GET"], pattern: /^\/health$/, process: "Health check" },

    { methods: ["GET"], pattern: /^\/api\/(?:auth\/)?agents$/, process: "Load signup agents" },
    { methods: ["POST"], pattern: /^\/api\/(?:auth\/)?signup$/, process: "Create user account" },
    { methods: ["POST"], pattern: /^\/api\/(?:auth\/)?login$/, process: "User login" },
    { methods: ["POST"], pattern: /^\/api\/(?:auth\/)?validate-reset-details$/, process: "Validate password reset details" },
    { methods: ["POST"], pattern: /^\/api\/(?:auth\/)?reset-password$/, process: "Reset user password" },
    { methods: ["POST"], pattern: /^\/api\/(?:auth\/)?login-log$/, process: "Create login log" },
    { methods: ["PUT", "POST"], pattern: /^\/api\/(?:auth\/)?login-log\/logout$/, process: "User logout" },

    { methods: ["GET"], pattern: /^\/api\/(?:invoice\/)?dashboard$/, process: "View invoice dashboard" },
    { methods: ["GET"], pattern: /^\/api\/(?:invoice\/)?getinvoices$/, process: "View invoices" },
    { methods: ["GET"], pattern: /^\/api\/(?:invoice\/)?errors$/, process: "View failed invoice errors" },
    { methods: ["GET"], pattern: /^\/api\/(?:invoice\/)?errors\/[^/]+\/response-log$/, process: "View invoice response log" },
    { methods: ["GET"], pattern: /^\/api\/(?:invoice\/)?invoices\/xml$/, process: "Download all invoice XML" },
    { methods: ["POST"], pattern: /^\/api\/(?:invoice\/)?invoices\/xml\/download$/, process: "Download selected invoice XML" },
    { methods: ["POST"], pattern: /^\/api\/(?:invoice\/)?invoices\/send$/, process: "Send selected invoices" },
    { methods: ["GET"], pattern: /^\/api\/(?:invoice\/)?invoice-details\/[^/]+$/, process: "View invoice details" },
    { methods: ["GET"], pattern: /^\/api\/(?:invoice\/)?invoice-details\/[^/]+\/xml$/, process: "Download invoice XML" },
    { methods: ["POST"], pattern: /^\/api\/(?:invoice\/)?invoice-details\/[^/]+\/send$/, process: "Send invoice" },
    { methods: ["POST"], pattern: /^\/api\/(?:invoice\/)?sync$/, process: "Sync invoice transactions" },
    { methods: ["POST"], pattern: /^\/api\/(?:invoice\/)?update$/, process: "Update selected documents" },

    { methods: ["GET"], pattern: /^\/api\/creditnote\/dashboard$/, process: "View credit note dashboard" },
    { methods: ["GET"], pattern: /^\/api\/creditnote\/getcreditnotes$/, process: "View credit notes" },
    { methods: ["GET"], pattern: /^\/api\/creditnote\/xml$/, process: "Download all credit note XML" },
    { methods: ["POST"], pattern: /^\/api\/creditnote\/xml\/selected$/, process: "Download selected credit note XML" },
    { methods: ["GET"], pattern: /^\/api\/creditnote\/xml\/[^/]+$/, process: "Download credit note XML" },
    { methods: ["POST"], pattern: /^\/api\/creditnote\/send\/selected$/, process: "Send selected credit notes" },
    { methods: ["GET"], pattern: /^\/api\/creditnote\/details\/[^/]+$/, process: "View credit note details" },
    { methods: ["GET"], pattern: /^\/api\/creditnote\/details\/[^/]+\/xml$/, process: "Download credit note details XML" },
    { methods: ["POST"], pattern: /^\/api\/creditnote\/details\/[^/]+\/send$/, process: "Send credit note" },

    { methods: ["GET"], pattern: /^\/api\/configure\/masters$/, process: "View configuration masters" },
    { methods: ["PUT"], pattern: /^\/api\/configure\/masters$/, process: "Update configuration master" },
    { methods: ["GET"], pattern: /^\/api\/configure\/state-mapping$/, process: "View state mapping" },
    { methods: ["PUT"], pattern: /^\/api\/configure\/state-mapping$/, process: "Update state mapping" },
    { methods: ["GET"], pattern: /^\/api\/configure\/country-mapping$/, process: "View country mapping" },
    { methods: ["PUT"], pattern: /^\/api\/configure\/country-mapping$/, process: "Update country mapping" },
    { methods: ["GET"], pattern: /^\/api\/configure\/payment-mapping$/, process: "View payment mapping" },
    { methods: ["PUT"], pattern: /^\/api\/configure\/payment-mapping$/, process: "Update payment mapping" },
    { methods: ["GET"], pattern: /^\/api\/configure\/invoice-type-mapping$/, process: "View invoice type mapping" },
    { methods: ["PUT"], pattern: /^\/api\/configure\/invoice-type-mapping$/, process: "Update invoice type mapping" },
    { methods: ["GET"], pattern: /^\/api\/configure\/electronic-address-scheme-mapping$/, process: "View electronic address scheme mapping" },
    { methods: ["PUT"], pattern: /^\/api\/configure\/electronic-address-scheme-mapping$/, process: "Update electronic address scheme mapping" },
    { methods: ["GET"], pattern: /^\/api\/configure\/invoice-transaction-mapping$/, process: "View invoice transaction mapping" },
    { methods: ["PUT"], pattern: /^\/api\/configure\/invoice-transaction-mapping$/, process: "Update invoice transaction mapping" },
    { methods: ["GET"], pattern: /^\/api\/configure\/credit-note-reason-mapping$/, process: "View credit note reason mapping" },
    { methods: ["PUT"], pattern: /^\/api\/configure\/credit-note-reason-mapping$/, process: "Update credit note reason mapping" },
    { methods: ["GET"], pattern: /^\/api\/configure\/unit-mapping$/, process: "View unit mapping" },
    { methods: ["PUT"], pattern: /^\/api\/configure\/unit-mapping$/, process: "Update unit mapping" },
    { methods: ["GET"], pattern: /^\/api\/configure\/currency-mapping$/, process: "View currency mapping" },
    { methods: ["PUT"], pattern: /^\/api\/configure\/currency-mapping$/, process: "Update currency mapping" },
    { methods: ["GET"], pattern: /^\/api\/configure\/vat-mapping$/, process: "View VAT mapping" },
    { methods: ["PUT"], pattern: /^\/api\/configure\/vat-mapping$/, process: "Update VAT mapping" },

    { methods: ["GET"], pattern: /^\/api\/organization\/?$/, process: "View organizations" },
    { methods: ["POST"], pattern: /^\/api\/organization\/?$/, process: "Create organization" },

    { methods: ["GET"], pattern: /^\/api\/logs\/responses$/, process: "View Taxilla response logs" },
    { methods: ["GET"], pattern: /^\/api\/logs\/tokens$/, process: "View Taxilla token logs" },
    { methods: ["GET"], pattern: /^\/api\/logs\/app$/, process: "View application logs" },
    { methods: ["GET"], pattern: /^\/api\/logs\/app\/[^/]+$/, process: "View application log details" }
];

const getRequestPath = (req) => {
    const rawPath = req?.originalUrl || req?.url || req?.path || "";

    try {
        return new URL(rawPath, "http://localhost").pathname.replace(/\/+$/, "") || "/";
    } catch {
        return String(rawPath).split("?")[0].replace(/\/+$/, "") || "/";
    }
};

const getActionName = (req) => {
    const method = String(req?.method || "REQUEST").toUpperCase();
    const path = getRequestPath(req);
    const route = PROCESS_ROUTES.find((item) =>
        item.methods.includes(method) && item.pattern.test(path)
    );

    if (route) return route.process;

    if (path.startsWith("/api")) return "Process API request";

    return "Process application request";
};

/**
 * Write log entry to the application log table
 */
const insertLogEntry = async (level, message, data = {}, requestContext = {}) => {
    const metadata = buildRequestMetadata(requestContext);

    await db.execute`
        INSERT INTO [dbo].[E_AppLogger]
        (
            [Level],
            [Message],
            [Data],
            [Method],
            [Url],
            [StatusCode],
            [DurationMs],
            [UserId],
            [UserName],
            [SessionId],
            [IPAddress],
            [UserAgent]
        )
        VALUES
        (
            ${level},
            ${message},
            ${serializeData(data)},
            ${metadata.Method},
            ${metadata.Url},
            ${metadata.StatusCode},
            ${metadata.DurationMs},
            ${metadata.UserId},
            ${metadata.UserName},
            ${metadata.SessionId},
            ${metadata.IPAddress},
            ${metadata.UserAgent}
        )
    `;
};

/**
 * Persist logs asynchronously without blocking the request lifecycle
 */
const persistLog = (level, message, data = {}, requestContext = {}) => {
    insertLogEntry(level, message, data, requestContext).catch((err) => {
        console.error(
            formatLog("ERROR", "Failed to persist application log", {
                originalLevel: level,
                originalMessage: message,
                error: err.message
            })
        );
    });
};

/**
 * Log error
 */
const error = (message, data = {}, requestContext = {}) => {
    if (getCurrentLogLevel() >= LOG_LEVELS.ERROR) {
        console.error(`❌ [ERROR] ${message}`, data);
    }

    persistLog("ERROR", message, data, requestContext);
};

/**
 * Log warning
 */
const warn = (message, data = {}, requestContext = {}) => {
    if (getCurrentLogLevel() >= LOG_LEVELS.WARN) {
        console.warn(`⚠️  [WARN] ${message}`, data);
    }

    persistLog("WARN", message, data, requestContext);
};

/**
 * Log info
 */
const info = (message, data = {}, requestContext = {}) => {
    if (getCurrentLogLevel() >= LOG_LEVELS.INFO) {
        console.log(`ℹ️  [INFO] ${message}`, data);
    }

    persistLog("INFO", message, data, requestContext);
};

/**
 * Log debug
 */
const debug = (message, data = {}, requestContext = {}) => {
    if (getCurrentLogLevel() >= LOG_LEVELS.DEBUG) {
        console.log(`🐛 [DEBUG] ${message}`, data);
    }

    persistLog("DEBUG", message, data, requestContext);
};

/**
 * Log HTTP request
 */
const logHttpRequest = (req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
        const duration = Date.now() - start;
        const logLevel = res.statusCode >= 500 ? "ERROR" : res.statusCode >= 400 ? "WARN" : "INFO";
        const actionName = getActionName(req);
        const message = actionName;

        const data = { duration: `${duration}ms` };
        const requestContext = {
            req,
            statusCode: res.statusCode,
            durationMs: duration
        };

        if (logLevel === "ERROR") {
            error(message, data, requestContext);
        } else if (logLevel === "WARN") {
            warn(message, data, requestContext);
        } else {
            info(message, data, requestContext);
        }
    });

    next();
};

module.exports = {
    error,
    warn,
    info,
    debug,
    logHttpRequest,
    LOG_LEVELS
};
