const http = require("http");
const https = require("https");
const appConfig = require("../config/appConfig");

const trimTrailingSlashes = (value) => String(value || "").replace(/\/+$/, "");
const DEFAULT_PORTAL_BASE_URL = "https://alroman.alroman.com";
const padDatePart = (value) => String(value).padStart(2, "0");

const formatCurrentDate = (date = new Date()) => [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate())
].join("-");

const postJson = (url, payload) => new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const endpoint = new URL(url);
    const transport = endpoint.protocol === "http:" ? http : https;

    const request = transport.request(
        endpoint,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body)
            }
        },
        (response) => {
            let responseBody = "";

            response.setEncoding("utf8");
            response.on("data", (chunk) => {
                responseBody += chunk;
            });
            response.on("end", () => {
                let data = {};

                try {
                    data = responseBody ? JSON.parse(responseBody) : {};
                } catch (error) {
                    reject(new Error("Portal returned an invalid JSON response"));
                    return;
                }

                resolve({
                    ok: response.statusCode >= 200 && response.statusCode < 300,
                    statusCode: response.statusCode,
                    data
                });
            });
        }
    );

    request.on("error", reject);
    request.setTimeout(30000, () => {
        request.destroy(new Error("Portal request timed out"));
    });
    request.write(body);
    request.end();
});

const getLoginClientDb = async ({ ClientCode, CurrentDate = formatCurrentDate() }) => {
    if (!appConfig.portalUrl) {
        return {
            success: false,
            message: "PORTAL_URL is not configured",
            data: []
        };
    }

    if (!ClientCode) {
        return {
            success: false,
            message: "ClientCode is required",
            data: []
        };
    }

    const payload = { ClientCode, CurrentDate };
    const url = `${trimTrailingSlashes(appConfig.portalUrl)}/Getloginclientdb`;

    try {
        const response = await postJson(url, payload);
        const data = response.data || {};

        if (!response.ok || data.success === false) {
            return {
                success: false,
                message: data.message || `Portal request failed with status ${response.statusCode}`,
                data: []
            };
        }

        return {
            success: data.success !== false,
            message: data.message || "Client database fetched successfully",
            data: Array.isArray(data.data) ? data.data : []
        };
    } catch (error) {
        return {
            success: false,
            message: error.message || "Failed to fetch client databases from portal",
            data: []
        };
    }
};

const postClientTransactions = async (transactions) => {
    const url = `${trimTrailingSlashes(appConfig.portalUrl || DEFAULT_PORTAL_BASE_URL)}/Client_transactions`;

    try {
        const response = await postJson(url, Array.isArray(transactions) ? transactions : []);
        const data = response.data || {};
        const success = response.ok && data.success !== false;

        return {
            success,
            statusCode: response.statusCode,
            message: data.message || (success
                ? "Client transactions posted successfully"
                : `Client transactions request failed with status ${response.statusCode}`),
            data
        };
    } catch (error) {
        return {
            success: false,
            message: error.message || "Failed to post client transactions",
            data: null
        };
    }
};

const getClientSubscription = async ({ ClientCode }) => {
    if (!ClientCode) {
        return {
            success: false,
            message: "ClientCode is required",
            data: []
        };
    }

    const url = `${trimTrailingSlashes(appConfig.portalUrl || DEFAULT_PORTAL_BASE_URL)}/Client_Subscription`;

    try {
        const response = await postJson(url, { ClientCode });
        const data = response.data || {};
        const success = response.ok && data.success !== false;

        return {
            success,
            statusCode: response.statusCode,
            message: data.message || (success
                ? "Client subscription fetched successfully"
                : `Client subscription request failed with status ${response.statusCode}`),
            data: Array.isArray(data.data) ? data.data : []
        };
    } catch (error) {
        return {
            success: false,
            message: error.message || "Failed to fetch client subscription",
            data: []
        };
    }
};

const readBooleanLike = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") {
        if (value === 1) return true;
        if (value === 0) return false;
        return null;
    }
    if (typeof value !== "string") return null;

    const normalized = value.trim().toLowerCase();
    if (["true", "success", "successful", "valid", "yes", "1"].includes(normalized)) {
        return true;
    }
    if (["false", "failed", "failure", "invalid", "no", "0", "error"].includes(normalized)) {
        return false;
    }

    return null;
};

const getMessage = (data) => {
    if (!data || typeof data !== "object") return null;

    if (Array.isArray(data.errors) && data.errors.length > 0) {
        return data.errors[0];
    }

    return data.message || data.Message || data.error || data.Error || null;
};

const hasFailureMessage = (message) =>
    /(invalid|incorrect|wrong|failed|failure|not found|unauthori[sz]ed|denied)/i.test(String(message || ""));

const hasDataPayload = (data) => {
    if (Array.isArray(data)) return data.length > 0;
    if (!data || typeof data !== "object") return false;

    if (Array.isArray(data.data)) return data.data.length > 0;
    if (data.data && typeof data.data === "object") return Object.keys(data.data).length > 0;

    return Object.keys(data).some((key) => !["success", "Success", "status", "Status", "message", "Message", "error", "Error", "errors"].includes(key));
};

const isClientUserSuccess = ({ ok, data }) => {
    const message = getMessage(data);
    const explicitStatus = data && typeof data === "object"
        ? readBooleanLike(data.success ?? data.Success ?? data.status ?? data.Status ?? data.valid ?? data.Valid)
        : readBooleanLike(data);

    if (explicitStatus !== null) {
        return ok && explicitStatus && !hasFailureMessage(message);
    }

    return ok && !hasFailureMessage(message) && hasDataPayload(data);
};

const validateClientUser = async ({ clientcode, username, password }) => {
    if (!clientcode) {
        return {
            success: false,
            message: "Client code is not configured",
            data: null
        };
    }

    const url = `${trimTrailingSlashes(appConfig.portalUrl || DEFAULT_PORTAL_BASE_URL)}/clientusers`;

    try {
        const response = await postJson(url, { clientcode, username, password });
        const data = response.data || {};
        const success = isClientUserSuccess({ ok: response.ok, data });

        return {
            success,
            statusCode: response.statusCode,
            message: getMessage(data) || (success ? "Artax Portal login successful" : "Invalid username or password"),
            data
        };
    } catch (error) {
        return {
            success: false,
            message: error.message || "Failed to validate Artax Portal login",
            data: null
        };
    }
};

module.exports = {
    getLoginClientDb,
    validateClientUser,
    postClientTransactions,
    getClientSubscription,
    formatCurrentDate
};
