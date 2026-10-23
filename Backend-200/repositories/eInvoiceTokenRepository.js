const db = require("../db");
const { resolveIdentifier } = require("../config/databaseSchema");

let tokenLogTableReady = false;
const tokenLogTableName = resolveIdentifier("e_invoicetokenlog").replace(/'/g, "''");

const normalizeText = (value) => {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    return String(value);
};

const ensureTokenLogTable = async () => {
    if (tokenLogTableReady) return;

    await db.executeUnsafe(`
        IF OBJECT_ID('${tokenLogTableName}', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.e_invoicetokenlog (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                access_token NVARCHAR(MAX),
                expires_in INT,
                refresh_token NVARCHAR(MAX),
                token_type NVARCHAR(50),
                createdby NVARCHAR(100),
                createdAt DATETIME DEFAULT GETDATE()
            )
        END
    `);

    tokenLogTableReady = true;
};

const saveTokenLog = async ({
    accessToken,
    expiresIn,
    refreshToken,
    tokenType,
    createdBy
}) => {
    await ensureTokenLogTable();

    await db.execute`
        INSERT INTO e_invoicetokenlog (
            access_token,
            expires_in,
            refresh_token,
            token_type,
            createdby,
            createdAt
        )
        VALUES (
            ${normalizeText(accessToken)},
            ${expiresIn ?? null},
            ${normalizeText(refreshToken)},
            ${normalizeText(tokenType)},
            ${normalizeText(createdBy)},
            CAST(DATEADD(HOUR, 4, SYSUTCDATETIME()) AS DATETIME)
        )
    `;
};

module.exports = {
    saveTokenLog
};
