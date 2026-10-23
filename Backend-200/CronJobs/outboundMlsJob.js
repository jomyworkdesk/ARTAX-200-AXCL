const { updateOutboundMls } = require("../services/outboundMlsService");
const { saveCronLog } = require("../repositories/cronLogRepository");

const writeCronLog = async (logDetails) => {
    try {
        await saveCronLog({
            type: "outbound-mls",
            logDetails
        });
    } catch (logError) {
        console.error(
            `[OutboundMls ${new Date().toISOString()}] cron log error: ${logError.message || logError}`
        );
    }
};

async function outboundMlsJob() {
    try {
        const result = await updateOutboundMls({
            createdBy: "outbound-mls-cron"
        });

        await writeCronLog({
            status: result?.skipped ? "skipped" : "completed",
            ...result
        });

        return result;
    } catch (error) {
        await writeCronLog({
            status: "error",
            message: error.message || "Outbound Mls cron failed"
        });

        throw error;
    }
}

module.exports = outboundMlsJob;
