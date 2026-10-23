const automationRepository = require("../repositories/automationRepository");
const { calculateNextRunTime } = require("../CronJobs/tableDrivenScheduler");

const SCHEDULER_UTC_OFFSET_MS = 4 * 60 * 60 * 1000;

const cleanText = (value) => String(value ?? "").trim();

const cleanNullableText = (value) => {
    const text = cleanText(value);
    return text || null;
};

const cleanNullableNumber = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const number = Number(value);
    if (!Number.isFinite(number)) {
        throw new Error("Run every seconds must be a valid number");
    }
    return number;
};

const cleanNullableDate = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error("Date values must be valid");
    }
    return date;
};

const normalizeEnabled = (value) => {
    if (value === true || value === 1 || value === "1") return true;
    if (value === false || value === 0 || value === "0") return false;
    return String(value ?? "").toLowerCase() === "true";
};

const normalizeRunType = (value) => {
    const runType = cleanText(value).toUpperCase();
    return runType || "CRON";
};

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

const calculatePayloadNextRunTime = (payload) => {
    if (payload.runType === "MANUAL") return null;

    const nextRunTime = calculateNextRunTime({
        RunType: payload.runType,
        CronExpression: payload.cronExpression,
        RunEverySeconds: payload.runEverySeconds,
        RunAtTime: payload.runAtTime
    }, new Date());

    return toSqlLocalDateTime(nextRunTime);
};

const normalizePayload = (payload = {}) => {
    const jobName = cleanText(payload.JobName ?? payload.jobName);
    const runType = normalizeRunType(payload.RunType ?? payload.runType);

    if (!jobName) {
        throw new Error("Job name is required");
    }

    if (!["CRON", "DAILY", "INTERVAL", "MANUAL"].includes(runType)) {
        throw new Error("Run type must be Cron, Daily, Interval, or Manual");
    }

    const cronExpression = runType === "CRON"
        ? cleanNullableText(payload.CronExpression ?? payload.cronExpression)
        : null;
    const runEverySeconds = runType === "INTERVAL"
        ? cleanNullableNumber(payload.RunEverySeconds ?? payload.runEverySeconds)
        : null;
    const runAtTime = runType === "DAILY"
        ? cleanNullableText(payload.RunAtTime ?? payload.runAtTime)
        : null;

    if (runType === "CRON" && !cronExpression) {
        throw new Error("Cron expression is required for Cron run type");
    }

    if (runType === "INTERVAL" && (runEverySeconds === null || runEverySeconds <= 0)) {
        throw new Error("Run every seconds must be greater than zero for Interval run type");
    }

    if (runType === "DAILY" && !runAtTime) {
        throw new Error("Run at time is required for Daily run type");
    }

    const isManual = runType === "MANUAL";

    const normalizedPayload = {
        jobName,
        cronExpression,
        runType,
        runEverySeconds,
        runAtTime,
        lastRunTime: cleanNullableDate(payload.LastRunTime ?? payload.lastRunTime),
        nextRunTime: cleanNullableDate(payload.NextRunTime ?? payload.nextRunTime),
        isEnabled: isManual ? false : normalizeEnabled(payload.IsEnabled ?? payload.isEnabled ?? true),
        manual: isManual ? normalizeEnabled(payload.Manual ?? payload.manual ?? false) : false,
        status: cleanNullableText(payload.Status ?? payload.status)
    };

    normalizedPayload.nextRunTime = calculatePayloadNextRunTime(normalizedPayload);

    return normalizedPayload;
};

const getCronSettings = () => automationRepository.getCronSettings();

const getCronSetting = async (id) => {
    const numericId = Number(id);
    if (!Number.isInteger(numericId)) {
        throw new Error("Valid setting id is required");
    }

    return automationRepository.getCronSettingById(numericId);
};

const createCronSetting = (payload) =>
    automationRepository.createCronSetting(normalizePayload(payload));

const updateCronSetting = async (id, payload) => {
    const numericId = Number(id);
    if (!Number.isInteger(numericId)) {
        throw new Error("Valid setting id is required");
    }

    return automationRepository.updateCronSetting(numericId, normalizePayload(payload));
};

const runManualCronSetting = async (id) => {
    const numericId = Number(id);
    if (!Number.isInteger(numericId)) {
        throw new Error("Valid setting id is required");
    }

    const setting = await automationRepository.getCronSettingById(numericId);
    if (!setting) return null;

    if (normalizeRunType(setting.RunType) !== "MANUAL") {
        throw new Error("Only Manual run type can be run manually");
    }

    return automationRepository.markCronSettingManualRun(numericId);
};

module.exports = {
    getCronSettings,
    getCronSetting,
    createCronSetting,
    updateCronSetting,
    runManualCronSetting
};
