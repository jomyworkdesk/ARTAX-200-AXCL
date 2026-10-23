const bcrypt = require("bcrypt");
const repository = require("../repositories/settingsAdminRepository");

const cleanText = (value) => String(value ?? "").trim();
const nullableText = (value) => cleanText(value) || null;

const requiredText = (value, label) => {
    const text = cleanText(value);
    if (!text) throw new Error(`${label} is required`);
    return text;
};

const toInteger = (value, label) => {
    const number = Number(value);
    if (!Number.isInteger(number)) throw new Error(`${label} is invalid`);
    return number;
};

const nullableNumber = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error("Number value is invalid");
    return number;
};

const toBoolean = (value, defaultValue = false) => {
    if (value === undefined || value === null || value === "") return defaultValue;
    if (typeof value === "boolean") return value;
    if (value === 1 || value === "1") return true;
    if (value === 0 || value === "0") return false;
    return String(value).toLowerCase() === "true";
};

const getDatabaseName = (context = {}) => {
    if (!context.DatabaseName) throw new Error("Database name is required");
    return context.DatabaseName;
};

const parseRolePageKey = (key) => {
    const [roleId, pageId] = String(key || "").split(":");
    return {
        roleId: toInteger(roleId, "Role id"),
        pageId: toInteger(pageId, "Page id")
    };
};

const normalizePassword = async (value, currentPassword, required) => {
    const password = cleanText(value);
    if (!password) {
        if (required) throw new Error("Password is required");
        return currentPassword;
    }

    if (password.startsWith("$2a$") || password.startsWith("$2b$") || password.startsWith("$2y$")) {
        return password;
    }

    return bcrypt.hash(password, 10);
};

const resources = {
    pages: {
        list: repository.listPages,
        get: (databaseName, key) => repository.getPage(databaseName, toInteger(key, "Page id")),
        create: (databaseName, payload) => repository.createPage({
            databaseName,
            PageName: requiredText(payload.PageName, "Page name"),
            MenuText: nullableText(payload.MenuText),
            Route: requiredText(payload.Route, "Route"),
            SortOrder: nullableNumber(payload.SortOrder),
            IsActive: toBoolean(payload.IsActive, true)
        }),
        update: (databaseName, key, payload) => repository.updatePage(databaseName, toInteger(key, "Page id"), {
            PageName: requiredText(payload.PageName, "Page name"),
            MenuText: nullableText(payload.MenuText),
            Route: requiredText(payload.Route, "Route"),
            SortOrder: nullableNumber(payload.SortOrder),
            IsActive: toBoolean(payload.IsActive, true)
        })
    },
    "role-page-access": {
        list: repository.listRolePageAccess,
        get: (databaseName, key) => {
            const { roleId, pageId } = parseRolePageKey(key);
            return repository.getRolePageAccess(databaseName, roleId, pageId);
        },
        create: (databaseName, payload) => repository.createRolePageAccess({
            databaseName,
            RoleId: toInteger(payload.RoleId, "Role id"),
            PageId: toInteger(payload.PageId, "Page id"),
            HasAccess: toBoolean(payload.HasAccess, true)
        }),
        update: (databaseName, key, payload) => {
            const { roleId, pageId } = parseRolePageKey(key);
            return repository.updateRolePageAccess(databaseName, roleId, pageId, {
                HasAccess: toBoolean(payload.HasAccess, false)
            });
        }
    },
    roles: {
        list: repository.listUserRoles,
        get: (databaseName, key) => repository.getUserRole(databaseName, toInteger(key, "Role id")),
        create: (databaseName, payload) => repository.createUserRole({
            databaseName,
            RoleName: requiredText(payload.RoleName, "Role name"),
            Description: nullableText(payload.Description),
            IsActive: toBoolean(payload.IsActive, true)
        }),
        update: (databaseName, key, payload) => repository.updateUserRole(databaseName, toInteger(key, "Role id"), {
            RoleName: requiredText(payload.RoleName, "Role name"),
            Description: nullableText(payload.Description),
            IsActive: toBoolean(payload.IsActive, true)
        })
    },
    "web-logins": {
        list: repository.listWebLogins,
        get: (databaseName, key) => repository.getWebLogin(databaseName, toInteger(key, "Auto index")),
        create: async (databaseName, payload) => repository.createWebLogin({
            databaseName,
            UserName: requiredText(payload.UserName, "User name"),
            Password: await normalizePassword(payload.Password, null, true),
            RoleId: nullableNumber(payload.RoleId),
            IsActive: toBoolean(payload.IsActive, true)
        }),
        update: async (databaseName, key, payload) => {
            const autoIndex = toInteger(key, "Auto index");
            const existing = await repository.getWebLogin(databaseName, autoIndex);
            if (!existing) return null;

            return repository.updateWebLogin(databaseName, autoIndex, {
                UserName: requiredText(payload.UserName, "User name"),
                Password: await normalizePassword(payload.Password, existing.Password, false),
                RoleId: nullableNumber(payload.RoleId),
                IsActive: toBoolean(payload.IsActive, true)
            });
        }
    }
};

const getResource = (resourceName) => {
    const resource = resources[resourceName];
    if (!resource) throw new Error("Unknown settings resource");
    return resource;
};

const list = (resourceName, context) =>
    getResource(resourceName).list(getDatabaseName(context));

const get = (resourceName, key, context) =>
    getResource(resourceName).get(getDatabaseName(context), key);

const create = (resourceName, payload, context) =>
    getResource(resourceName).create(getDatabaseName(context), payload);

const update = (resourceName, key, payload, context) =>
    getResource(resourceName).update(getDatabaseName(context), key, payload);

module.exports = {
    list,
    get,
    create,
    update
};
