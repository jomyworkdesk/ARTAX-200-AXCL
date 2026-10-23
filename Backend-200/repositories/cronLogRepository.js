const db = require("../db");
const { resolveIdentifier } = require("../config/databaseSchema");

let cronLogTableReady = false;
const cronLogTableName = resolveIdentifier("e_invoice_cron_log").replace(/'/g, "''");

const normalizeText = (value) => {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    return String(value);
};

const normalizeLogDetails = (details) => {
    if (details === null || details === undefined || details === "") {
        return null;
    }

    if (typeof details === "string") {
        return details;
    }

    try {
        return JSON.stringify(details);
    } catch (error) {
        return String(details);
    }
};

const ensureCronLogTable = async () => {
    if (cronLogTableReady) return;

    await db.executeUnsafe(`
        IF OBJECT_ID('${cronLogTableName}', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.e_invoice_cron_log (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                [type] NVARCHAR(50) NOT NULL,
                [timestamp] DATETIME DEFAULT GETDATE(),
                logDetails NVARCHAR(MAX)
            )
        END
    `);

    cronLogTableReady = true;
};

const saveCronLog = async ({ type, logDetails }) => {
    await ensureCronLogTable();

    await db.execute`
        INSERT INTO e_invoice_cron_log (
            [type],
            [timestamp],
            logDetails
        )
        VALUES (
            ${normalizeText(type)},
            CAST(DATEADD(HOUR, 4, SYSUTCDATETIME()) AS DATETIME),
            ${normalizeLogDetails(logDetails)}
        )
    `;
};

module.exports = {
    ensureCronLogTable,
    saveCronLog
};
