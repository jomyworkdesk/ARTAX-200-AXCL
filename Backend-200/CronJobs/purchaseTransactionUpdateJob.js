const { updateIncompletePurchaseTransactions } = require("../services/purchaseDownloadService");
const { saveCronLog } = require("../repositories/cronLogRepository");

const writeCronLog = async (logDetails) => {
    try {
        await saveCronLog({
            type: "purchase-transaction-update",
            logDetails
        });
    } catch (logError) {
        console.error(
            `[PurchaseTransactionUpdate ${new Date().toISOString()}] cron log error: ${logError.message || logError}`
        );
    }
};

async function purchaseTransactionUpdateJob() {
    try {
        const result = await updateIncompletePurchaseTransactions({
            createdBy: "purchase-transaction-update-cron"
        });

        await writeCronLog({
            status: "completed",
            ...result
        });

        return result;
    } catch (error) {
        await writeCronLog({
            status: "error",
            message: error.message || "Purchase transaction update cron failed"
        });

        throw error;
    }
}

module.exports = purchaseTransactionUpdateJob;
