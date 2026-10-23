const settingsAdminService = require("../services/settingsAdminService");
const { asyncHandler } = require("../middleware/errorHandler");

const list = asyncHandler(async (req, res) => {
    try {
        const data = await settingsAdminService.list(req.params.resource, req.session);
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
});

const get = asyncHandler(async (req, res) => {
    try {
        const data = await settingsAdminService.get(req.params.resource, req.params.key, req.session);
        if (!data) return res.status(404).json({ success: false, message: "Settings row not found" });
        return res.json({ success: true, data });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
});

const create = asyncHandler(async (req, res) => {
    try {
        const data = await settingsAdminService.create(req.params.resource, req.body, req.session);
        return res.status(201).json({ success: true, message: "Settings row created", data });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
});

const update = asyncHandler(async (req, res) => {
    try {
        const data = await settingsAdminService.update(req.params.resource, req.params.key, req.body, req.session);
        if (!data) return res.status(404).json({ success: false, message: "Settings row not found" });
        return res.json({ success: true, message: "Settings row updated", data });
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }
});

module.exports = {
    list,
    get,
    create,
    update
};
