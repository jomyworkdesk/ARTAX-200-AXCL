const { syncInvoices } = require("../services/invoiceSyncService");
const { saveCronLog } = require("../repositories/cronLogRepository");

const writeCronLog = async (logDetails) => {
    try {
        await saveCronLog({
            type: "sync",
            logDetails
        });
    } catch (logError) {
        console.error(
            `[SageSync ${new Date().toISOString()}] cron log error: ${logError.message || logError}`
        );
    }
};

async function syncInvoicesJob() {
    try {
        const result = await syncInvoices();

        await writeCronLog({
            status: result?.skipped ? "skipped" : "completed",
            ...result
        });

        return result;
    } catch (error) {
        await writeCronLog({
            status: "error",
            message: error.message || "Sage Transaction Sync cron failed"
        });

        throw error;
    }
}

module.exports = syncInvoicesJob;
