const db = require("../db");

const getOrganizations = async () =>
    db.query`
        SELECT
            ID,
            FIRSTNAME,
            LASTNAME,
            DEPARTMENT,
            CREATEDBY,
            CREATEDATE
        FROM ORGANIZATION
        ORDER BY ID DESC
    `;

const createOrganization = async ({
    firstName,
    lastName,
    department,
    createdBy,
    createDate
}) => {
    const result = await db.query`
        INSERT INTO ORGANIZATION (
            FIRSTNAME,
            LASTNAME,
            DEPARTMENT,
            CREATEDBY,
            CREATEDATE
        )
        OUTPUT
            INSERTED.ID,
            INSERTED.FIRSTNAME,
            INSERTED.LASTNAME,
            INSERTED.DEPARTMENT,
            INSERTED.CREATEDBY,
            INSERTED.CREATEDATE
        VALUES (
            ${firstName},
            ${lastName},
            ${department},
            ${createdBy},
            ${createDate}
        )
    `;

    return result[0] || null;
};

module.exports = {
    getOrganizations,
    createOrganization
};
