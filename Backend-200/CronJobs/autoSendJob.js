const { runAutoSend } = require("../services/autoSendService");
const { saveCronLog } = require("../repositories/cronLogRepository");

const writeCronLog = async (logDetails) => {
    try {
        await saveCronLog({
            type: "autosend",
            logDetails
        });
    } catch (logError) {
        console.error(
            `[AutoSend ${new Date().toISOString()}] cron log error: ${logError.message || logError}`
        );
    }
};

async function autoSendJob() {
    try {
        const result = await runAutoSend();

        await writeCronLog({
            status: result?.skipped ? "skipped" : "completed",
            ...result
        });

        return result;
    } catch (error) {
        console.error(
            `[AutoSend ${new Date().toISOString()}] job error: ${error.message || error}`
        );

        await writeCronLog({
            status: "error",
            message: error.message || "Auto Send cron failed"
        });
    }
}

module.exports = autoSendJob;
