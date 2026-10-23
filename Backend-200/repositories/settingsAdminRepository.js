const db = require("../db");

const getClient = (databaseName) => {
    if (!databaseName) {
        throw new Error("Database name is required");
    }
    return db.forDatabase(databaseName);
};

const listPages = (databaseName) => getClient(databaseName).query`
    SELECT TOP (1000)
        [PageId],
        [PageName],
        [MenuText],
        [Route],
        [SortOrder],
        [IsActive]
    FROM [E_Page]
    ORDER BY [SortOrder], [PageId]
`;

const getPage = async (databaseName, pageId) => {
    const rows = await getClient(databaseName).query`
        SELECT TOP (1)
            [PageId],
            [PageName],
            [MenuText],
            [Route],
            [SortOrder],
            [IsActive]
        FROM [E_Page]
        WHERE [PageId] = ${pageId}
    `;
    return rows[0] || null;
};

const createPage = async ({ databaseName, PageName, MenuText, Route, SortOrder, IsActive }) => {
    const rows = await getClient(databaseName).query`
        INSERT INTO [E_Page] ([PageName], [MenuText], [Route], [SortOrder], [IsActive])
        OUTPUT INSERTED.[PageId],
            INSERTED.[PageName],
            INSERTED.[MenuText],
            INSERTED.[Route],
            INSERTED.[SortOrder],
            INSERTED.[IsActive]
        VALUES (${PageName}, ${MenuText}, ${Route}, ${SortOrder}, ${IsActive})
    `;
    return rows[0] || null;
};

const updatePage = async (databaseName, pageId, payload) => {
    await getClient(databaseName).execute`
        UPDATE [E_Page]
        SET [PageName] = ${payload.PageName},
            [MenuText] = ${payload.MenuText},
            [Route] = ${payload.Route},
            [SortOrder] = ${payload.SortOrder},
            [IsActive] = ${payload.IsActive}
        WHERE [PageId] = ${pageId}
    `;
    return getPage(databaseName, pageId);
};

const listRolePageAccess = (databaseName) => getClient(databaseName).query`
    SELECT TOP (1000)
        [RoleId],
        [PageId],
        [HasAccess]
    FROM [E_RolePageAccess]
    ORDER BY [RoleId], [PageId]
`;

const getRolePageAccess = async (databaseName, roleId, pageId) => {
    const rows = await getClient(databaseName).query`
        SELECT TOP (1)
            [RoleId],
            [PageId],
            [HasAccess]
        FROM [E_RolePageAccess]
        WHERE [RoleId] = ${roleId}
          AND [PageId] = ${pageId}
    `;
    return rows[0] || null;
};

const createRolePageAccess = async ({ databaseName, RoleId, PageId, HasAccess }) => {
    const rows = await getClient(databaseName).query`
        INSERT INTO [E_RolePageAccess] ([RoleId], [PageId], [HasAccess])
        OUTPUT INSERTED.[RoleId],
            INSERTED.[PageId],
            INSERTED.[HasAccess]
        VALUES (${RoleId}, ${PageId}, ${HasAccess})
    `;
    return rows[0] || null;
};

const updateRolePageAccess = async (databaseName, roleId, pageId, payload) => {
    await getClient(databaseName).execute`
        UPDATE [E_RolePageAccess]
        SET [HasAccess] = ${payload.HasAccess}
        WHERE [RoleId] = ${roleId}
          AND [PageId] = ${pageId}
    `;
    return getRolePageAccess(databaseName, roleId, pageId);
};

const listUserRoles = (databaseName) => getClient(databaseName).query`
    SELECT TOP (1000)
        [RoleId],
        [RoleName],
        [Description],
        [IsActive]
    FROM [E_UserRole]
    ORDER BY [RoleId]
`;

const getUserRole = async (databaseName, roleId) => {
    const rows = await getClient(databaseName).query`
        SELECT TOP (1)
            [RoleId],
            [RoleName],
            [Description],
            [IsActive]
        FROM [E_UserRole]
        WHERE [RoleId] = ${roleId}
    `;
    return rows[0] || null;
};

