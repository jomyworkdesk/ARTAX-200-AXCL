const logRepository = require("../repositories/logRepository");

const getResponseLogs = async (req, res) => {
    try {
        const logs = await logRepository.getResponseLogs();
        return res.json({ success: true, data: logs });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch response logs"
        });
    }
};

const getTokenLogs = async (req, res) => {
    try {
        const logs = await logRepository.getTokenLogs();
        return res.json({ success: true, data: logs });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch token logs"
        });
    }
};

const getAppLogs = async (req, res) => {
    try {
        const logs = await logRepository.getAppLogs();
        return res.json({ success: true, data: logs });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch app logs"
        });
    }
};

const getAppLogDetails = async (req, res) => {
    try {
        const sessionId = req.params.sessionId;
        const logs = await logRepository.getAppLoggerBySessionId(sessionId);
        return res.json({ success: true, data: logs });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to fetch app log details"
        });
    }
};

module.exports = {
    getResponseLogs,
    getTokenLogs,
    getAppLogs,
    getAppLogDetails
};
