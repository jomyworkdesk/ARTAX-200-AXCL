const { syncClientPortalTransactions } = require("../services/clientPortalSyncService");
const { saveCronLog } = require("../repositories/cronLogRepository");

const writeCronLog = async (logDetails) => {
    try {
        await saveCronLog({
            type: "client-portal-sync",
            logDetails
        });
    } catch (logError) {
        console.error(
            `[ClientPortalSync ${new Date().toISOString()}] cron log error: ${logError.message || logError}`
        );
    }
};

async function clientPortalSyncJob() {
    try {
        const result = await syncClientPortalTransactions();

        await writeCronLog({
            status: result?.skipped ? "skipped" : "completed",
            ...result
        });

        return result;
    } catch (error) {
        await writeCronLog({
            status: "error",
            message: error.message || "Client portal sync cron failed"
        });

        throw error;
    }
}

module.exports = clientPortalSyncJob;