const createUserRole = async ({ databaseName, RoleName, Description, IsActive }) => {
    const rows = await getClient(databaseName).query`
        INSERT INTO [E_UserRole] ([RoleName], [Description], [IsActive])
        OUTPUT INSERTED.[RoleId],
            INSERTED.[RoleName],
            INSERTED.[Description],
            INSERTED.[IsActive]
        VALUES (${RoleName}, ${Description}, ${IsActive})
    `;
    return rows[0] || null;
};

const updateUserRole = async (databaseName, roleId, payload) => {
    await getClient(databaseName).execute`
        UPDATE [E_UserRole]
        SET [RoleName] = ${payload.RoleName},
            [Description] = ${payload.Description},
            [IsActive] = ${payload.IsActive}
        WHERE [RoleId] = ${roleId}
    `;
    return getUserRole(databaseName, roleId);
};

const listWebLogins = (databaseName) => getClient(databaseName).query`
    SELECT TOP (1000)
        wl.[AutoIndex],
        wl.[UserName],
        wl.[Password],
        wl.[RoleId],
        ur.[RoleName],
        wl.[IsActive],
        CONVERT(varchar(23), wl.[CreatedDate], 121) AS [CreatedDate],
        CONVERT(varchar(23), wl.[ModifiedDate], 121) AS [ModifiedDate]
    FROM [E_WebLogin] wl
    LEFT JOIN [E_UserRole] ur
        ON ur.[RoleId] = wl.[RoleId]
    ORDER BY wl.[AutoIndex]
`;

const getWebLogin = async (databaseName, autoIndex) => {
    const rows = await getClient(databaseName).query`
        SELECT TOP (1)
            wl.[AutoIndex],
            wl.[UserName],
            wl.[Password],
            wl.[RoleId],
            ur.[RoleName],
            wl.[IsActive],
            CONVERT(varchar(23), wl.[CreatedDate], 121) AS [CreatedDate],
            CONVERT(varchar(23), wl.[ModifiedDate], 121) AS [ModifiedDate]
        FROM [E_WebLogin] wl
        LEFT JOIN [E_UserRole] ur
            ON ur.[RoleId] = wl.[RoleId]
        WHERE wl.[AutoIndex] = ${autoIndex}
    `;
    return rows[0] || null;
};

const createWebLogin = async ({ databaseName, UserName, Password, RoleId, IsActive }) => {
    const rows = await getClient(databaseName).query`
        INSERT INTO [E_WebLogin] ([UserName], [Password], [RoleId], [IsActive], [CreatedDate], [ModifiedDate])
        OUTPUT INSERTED.[AutoIndex],
            INSERTED.[UserName],
            INSERTED.[Password],
            INSERTED.[RoleId],
            INSERTED.[IsActive],
            CONVERT(varchar(23), INSERTED.[CreatedDate], 121) AS [CreatedDate],
            CONVERT(varchar(23), INSERTED.[ModifiedDate], 121) AS [ModifiedDate]
        VALUES (${UserName}, ${Password}, ${RoleId}, ${IsActive}, GETDATE(), GETDATE())
    `;
    return rows[0] || null;
};

const updateWebLogin = async (databaseName, autoIndex, payload) => {
    await getClient(databaseName).execute`
        UPDATE [E_WebLogin]
        SET [UserName] = ${payload.UserName},
            [Password] = ${payload.Password},
            [RoleId] = ${payload.RoleId},
            [IsActive] = ${payload.IsActive},
            [ModifiedDate] = GETDATE()
        WHERE [AutoIndex] = ${autoIndex}
    `;
    return getWebLogin(databaseName, autoIndex);
};

module.exports = {
    listPages,
    getPage,
    createPage,
    updatePage,
    listRolePageAccess,
    getRolePageAccess,
    createRolePageAccess,
    updateRolePageAccess,
    listUserRoles,
    getUserRole,
    createUserRole,
    updateUserRole,
    listWebLogins,
    getWebLogin,
    createWebLogin,
    updateWebLogin
};
