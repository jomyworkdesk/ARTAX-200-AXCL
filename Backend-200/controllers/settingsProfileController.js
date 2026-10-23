const settingsProfileService = require("../services/settingsProfileService");
const { asyncHandler } = require("../middleware/errorHandler");

const getProfile = asyncHandler(async (req, res) => {
    try {
        const data = await settingsProfileService.getProfile(req.session);
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
});

const changePassword = asyncHandler(async (req, res) => {
    try {
        const data = await settingsProfileService.changePassword(req.session, req.body);
        return res.json({ success: true, message: "Password updated successfully", data });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
});

const updateMail = asyncHandler(async (req, res) => {
    try {
        const data = await settingsProfileService.updateMail(req.session, req.body);
        return res.json({ success: true, message: "Mail settings updated successfully", data });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
});

module.exports = {
    getProfile,
    changePassword,
    updateMail
};
