const cron = require("node-cron");
const clientPortalSyncJob = require("./clientPortalSyncJob");

const CLIENT_PORTAL_CRON_EXPRESSION =
    process.env.CLIENT_PORTAL_CRON_EXPRESSION || "*/30 * * * *";

let schedulerBusy = false;

const logCronInfo = (message, data = {}) => {
    console.log(`[ClientPortalScheduler] ${message}`, data);
};

const logCronError = (message, data = {}) => {
    console.error(`[ClientPortalScheduler] ${message}`, data);
};

const processClientPortalTick = async () => {
    if (schedulerBusy) return;

    schedulerBusy = true;

    try {
        await clientPortalSyncJob();
    } catch (error) {
        logCronError("Client portal sync failed", { error: error.message });
    } finally {
        schedulerBusy = false;
    }
};

const startClientPortalScheduler = () => {
    if (!cron.validate(CLIENT_PORTAL_CRON_EXPRESSION)) {
        logCronError("Invalid client portal cron expression", {
            expression: CLIENT_PORTAL_CRON_EXPRESSION
        });
        return;
    }

    cron.schedule(CLIENT_PORTAL_CRON_EXPRESSION, processClientPortalTick);
    processClientPortalTick();
    logCronInfo("Client portal scheduler started", {
        cronExpression: CLIENT_PORTAL_CRON_EXPRESSION
    });
};

module.exports = {
    startClientPortalScheduler,
    processClientPortalTick
};
