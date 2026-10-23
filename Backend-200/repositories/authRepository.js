const db = require("../db");

const getDbClient = (databaseName) => (
    databaseName ? db.forDatabase(databaseName) : db
);

const getDatabaseNames = async () => db.getDatabaseNames();

const getClientRefCode = async () => {
    const result = await db.query`
        SELECT TOP (1) [RefCode]
        FROM [E_config]
        ORDER BY [id]
    `;

    return result[0]?.RefCode || null;
};

/**
 * Find an agent by their agent name (legacy authentication)
 */
const findAgentByName = async (cAgentName) => {
    const result = await db.query`
        SELECT [idAgents], [cAgentName], [cPassword]
        FROM [dbo].[_rtblAgents]
        WHERE cAgentName = ${cAgentName}
    `;
    return result[0] || null;
};

/**
 * Get all active agents without web login (for signup)
 */
const getActiveAgentsWithoutWebLogin = async (databaseName) => {
    const client = getDbClient(databaseName);
    const result = await client.query`
        SELECT
            A.[idAgents],
            A.[cAgentName] as UserName
        FROM [_rtblAgents] A
        LEFT JOIN [E_WebLogin] W
            ON A.idAgents = W.AgentId
        WHERE W.AgentId IS NULL
        AND A.bAgentActive = 1
    `;
    return result;
};

/**
 * Check if a web login already exists
 */
const findWebLoginByAgentIdOrUserName = async ({ AgentId, UserName, DatabaseName }) => {
    const client = getDbClient(DatabaseName);
    const result = await client.query`
        SELECT TOP 1 [AutoIndex]
        FROM [E_WebLogin]
        WHERE [AgentId] = ${AgentId} OR [UserName] = ${UserName}
    `;
    return result[0] || null;
};

/**
 * Create a new web login (signup)
 */
const createWebLogin = async ({ AgentId, UserName, hashedPassword, DatabaseName }) => {
    const client = getDbClient(DatabaseName);
    const result = await client.query`
        INSERT INTO [E_WebLogin]
        (
            [AgentId],
            [UserName],
            [Password],
            [IsActive],
            [CreatedDate]
        )
        VALUES
        (
            ${AgentId},
            ${UserName},
            ${hashedPassword},
            ${true},
            GETDATE()
        );

        SELECT SCOPE_IDENTITY() AS AutoIndex;
    `;
    return result[0] || null;
};

/**
 * Find an active web login by username
 */
const findActiveWebLoginByUserName = async (UserName, DatabaseName) => {
    const client = getDbClient(DatabaseName);
    const result = await client.query`
        SELECT
            [AgentId],
            [UserName],
            [Password],
            [IsActive],
            [RoleId]
        FROM [E_WebLogin]
        WHERE [UserName] = ${UserName}
          AND [IsActive] = 1
    `;
    return result[0] || null;
};

/**
 * Get active pages available to a user's role.
 */
const getPagesByRoleId = async ({ RoleId, DatabaseName }) => {
    const client = getDbClient(DatabaseName);
    const result = await client.query`
        SELECT
            p.[PageId],
            p.[PageName],
            p.[MenuText],
            p.[Route],
            p.[SortOrder],
            p.[IsActive]
        FROM [E_RolePageAccess] rpa
        INNER JOIN [E_Page] p
            ON p.[PageId] = rpa.[PageId]
        WHERE rpa.[RoleId] = ${RoleId}
          AND rpa.[HasAccess] = 1
          AND p.[IsActive] = 1
        ORDER BY p.[SortOrder], p.[PageId]
    `;
    return result;
};

/**
 * Find an agent by exact identity details for password reset
 */
const findAgentByResetDetails = async ({ UserName, FirstName, DisplayName }) => {
    const result = await db.query`
        SELECT TOP 1
            [idAgents],
            [cAgentName],
            [cFirstName],
            [cDisplayName]
        FROM [dbo].[_rtblAgents]
        WHERE LTRIM(RTRIM([cAgentName])) = LTRIM(RTRIM(${UserName}))
          AND LTRIM(RTRIM([cFirstName])) = LTRIM(RTRIM(${FirstName}))
          AND LTRIM(RTRIM([cDisplayName])) = LTRIM(RTRIM(${DisplayName}))
    `;
    return result[0] || null;
};

