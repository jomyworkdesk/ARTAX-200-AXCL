const db = require("../db");

const getCronSettings = async () =>
    db.query`
        SELECT TOP (1000)
            [Id],
            [JobName],
            [CronExpression],
            [RunType],
            [RunEverySeconds],
            CONVERT(varchar(8), [RunAtTime], 108) AS [RunAtTime],
            CONVERT(varchar(23), [LastRunTime], 121) AS [LastRunTime],
            CONVERT(varchar(23), [NextRunTime], 121) AS [NextRunTime],
            [IsEnabled],
            [Manual],
            [IsQueue],
            [IsProcessing],
            [Status],
            CONVERT(varchar(23), [CreatedOn], 121) AS [CreatedOn],
            CONVERT(varchar(23), [UpdatedOn], 121) AS [UpdatedOn]
        FROM [E_CronSettings]
        ORDER BY [Id]
    `;

const getCronSettingById = async (id) => {
    const rows = await db.query`
        SELECT TOP (1)
            [Id],
            [JobName],
            [CronExpression],
            [RunType],
            [RunEverySeconds],
            CONVERT(varchar(8), [RunAtTime], 108) AS [RunAtTime],
            CONVERT(varchar(23), [LastRunTime], 121) AS [LastRunTime],
            CONVERT(varchar(23), [NextRunTime], 121) AS [NextRunTime],
            [IsEnabled],
            [Manual],
            [IsQueue],
            [IsProcessing],
            [Status],
            CONVERT(varchar(23), [CreatedOn], 121) AS [CreatedOn],
            CONVERT(varchar(23), [UpdatedOn], 121) AS [UpdatedOn]
        FROM [E_CronSettings]
        WHERE [Id] = ${id}
    `;

    return rows[0] || null;
};

const createCronSetting = async ({
    jobName,
    cronExpression,
    runType,
    runEverySeconds,
    runAtTime,
    lastRunTime,
    nextRunTime,
    isEnabled,
    manual,
    status
}) => {
    const rows = await db.query`
        INSERT INTO [E_CronSettings] (
            [JobName],
            [CronExpression],
            [RunType],
            [RunEverySeconds],
            [RunAtTime],
            [LastRunTime],
            [NextRunTime],
            [IsEnabled],
            [Manual],
            [IsQueue],
            [IsProcessing],
            [Status],
            [CreatedOn],
            [UpdatedOn]
        )
        OUTPUT INSERTED.[Id],
            INSERTED.[JobName],
            INSERTED.[CronExpression],
            INSERTED.[RunType],
            INSERTED.[RunEverySeconds],
            CONVERT(varchar(8), INSERTED.[RunAtTime], 108) AS [RunAtTime],
            CONVERT(varchar(23), INSERTED.[LastRunTime], 121) AS [LastRunTime],
            CONVERT(varchar(23), INSERTED.[NextRunTime], 121) AS [NextRunTime],
            INSERTED.[IsEnabled],
            INSERTED.[Manual],
            INSERTED.[IsQueue],
            INSERTED.[IsProcessing],
            INSERTED.[Status],
            CONVERT(varchar(23), INSERTED.[CreatedOn], 121) AS [CreatedOn],
            CONVERT(varchar(23), INSERTED.[UpdatedOn], 121) AS [UpdatedOn]
        VALUES (
            ${jobName},
            ${cronExpression},
            ${runType},
            ${runEverySeconds},
            ${runAtTime},
            ${lastRunTime},
            ${nextRunTime},
            ${isEnabled},
            ${manual},
            0,
            0,
            ${status},
            GETDATE(),
            GETDATE()
        )
    `;

    return rows[0] || null;
};

const updateCronSetting = async (id, {
    jobName,
    cronExpression,
    runType,
    runEverySeconds,
    runAtTime,
    lastRunTime,
    nextRunTime,
    isEnabled,
    manual,
    status
}) => {
    await db.execute`
        UPDATE [E_CronSettings]
        SET [JobName] = ${jobName},
            [CronExpression] = ${cronExpression},
            [RunType] = ${runType},
            [RunEverySeconds] = ${runEverySeconds},
            [RunAtTime] = ${runAtTime},
            [NextRunTime] = ${nextRunTime},
            [IsEnabled] = ${isEnabled},
            [Manual] = ${manual},
            [Status] = ${status},
            [UpdatedOn] = GETDATE()
        WHERE [Id] = ${id}
    `;

    return getCronSettingById(id);
};

const markCronSettingManualRun = async (id) => {
    await db.execute`
        UPDATE [E_CronSettings]
        SET [Manual] = 1,
            [NextRunTime] = GETDATE(),
            [UpdatedOn] = GETDATE()
        WHERE [Id] = ${id}
    `;

    return getCronSettingById(id);
};

module.exports = {
    getCronSettings,
    getCronSettingById,
    createCronSetting,
    updateCronSetting,
    markCronSettingManualRun
};
