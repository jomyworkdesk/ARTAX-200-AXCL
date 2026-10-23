const automationService = require("../services/automationService");
const { asyncHandler } = require("../middleware/errorHandler");

const getCronSettings = asyncHandler(async (req, res) => {
    const data = await automationService.getCronSettings();
    res.json({ success: true, data });
});

const getCronSetting = asyncHandler(async (req, res) => {
    const data = await automationService.getCronSetting(req.params.id);
    if (!data) {
        return res.status(404).json({ success: false, message: "Automation setting not found" });
    }

    return res.json({ success: true, data });
});

const createCronSetting = asyncHandler(async (req, res) => {
    try {
        const data = await automationService.createCronSetting(req.body);
        return res.status(201).json({ success: true, message: "Automation setting created", data });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
});

const updateCronSetting = asyncHandler(async (req, res) => {
    try {
        const data = await automationService.updateCronSetting(req.params.id, req.body);
        if (!data) {
            return res.status(404).json({ success: false, message: "Automation setting not found" });
        }

        return res.json({ success: true, message: "Automation setting updated", data });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
});

const runManualCronSetting = asyncHandler(async (req, res) => {
    try {
        const data = await automationService.runManualCronSetting(req.params.id);
        if (!data) {
            return res.status(404).json({ success: false, message: "Automation setting not found" });
        }

        return res.json({ success: true, message: "Manual run requested", data });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
});

module.exports = {
    getCronSettings,
    getCronSetting,
    createCronSetting,
    updateCronSetting,
    runManualCronSetting
};
