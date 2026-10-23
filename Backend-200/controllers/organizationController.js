const organizationService = require("../services/organizationService");
const { asyncHandler } = require("../middleware/errorHandler");

const getOrganizations = asyncHandler(async (req, res) => {
    const data = await organizationService.getOrganizations();
    res.json({ success: true, data });
});

const createOrganization = asyncHandler(async (req, res) => {
    const { firstName, lastName, department, createDate } = req.body;
    const createdBy =
        req.session?.AgentId ||
        req.user?.AgentId ||
        null;

    if (!firstName || !lastName || !department) {
        return res.status(400).json({
            success: false,
            message: "firstName, lastName and department are required"
        });
    }

    if (!createdBy) {
        return res.status(401).json({
            success: false,
            message: "Unable to resolve createdBy from login session"
        });
    }

    const data = await organizationService.createOrganization({
        firstName,
        lastName,
        department,
        createdBy,
        createDate
    });

    res.status(201).json({
        success: true,
        message: "Organization created successfully",
        data
    });
});

module.exports = {
    getOrganizations,
    createOrganization
};
