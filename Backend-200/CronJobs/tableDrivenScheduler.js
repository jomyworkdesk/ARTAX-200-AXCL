const cron = require("node-cron");
const syncInvoicesJob = require("./invoiceSyncJob");
const autoSendJob = require("./autoSendJob");
const purchaseDownloadJob = require("./purchaseDownloadJob");
const purchaseTransactionUpdateJob = require("./purchaseTransactionUpdateJob");
const outboundMlsJob = require("./outboundMlsJob");
const resetAutomationJob = require("./resetAutomationJob");
const schedulerRepository = require("../repositories/cronSettingsSchedulerRepository");
const { saveTableCronLog } = require("../repositories/tableCronRepository");

const POLL_EXPRESSION = "*/5 * * * * *";
const CRON_LOOKAHEAD_LIMIT = 366 * 24 * 60 * 60;
const SCHEDULER_TIME_ZONE = "Asia/Dubai";
const SCHEDULER_UTC_OFFSET_MS = 4 * 60 * 60 * 1000;
const SCHEDULER_UTC_OFFSET_HOURS = SCHEDULER_UTC_OFFSET_MS / (60 * 60 * 1000);

const logCronInfo = (message, data = {}) => {
    console.log(`[CronScheduler] ${message}`, data);
};

const logCronError = (message, data = {}) => {
    console.error(`[CronScheduler] ${message}`, data);
};

const jobHandlers = [
    {
        matches: (jobName) =>
            jobName.includes("reset automation") ||
            (jobName.includes("reset") && jobName.includes("automation")),
        run: resetAutomationJob
    },
    {
        matches: (jobName) =>
            (jobName.includes("update") && jobName.includes("transaction")) ||
            (jobName.includes("transaction") && jobName.includes("purchase")),
        run: purchaseTransactionUpdateJob
    },
    {
        matches: (jobName) =>
            jobName.includes("outbound mls") ||
            jobName.includes("out mls") ||
            (jobName.includes("outbound") && jobName.includes("mls")),
        run: outboundMlsJob
    },
    {
        matches: (jobName) =>
            jobName.includes("purchase download") ||
            jobName.includes("download purchase") ||
            (jobName.includes("purchase") && jobName.includes("download")),
        run: purchaseDownloadJob
    },
    {
        matches: (jobName) =>
            jobName.includes("autosend") || jobName.includes("auto send"),
        run: autoSendJob
    },
    {
        matches: (jobName) =>
            jobName.includes("sync") ||
            jobName.includes("sage") ||
            jobName.includes("invoice"),
        run: syncInvoicesJob
    }
];

let schedulerBusy = false;

const normalizeJobName = (value) =>
    String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ");

const getJobHandler = (jobName) => {
    const normalizedJobName = normalizeJobName(jobName);
    return jobHandlers.find(({ matches }) => matches(normalizedJobName))?.run || null;
};

const getManualFlagAfterRun = (setting) =>
    String(setting.RunType || "").trim().toUpperCase() === "MANUAL"
        ? false
        : Boolean(setting.Manual);

