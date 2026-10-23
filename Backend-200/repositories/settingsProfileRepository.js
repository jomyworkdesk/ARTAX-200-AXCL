const db = require("../db");

const getDbClient = (databaseName) => (
    databaseName ? db.forDatabase(databaseName) : db
);

const getWebLoginByAgentAndUser = async ({ AgentId, UserName, DatabaseName }) => {
    const client = getDbClient(DatabaseName);
    const rows = await client.query`
        SELECT TOP (1)
            [AutoIndex],
            [AgentId],
            [UserName],
            [Password],
            CONVERT(varchar(23), [ModifiedDate], 121) AS [ModifiedDate]
        FROM [E_WebLogin]
        WHERE [AgentId] = ${AgentId}
          AND [UserName] = ${UserName}
        ORDER BY [AutoIndex]
    `;

    return rows[0] || null;
};

const updateWebLoginPassword = async ({ AutoIndex, hashedPassword, DatabaseName }) => {
    const client = getDbClient(DatabaseName);
    await client.execute`
        UPDATE [E_WebLogin]
        SET [Password] = ${hashedPassword},
            [ModifiedDate] = GETDATE()
        WHERE [AutoIndex] = ${AutoIndex}
    `;

    return true;
};

const getMailConfig = async (DatabaseName) => {
    const client = getDbClient(DatabaseName);
    const rows = await client.query`
        SELECT TOP (1)
            [id],
            [tomail],
            [ccmail]
        FROM [E_config]
        ORDER BY [id]
    `;

    return rows[0] || null;
};

const updateMailConfig = async ({ id, tomail, ccmail, DatabaseName }) => {
    const client = getDbClient(DatabaseName);
    await client.execute`
        UPDATE [E_config]
        SET [tomail] = ${tomail},
            [ccmail] = ${ccmail}
        WHERE [id] = ${id}
    `;

    return getMailConfig(DatabaseName);
};

module.exports = {
    getWebLoginByAgentAndUser,
    updateWebLoginPassword,
    getMailConfig,
    updateMailConfig
};
