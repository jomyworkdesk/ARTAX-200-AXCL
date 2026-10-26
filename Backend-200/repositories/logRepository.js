const db = require("../db");

const getResponseLogs = async () =>
    db.queryUnsafe(`
        SELECT TOP (1000)
            l.[Id],
            l.[response_id],
            l.[messageId],
            l.[instanceIdentifier],
            l.[InvNumber],
            l.[senderParticipantID],
            l.[receiverParticipantID],
            l.[documentTypeID],
            l.[processID],
            l.[transmissionType],
            l.[status],
            l.[serviceProviderId],
            CONVERT(VARCHAR(19), l.[responseCreatedDate], 120) AS responseCreatedDate,
            l.[responseMessage],
            l.[errorDetails],
            COALESCE(w.[UserName], l.[createdby]) AS createdby,
            CONVERT(VARCHAR(19), l.[createdAt], 120) AS createdAt
        FROM [e_invoice_response_log] l
        LEFT JOIN [E_WebLogin] w
            ON CONVERT(NVARCHAR(100), w.[AgentId]) = l.[createdby]
        ORDER BY l.[Id] DESC
    `);

const getTokenLogs = async () =>
    db.queryUnsafe(`
        SELECT TOP (1000)
            l.[Id],
            l.[access_token],
            l.[expires_in],
            l.[refresh_token],
            l.[token_type],
            COALESCE(w.[UserName], l.[createdby]) AS createdby,
            CONVERT(VARCHAR(19), l.[createdAt], 120) AS createdAt
        FROM [e_invoicetokenlog] l
        LEFT JOIN [E_WebLogin] w
            ON CONVERT(NVARCHAR(100), w.[AgentId]) = l.[createdby]
        ORDER BY l.[Id] DESC
    `);

const getAppLogs = async () =>
    db.queryUnsafe(`
        SELECT TOP (1000)
            w.[LogID],
            w.[AgentId],
            w.[UserName],
            w.[LoginStatus],
            CONVERT(VARCHAR(23), w.[LoginDateTime], 121) AS LoginDateTime,
            CONVERT(VARCHAR(23), w.[LogoutDateTime], 121) AS LogoutDateTime,
            w.[IPAddress],
            w.[Browser],
            w.[Country],
            w.[City],
            w.[Latitude],
            w.[Longitude],
            w.[FailureReason],
            w.[SessionId]
        FROM [E_WebLogin_Log] w
        ORDER BY w.[LogID] DESC
    `);

const getAppLoggerBySessionId = async (sessionId) => {
    if (!sessionId) return [];

    const safeSessionId = String(sessionId).replace(/'/g, "''");
    return db.queryUnsafe(`
        SELECT TOP (1000)
            [LogID],
            CONVERT(VARCHAR(23), [LogDateTime], 121) AS LogDateTime,
            [Level],
            [Message],
            [Method],
            [Url],
            [StatusCode],
            [SessionId]
        FROM [E_AppLogger]
        WHERE [SessionId] = '${safeSessionId}'
        ORDER BY [LogID] DESC
    `);
};

module.exports = {
    getResponseLogs,
    getTokenLogs,
    getAppLogs,
    getAppLoggerBySessionId
};