const toSqlLocalDateTime = (date) => {
    if (!date) return null;

    const localDate = new Date(date.getTime() + SCHEDULER_UTC_OFFSET_MS);
    const year = localDate.getUTCFullYear();
    const month = String(localDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(localDate.getUTCDate()).padStart(2, "0");
    const hours = String(localDate.getUTCHours()).padStart(2, "0");
    const minutes = String(localDate.getUTCMinutes()).padStart(2, "0");
    const seconds = String(localDate.getUTCSeconds()).padStart(2, "0");

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const parseCronPart = (part, min, max) => {
    const values = new Set();

    String(part || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => {
            const [rangeText, stepText] = item.split("/");
            const step = stepText ? Number(stepText) : 1;

            if (!Number.isInteger(step) || step <= 0) {
                throw new Error(`Invalid cron step: ${item}`);
            }

            let start = min;
            let end = max;

            if (rangeText !== "*") {
                if (rangeText.includes("-")) {
                    const [startText, endText] = rangeText.split("-");
                    start = Number(startText);
                    end = Number(endText);
                } else {
                    start = Number(rangeText);
                    end = Number(rangeText);
                }
            }

            if (
                !Number.isInteger(start) ||
                !Number.isInteger(end) ||
                start < min ||
                end > max ||
                start > end
            ) {
                throw new Error(`Invalid cron value: ${item}`);
            }

            for (let value = start; value <= end; value += step) {
                values.add(value);
            }
        });

    return values;
};

const normalizeCronExpression = (expression) => {
    const parts = String(expression || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 5) {
        return ["0", ...parts];
    }

    if (parts.length === 6) {
        return parts;
    }

    throw new Error("Cron expression must have 5 or 6 fields");
};

const calculateCronNextRun = (expression, fromDate) => {
    const [secondPart, minutePart, hourPart, dayPart, monthPart, weekDayPart] =
        normalizeCronExpression(expression);
    const seconds = parseCronPart(secondPart, 0, 59);
    const minutes = parseCronPart(minutePart, 0, 59);
    const hours = parseCronPart(hourPart, 0, 23);
    const days = parseCronPart(dayPart, 1, 31);
    const months = parseCronPart(monthPart, 1, 12);
    const weekDays = parseCronPart(weekDayPart, 0, 7);
    const base = new Date(fromDate);
    base.setMilliseconds(0);

    for (let offset = 1; offset <= CRON_LOOKAHEAD_LIMIT; offset += 1) {
        const candidate = new Date(base.getTime() + offset * 1000);
        const weekDay = candidate.getDay();

        if (
            seconds.has(candidate.getSeconds()) &&
            minutes.has(candidate.getMinutes()) &&
            hours.has(candidate.getHours()) &&
            days.has(candidate.getDate()) &&
            months.has(candidate.getMonth() + 1) &&
            (weekDays.has(weekDay) || (weekDay === 0 && weekDays.has(7)))
        ) {
            return candidate;
        }
    }

    throw new Error("Unable to calculate next cron run within one year");
};

const parseRunAtTime = (value) => {
    if (value instanceof Date) {
        return {
            hours: value.getHours(),
            minutes: value.getMinutes(),
            seconds: value.getSeconds()
        };
    }

    const match = String(value || "").match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!match) {
        throw new Error("RunAtTime must be HH:mm or HH:mm:ss");
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = Number(match[3] || 0);

    if (hours > 23 || minutes > 59 || seconds > 59) {
        throw new Error("RunAtTime must be a valid time");
    }

    return { hours, minutes, seconds };
};

const calculateDailyNextRun = (runAtTime, fromDate) => {
    const { hours, minutes, seconds } = parseRunAtTime(runAtTime);
    const localFromDate = new Date(fromDate.getTime() + SCHEDULER_UTC_OFFSET_MS);
    const nextRun = new Date(Date.UTC(
        localFromDate.getUTCFullYear(),
        localFromDate.getUTCMonth(),
        localFromDate.getUTCDate(),
        hours - SCHEDULER_UTC_OFFSET_HOURS,
        minutes,
        seconds,
        0
    ));

    if (nextRun <= fromDate) {
        nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    }

    return nextRun;
};

const formatDateParts = (date) => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const toDailyNextRunSqlDateTime = (runAtTime, completedAt) => {
    const { hours, minutes, seconds } = parseRunAtTime(runAtTime);
    const completedDateText = toSqlLocalDateTime(completedAt).slice(0, 10);
    const nextDate = new Date(`${completedDateText}T00:00:00.000Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);

    return [
        formatDateParts(nextDate),
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    ].join(" ");
};

const calculateNextRunTime = (setting, completedAt) => {
    const runType = String(setting.RunType || "").trim().toUpperCase();

    if (runType === "MANUAL") {
        return null;
    }

    if (runType === "INTERVAL") {
        const runEverySeconds = Number(setting.RunEverySeconds);
        if (!Number.isFinite(runEverySeconds) || runEverySeconds <= 0) {
            throw new Error("RunEverySeconds must be greater than zero");
        }

        return new Date(completedAt.getTime() + runEverySeconds * 1000);
    }

    if (runType === "DAILY") {
        return calculateDailyNextRun(setting.RunAtTime, completedAt);
    }

    if (runType === "CRON") {
        if (!cron.validate(String(setting.CronExpression || ""))) {
            throw new Error("Invalid CronExpression");
        }

        return calculateCronNextRun(setting.CronExpression, completedAt);
    }

    throw new Error(`Unsupported RunType: ${setting.RunType}`);
};

const calculateCompletedNextRunSqlDateTime = (setting, completedAt) => {
    const runType = String(setting.RunType || "").trim().toUpperCase();

    if (runType === "DAILY") {
        return toDailyNextRunSqlDateTime(setting.RunAtTime, completedAt);
    }

    return toSqlLocalDateTime(calculateNextRunTime(setting, completedAt));
};

const getSkippedResultReason = (result) => {
    if (!result?.skipped) return null;
    return result.reason || result.message || "Job skipped";
};

const writeTableCronLog = async ({
    setting,
    status,
    reason,
    errorMessage,
    startedAt,
    completedAt,
    nextRunTime
}) => {
    try {
        await saveTableCronLog({
            setting,
            status,
            reason,
            errorMessage,
            startedAt: toSqlLocalDateTime(startedAt),
            completedAt: toSqlLocalDateTime(completedAt),
            durationMs: startedAt && completedAt
                ? completedAt.getTime() - startedAt.getTime()
                : null,
            nextRunTime
        });
    } catch (logError) {
        logCronError("Failed to insert E_tablecron row", {
            id: setting?.Id,
            jobName: setting?.JobName,
            error: logError.message
        });
    }
};

const runQueuedSetting = async (setting) => {
    const handler = getJobHandler(setting.JobName);
    let skippedByConfigRef = false;
    let configRefStatus = null;
    let tableCronStatus = "COMPLETED";
    let tableCronReason = null;
    let tableCronErrorMessage = null;
    const startedAt = new Date();

    try {
        configRefStatus = await schedulerRepository.getCronExecutionStatus();
        if (!configRefStatus.allowed) {
            skippedByConfigRef = true;
            tableCronStatus = "SKIPPED";
            tableCronReason = configRefStatus.reason;
            logCronInfo(`Skipping queued cron job: ${configRefStatus.reason}`, {
                id: setting.Id,
                jobName: setting.JobName,
                reason: configRefStatus.reason
            });
            return;
        }

        if (!handler) {
            throw new Error(`No cron job handler found for JobName: ${setting.JobName}`);
        }

        logCronInfo(`Running queued cron job ${setting.JobName}`, { id: setting.Id });
        const result = await handler();
        const skippedResultReason = getSkippedResultReason(result);
        if (skippedResultReason) {
            tableCronStatus = "SKIPPED";
            tableCronReason = skippedResultReason;
        }
    } catch (error) {
        tableCronStatus = "FAILED";
        tableCronErrorMessage = error.message || "Queued cron job failed";
        logCronError("Queued cron job failed", {
            id: setting.Id,
            jobName: setting.JobName,
            error: error.message
        });
    } finally {
        const completedAt = new Date();
        let nextRunTime = null;
        try {
            nextRunTime = calculateCompletedNextRunSqlDateTime(setting, completedAt);
            const manual = getManualFlagAfterRun(setting);

            if (skippedByConfigRef) {
                await schedulerRepository.skipCronSettingRun({
                    id: setting.Id,
                    nextRunTime,
                    manual
                });

                logCronInfo(`Skipped queued cron job ${setting.JobName}`, {
                    id: setting.Id,
                    nextRunTime,
                    reason: configRefStatus?.reason
                });

                await writeTableCronLog({
                    setting,
                    status: tableCronStatus,
                    reason: tableCronReason,
                    errorMessage: tableCronErrorMessage,
                    startedAt,
                    completedAt,
                    nextRunTime
                });
                return;
            }

            await schedulerRepository.completeCronSettingRun({
                id: setting.Id,
                lastRunTime: toSqlLocalDateTime(completedAt),
                nextRunTime,
                manual
            });

            logCronInfo(`Completed queued cron job ${setting.JobName}`, {
                id: setting.Id,
                nextRunTime
            });

            await writeTableCronLog({
                setting,
                status: tableCronStatus,
                reason: tableCronReason,
                errorMessage: tableCronErrorMessage,
                startedAt,
                completedAt,
                nextRunTime
            });
        } catch (scheduleError) {
            await schedulerRepository.releaseCronSettingRun(setting.Id);
            logCronError("Failed to update queued cron job schedule", {
                id: setting.Id,
                jobName: setting.JobName,
                error: scheduleError.message
            });

            await writeTableCronLog({
                setting,
                status: "SCHEDULE_UPDATE_FAILED",
                reason: tableCronReason,
                errorMessage: scheduleError.message,
                startedAt,
                completedAt,
                nextRunTime
            });
        }
    }
};

const processSchedulerTick = async () => {
    if (schedulerBusy) return;

    schedulerBusy = true;

    try {
        await schedulerRepository.queueDueActiveSettings();

        const setting = await schedulerRepository.claimNextQueuedSetting();
        if (setting) {
            await runQueuedSetting(setting);
        }
    } catch (error) {
        logCronError("Cron settings scheduler failed", { error: error.message });
    } finally {
        schedulerBusy = false;
    }
};

const startTableDrivenScheduler = () => {
    cron.schedule(POLL_EXPRESSION, processSchedulerTick);
    processSchedulerTick();
    logCronInfo("Table driven cron scheduler started", {
        pollExpression: POLL_EXPRESSION
    });
};

module.exports = {
    startTableDrivenScheduler,
    calculateNextRunTime,
    calculateCompletedNextRunSqlDateTime,
    processSchedulerTick
};
