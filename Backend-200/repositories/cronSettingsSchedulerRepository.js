const db = require("../db");

const selectSettingColumns = `
    INSERTED.[Id],
    INSERTED.[JobName],
    INSERTED.[CronExpression],
    INSERTED.[RunType],
    INSERTED.[RunEverySeconds],
    INSERTED.[RunAtTime],
    INSERTED.[Manual],
    INSERTED.[LastRunTime],
    INSERTED.[NextRunTime],
    INSERTED.[IsEnabled],
    INSERTED.[Status],
    INSERTED.[IsQueue],
    INSERTED.[IsProcessing]
`;

const resetAutomationJobNameCondition = "UPPER(LTRIM(RTRIM(ISNULL([JobName], '')))) = 'RESET AUTOMATION'";
const allowedConfigRef = "J12";
const configRefSkipReasons = {
    A12: "Expired",
    D12: "Document count exceeded"
};

const getCronExecutionStatus = async () => {
    const rows = await db.query`
        SELECT TOP (1) [Ref]
        FROM [E_config]
        ORDER BY [id]
    `;

    const ref = String(rows[0]?.Ref || "").trim().toUpperCase();

    return {
        allowed: ref === allowedConfigRef,
        ref,
        reason: configRefSkipReasons[ref] || "E_config.Ref is not J12"
    };
};

const isCronExecutionAllowed = async () =>
    (await getCronExecutionStatus()).allowed;

const queueDueActiveSettings = async () =>
    db.execute`
        UPDATE [E_CronSettings]
        SET [IsQueue] = 1,
            [UpdatedOn] = GETDATE()
        WHERE UPPER(ISNULL([Status], '')) = 'ACTIVE'
            AND (ISNULL([IsEnabled], 1) = 1 OR ISNULL([Manual], 0) = 1)
            AND (
                UPPER(LTRIM(RTRIM(ISNULL([JobName], '')))) = 'RESET AUTOMATION'
                OR ISNULL([IsProcessing], 0) = 0
            )
            AND ISNULL([IsQueue], 0) = 0
            AND [NextRunTime] IS NOT NULL
            AND [NextRunTime] <= GETDATE()
    `;

const claimNextQueuedSetting = async () =>
    db.withTransaction(async (tx) => {
        const rows = await tx.queryUnsafe(`
            ;WITH next_job AS (
                SELECT TOP (1) *
                FROM [E_CronSettings] WITH (UPDLOCK, READPAST, ROWLOCK)
                WHERE UPPER(ISNULL([Status], '')) = 'ACTIVE'
                    AND (ISNULL([IsEnabled], 1) = 1 OR ISNULL([Manual], 0) = 1)
                    AND ISNULL([IsQueue], 0) = 1
                    AND (${resetAutomationJobNameCondition} OR ISNULL([IsProcessing], 0) = 0)
                    AND (
                        ${resetAutomationJobNameCondition}
                        OR NOT EXISTS (
                            SELECT 1
                            FROM [E_CronSettings]
                            WHERE ISNULL([IsProcessing], 0) = 1
                        )
                    )
                ORDER BY
                    CASE WHEN ${resetAutomationJobNameCondition} THEN 0 ELSE 1 END,
                    [NextRunTime],
                    [Id]
            )
            UPDATE next_job
            SET [IsProcessing] = 1,
                [UpdatedOn] = GETDATE()
            OUTPUT ${selectSettingColumns}
        `);

        return rows[0] || null;
    });

const completeCronSettingRun = async ({ id, lastRunTime, nextRunTime, manual }) =>
    db.execute`
        UPDATE [E_CronSettings]
        SET [LastRunTime] = ${lastRunTime},
            [NextRunTime] = ${nextRunTime},
            [Manual] = ${manual},
            [IsProcessing] = 0,
            [IsQueue] = 0,
            [UpdatedOn] = GETDATE()
        WHERE [Id] = ${id}
    `;

const skipCronSettingRun = async ({ id, nextRunTime, manual }) =>
    db.execute`
        UPDATE [E_CronSettings]
        SET [NextRunTime] = ${nextRunTime},
            [Manual] = ${manual},
            [IsProcessing] = 0,
            [IsQueue] = 0,
            [UpdatedOn] = GETDATE()
        WHERE [Id] = ${id}
    `;

const releaseCronSettingRun = async (id) =>
    db.execute`
        UPDATE [E_CronSettings]
        SET [IsProcessing] = 0,
            [IsQueue] = 0,
            [UpdatedOn] = GETDATE()
        WHERE [Id] = ${id}
    `;

const resetAutomationSettings = async () =>
    db.execute`
        UPDATE [E_CronSettings]
        SET [IsQueue] = 0,
            [IsProcessing] = 0,
            [UpdatedOn] = GETDATE()
    `;

module.exports = {
    getCronExecutionStatus,
    isCronExecutionAllowed,
    queueDueActiveSettings,
    claimNextQueuedSetting,
    completeCronSettingRun,
    skipCronSettingRun,
    releaseCronSettingRun,
    resetAutomationSettings
};
