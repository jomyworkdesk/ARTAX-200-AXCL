const { resetAutomationSettings } = require("../repositories/cronSettingsSchedulerRepository");
const { saveCronLog } = require("../repositories/cronLogRepository");

const writeCronLog = async (logDetails) => {
    try {
        await saveCronLog({
            type: "reset-automation",
            logDetails
        });
    } catch (logError) {
        console.error(
            `[ResetAutomation ${new Date().toISOString()}] cron log error: ${logError.message || logError}`
        );
    }
};

async function resetAutomationJob() {
    try {
        const rowsAffected = await resetAutomationSettings();

        await writeCronLog({
            status: "completed",
            rowsAffected
        });

        return { rowsAffected };
    } catch (error) {
        await writeCronLog({
            status: "error",
            message: error.message || "Reset Automation cron failed"
        });

        throw error;
    }
}

module.exports = resetAutomationJob;