/**
 * Insert or update a web login password during reset
 */
const upsertWebLoginPassword = async ({ AgentId, UserName, hashedPassword }) => {
    const existing = await db.query`
        SELECT TOP 1 [AutoIndex]
        FROM [E_WebLogin]
        WHERE [AgentId] = ${AgentId}
           OR [UserName] = ${UserName}
        ORDER BY [AutoIndex]
    `;

    if (existing[0]?.AutoIndex) {
        await db.execute`
            UPDATE [E_WebLogin]
            SET [AgentId] = ${AgentId},
                [UserName] = ${UserName},
                [Password] = ${hashedPassword},
                [IsActive] = 1,
                [ModifiedDate] = GETDATE()
            WHERE [AutoIndex] = ${existing[0].AutoIndex}
        `;

        return {
            AutoIndex: existing[0].AutoIndex,
            AgentId,
            UserName,
            IsActive: true,
            action: "updated"
        };
    }

    const inserted = await db.query`
        INSERT INTO [E_WebLogin]
        (
            [AgentId],
            [UserName],
            [Password],
            [IsActive],
            [CreatedDate],
            [ModifiedDate]
        )
        VALUES
        (
            ${AgentId},
            ${UserName},
            ${hashedPassword},
            1,
            GETDATE(),
            GETDATE()
        );

        SELECT SCOPE_IDENTITY() AS AutoIndex;
    `;

    return {
        AutoIndex: inserted[0]?.AutoIndex || null,
        AgentId,
        UserName,
        IsActive: true,
        action: "created"
    };
};

/**
 * Insert a login log entry
 */
const insertLoginLog = async (data) => {
    const client = getDbClient(data.DatabaseName);
    const result = await client.query`
        INSERT INTO [dbo].[E_WebLogin_Log]
        (
            [AgentId],
            [UserName],
            [LoginStatus],
            [LoginDateTime],
            [IPAddress],
            [Browser],
            [Country],
            [City],
            [Latitude],
            [Longitude],
            [FailureReason],
            [SessionId]
        )
        VALUES
        (
            ${data.AgentId || null},
            ${data.UserName || null},
            ${data.LoginStatus || null},
            GETDATE(),
            ${data.IPAddress || null},
            ${data.Browser || null},
            ${data.Country || null},
            ${data.City || null},
            ${data.Latitude ?? null},
            ${data.Longitude ?? null},
            ${data.FailureReason || null},
            ${data.SessionId || null}
        );

        SELECT SCOPE_IDENTITY() AS LogID;
    `;

    return result[0] || null;
};

/**
 * Update logout time for a login log
 */
const updateLogoutTime = async ({ LogID, SessionId, AgentId, DatabaseName }) => {
    const client = getDbClient(DatabaseName);
    if (LogID) {
        const affected = await client.execute`
            UPDATE [dbo].[E_WebLogin_Log]
            SET [LogoutDateTime] = GETDATE()
            WHERE [LogID] = ${LogID}
        `;
        return affected || 0;
    }
    if (AgentId) {
        const affected = await client.execute`
            UPDATE [dbo].[E_WebLogin_Log]
            SET [LogoutDateTime] = GETDATE()
            WHERE [SessionId] = ${SessionId}
              AND [AgentId] = ${AgentId}
        `;
        return affected || 0;
    }
    const affected = await client.execute`
        UPDATE [dbo].[E_WebLogin_Log]
        SET [LogoutDateTime] = GETDATE()
        WHERE [SessionId] = ${SessionId}
    `;
    return affected || 0;
};

module.exports = {
    findAgentByName,
    getDatabaseNames,
    getClientRefCode,
    getActiveAgentsWithoutWebLogin,
    findWebLoginByAgentIdOrUserName,
    createWebLogin,
    findActiveWebLoginByUserName,
    getPagesByRoleId,
    findAgentByResetDetails,
    upsertWebLoginPassword,
    insertLoginLog,
    updateLogoutTime
};
