const db = require("../db");
const {
    formatIdentifier,
    resolveIdentifier
} = require("../config/databaseSchema");

let tableCronReady = false;
const resolvedTableCronTableName = resolveIdentifier("E_tablecron");
const qualifiedTableCronTableName = resolvedTableCronTableName.includes(".")
    ? resolvedTableCronTableName
    : `dbo.${resolvedTableCronTableName}`;
const tableCronObjectName = qualifiedTableCronTableName.replace(/'/g, "''");
const tableCronSqlIdentifier = formatIdentifier(qualifiedTableCronTableName);

const normalizeText = (value) => {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    return String(value);
};

const normalizeBit = (value) => {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    if (value === true || value === 1 || value === "1") {
        return true;
    }

    return String(value).toLowerCase() === "true";
};

const ensureTableCronTable = async () => {
    if (tableCronReady) return;

    await db.executeUnsafe(`
        IF OBJECT_ID('${tableCronObjectName}', 'U') IS NULL
        BEGIN
            CREATE TABLE ${tableCronSqlIdentifier} (
                [Id] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_E_tablecron] PRIMARY KEY,
                [CronSettingId] INT NULL,
                [JobName] NVARCHAR(255) NULL,
                [RunType] NVARCHAR(20) NULL,
                [CronExpression] NVARCHAR(100) NULL,
                [Manual] BIT NULL,
                [Status] NVARCHAR(30) NOT NULL,
                [Reason] NVARCHAR(MAX) NULL,
                [ErrorMessage] NVARCHAR(MAX) NULL,
                [StartedAt] DATETIME NULL,
                [CompletedAt] DATETIME NULL,
                [DurationMs] INT NULL,
                [NextRunTime] DATETIME NULL,
                [CreatedOn] DATETIME NOT NULL CONSTRAINT [DF_E_tablecron_CreatedOn] DEFAULT GETDATE()
            )
        END

        IF NOT EXISTS (
            SELECT 1
            FROM sys.indexes
            WHERE [name] = 'IX_E_tablecron_CronSettingId_CreatedOn'
                AND [object_id] = OBJECT_ID('${tableCronObjectName}', 'U')
        )
        BEGIN
            CREATE INDEX [IX_E_tablecron_CronSettingId_CreatedOn]
                ON ${tableCronSqlIdentifier} ([CronSettingId], [CreatedOn] DESC)
        END
    `);

    tableCronReady = true;
};

const saveTableCronLog = async ({
    setting = {},
    status,
    reason,
    errorMessage,
    startedAt,
    completedAt,
    durationMs,
    nextRunTime
}) => {
    await ensureTableCronTable();

    await db.executeStatement(`
        INSERT INTO ${tableCronSqlIdentifier} (
            [CronSettingId],
            [JobName],
            [RunType],
            [CronExpression],
            [Manual],
            [Status],
            [Reason],
            [ErrorMessage],
            [StartedAt],
            [CompletedAt],
            [DurationMs],
            [NextRunTime],
            [CreatedOn]
        )
        VALUES (
            @p0,
            @p1,
            @p2,
            @p3,
            @p4,
            @p5,
            @p6,
            @p7,
            @p8,
            @p9,
            @p10,
            @p11,
            CAST(DATEADD(HOUR, 4, SYSUTCDATETIME()) AS DATETIME)
        )
    `, [
        setting.Id ?? null,
        normalizeText(setting.JobName),
        normalizeText(setting.RunType),
        normalizeText(setting.CronExpression),
        normalizeBit(setting.Manual),
        normalizeText(status),
        normalizeText(reason),
        normalizeText(errorMessage),
        startedAt || null,
        completedAt || null,
        durationMs ?? null,
        nextRunTime || null
    ]);
};

module.exports = {
    ensureTableCronTable,
    saveTableCronLog
};
