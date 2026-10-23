const { downloadPurchaseInstances } = require("../services/purchaseDownloadService");
const { saveCronLog } = require("../repositories/cronLogRepository");

const writeCronLog = async (logDetails) => {
    try {
        await saveCronLog({
            type: "purchase-download",
            logDetails
        });
    } catch (logError) {
        console.error(
            `[PurchaseDownload ${new Date().toISOString()}] cron log error: ${logError.message || logError}`
        );
    }
};

async function purchaseDownloadJob() {
    try {
        const result = await downloadPurchaseInstances({
            createdBy: "purchase-download-cron"
        });

        await writeCronLog({
            status: result?.skipped ? "skipped" : "completed",
            ...result
        });

        return result;
    } catch (error) {
        await writeCronLog({
            status: "error",
            message: error.message || "Purchase download cron failed"
        });

        throw error;
    }
}

module.exports = purchaseDownloadJob;
