const organizationRepository = require("../repositories/organizationRepository");

const getOrganizations = async () =>
    organizationRepository.getOrganizations();

const createOrganization = async (payload) => {
    const firstName = payload?.firstName?.trim?.() || "";
    const lastName = payload?.lastName?.trim?.() || "";
    const department = payload?.department?.trim?.() || "";
    const createdBy = payload?.createdBy?.trim?.() || "";
    const createDate = payload?.createDate || new Date();

    return organizationRepository.createOrganization({
        firstName,
        lastName,
        department,
        createdBy,
        createDate
    });
};

module.exports = {
    getOrganizations,
    createOrganization
};
