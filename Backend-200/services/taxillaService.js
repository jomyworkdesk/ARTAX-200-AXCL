const tokenRepository = require("../repositories/eInvoiceTokenRepository");
const responseRepository = require("../repositories/eInvoiceResponseRepository");
const queueRepository = require("../repositories/eInvoiceQueueRepository");
const errorRepository = require("../repositories/eInvoiceErrorRepository");
const { sendInvoiceValidationErrorMail } = require("./invoiceValidationErrorMailerService");

const TAXILLA_TOKEN_URL = process.env.TAXILLA_TOKEN_URL;
const TAXILLA_OUTBOUND_URL = process.env.TAXILLA_OUTBOUND_URL;
const OUTBOUND_USER_AGENT = process.env.OUTBOUND_USER_AGENT;

const getClientId = () => process.env.TAXILLA_CLIENT_ID;
const getClientSecret = () => process.env.TAXILLA_CLIENT_SECRET;


const runInBackground = (taskName, task) => {
    Promise.resolve()
        .then(task)
        .catch((error) => {
            console.error(`${taskName} failed`, error);
        });
};

const parseResponseBody = async (response) => {
    const text = await response.text();
    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
};

const extractInstanceIdentifierFromXml = (xml) => {
    if (!xml) return null;
    const match = String(xml).match(
        /<DocumentIdentification>[\s\S]*?<InstanceIdentifier>([^<]+)<\/InstanceIdentifier>/i
    );
    return match?.[1]?.trim() || null;
};

// Extract invoice/credit-note number (cbc:ID)
const extractInvoiceNumberFromXml = (xml) => {
    if (!xml) return null;
    const text = String(xml);

    // Invoice can be emitted as doc:Invoice in normal XML or ubl:Invoice inside TaxData.
    let match = text.match(/<(?:[\w.-]+:)?Invoice\b[\s\S]*?<cbc:ID>([^<]+)<\/cbc:ID>/i);
    if (match?.[1]) return match[1].trim();

    match = text.match(/<(?:[\w.-]+:)?CreditNote\b[\s\S]*?<cbc:ID>([^<]+)<\/cbc:ID>/i);
    if (match?.[1]) return match[1].trim();

    return null;
};

// InstanceIdentifier generation for invoices/credit notes
// Format required by you: invnumber-issueDate-timestamp
const generateInstanceIdentifierForLog = (invNumber, issueDate) => {
    if (!invNumber) return null;
    const safeInv = String(invNumber).trim();
    const safeDate = issueDate ? String(issueDate).slice(0, 10) : "";
    const timestamp = Date.now();
    return `${safeInv}-${safeDate}-${timestamp}`;
};

const buildErrorMessage = (prefix, response, body) => {
    if (body && typeof body === "object") {
        return body.message || body.error_description || body.error || prefix;
    }

    if (typeof body === "string" && body.trim()) {
        return body;
    }

    return `${prefix}. HTTP ${response.status}`;
};

const getFetchErrorDetail = (error) => {
    const cause = error?.cause;
    const details = [
        cause?.code,
        cause?.errno,
        cause?.syscall,
        cause?.hostname,
        cause?.address,
        cause?.port
    ].filter(Boolean);

    return details.length ? ` (${details.join(", ")})` : "";
};

const fetchTaxilla = async (url, options, label) => {
    try {
        return await fetch(url, {
            ...options,
            headers: {
                "User-Agent": OUTBOUND_USER_AGENT,
                ...(options?.headers || {})
            }
        });
    } catch (error) {
        const target = (() => {
            try {
                const parsed = new URL(url);
                return parsed.host;
            } catch {
                return url;
            }
        })();

        throw new Error(`${label} network request failed for ${target}: ${error.message}${getFetchErrorDetail(error)}`);
    }
};

const normalizeKey = (key) => String(key).replace(/[_\-\s]/g, "").toLowerCase();

const findValue = (source, aliases) => {
    if (!source || typeof source !== "object") return null;

    const normalizedAliases = aliases.map(normalizeKey);
    const stack = [source];

    while (stack.length) {
        const current = stack.pop();
        if (!current || typeof current !== "object") continue;

        for (const [key, value] of Object.entries(current)) {
            if (normalizedAliases.includes(normalizeKey(key))) {
                return value;
            }

            if (value && typeof value === "object") {
                stack.push(value);
            }
        }
    }

    return null;
};

const getTokenField = (data, aliases) => findValue(data, aliases);

const toText = (value, maxLength = null) => {
    if (value === null || value === undefined || value === "") return null;

    const text =
        typeof value === "string" ? value : JSON.stringify(value);

    return maxLength ? text.slice(0, maxLength) : text;
};

const toGuid = (value) => {
    const text = toText(value);
    if (!text) return null;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
        ? text
        : null;
};

const toDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const extractResponseMessage = (body) => {
    if (typeof body === "string") return body;
    if (!body || typeof body !== "object") return null;

    return toText(
        findValue(body, [
            "responseMessage",
            "message",
            "description",
            "error_description",
            "error",
            "statusMessage"
        ])
    );
};

const extractErrorDetails = (body, response) => {
    if (response.ok) return null;
    if (typeof body === "string") return body;
    if (!body || typeof body !== "object") return null;

    return toText(
        findValue(body, [
            "errorDetails",
            "error_details",
            "details",
            "detail",
            "validationErrors",
            "validation_errors",
            "errors",
            "errorList",
            "violations"
        ]) || body
    );
};

const buildResponseLogPayload = ({ body, response, createdBy }) => {
    const responseMessage =
        extractResponseMessage(body) ||
        (response.ok ? "Taxilla request completed" : `Taxilla request failed. HTTP ${response.status}`);

    return {
        responseId: toGuid(findValue(body, ["response_id", "responseId", "id"])),
        messageId: toText(findValue(body, ["messageId", "message_id"]), 255),
        instanceIdentifier: toText(
            findValue(body, ["instanceIdentifier", "instance_identifier"]),
            255
        ),
        senderParticipantID: toText(
            findValue(body, ["senderParticipantID", "senderParticipantId", "sender"]),
            255
        ),
        receiverParticipantID: toText(
            findValue(body, ["receiverParticipantID", "receiverParticipantId", "receiver"]),
            255
        ),
        documentTypeID: toText(
            findValue(body, ["documentTypeID", "documentTypeId", "documentType"]),
            500
        ),
        processID: toText(findValue(body, ["processID", "processId"]), 255),
        transmissionType: toText(findValue(body, ["transmissionType"]), 50),
        status: toText(findValue(body, ["status"]) || response.statusText, 50),
        serviceProviderId: toGuid(
            findValue(body, ["serviceProviderId", "serviceProviderID"])
        ),
        responseCreatedDate:
            toDate(findValue(body, ["responseCreatedDate", "createdDate", "createdAt"])) ||
            new Date(),
        responseMessage,
        errorDetails: extractErrorDetails(body, response),
        createdBy
    };
};

const getDubaiIsoString = (date) =>
    new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Dubai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    })
        .format(date)
        .replace(" ", "T");

const getCreatedBy = (session = {}, user = {}) =>
    String(
        session.AgentId ||
        session.agentId ||
        user.AgentId ||
        user.agentId ||
        user.userId ||
        user.UserId ||
        session.UserName ||
        user.UserName ||
        "system"
    );

const requestAccessToken = async ({ createdBy }) => {
    const clientId = getClientId();
    const clientSecret = getClientSecret();

    if (!clientId || !clientSecret) {
        throw new Error("Taxilla client_id/client_secret is missing in .env");
    }

    const body = new URLSearchParams({
        grant_type: "client_credentials"
    });

    const response = await fetchTaxilla(TAXILLA_TOKEN_URL, {
        method: "POST",
        headers: {
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json"
        },
        body
    }, "Taxilla token");

    const data = await parseResponseBody(response);

    if (!response.ok) {
        throw new Error(buildErrorMessage("Failed to generate Taxilla token", response, data));
    }

    const accessToken = getTokenField(data, [
        "access_token",
        "accessToken",
        "token"
    ]);
    const expiresIn = getTokenField(data, [
        "expires_in",
        "expiresIn",
        "expires",
        "expiresInSeconds"
    ]);
    const refreshToken = getTokenField(data, [
        "refresh_token",
        "refreshToken"
    ]);
    const tokenType = getTokenField(data, [
        "token_type",
        "tokenType"
    ]);

    if (!accessToken) {
        throw new Error("Taxilla token response did not include access_token");
    }

    runInBackground("Taxilla token log insert", () => {
        return tokenRepository.saveTokenLog({
            accessToken,
            expiresIn,
            refreshToken,
            tokenType,
            createdBy
        });
    });

    const expiresInSeconds = Number(expiresIn) || 0;
    const expiresAtDubai = expiresInSeconds
        ? getDubaiIsoString(new Date(Date.now() + expiresInSeconds * 1000))
        : null;

    return {
        accessToken,
        tokenType: tokenType || "Bearer",
        expiresIn,
        expiresAtDubai
    };
};

const updateQueueFromResponse = async ({ responseLog, fallbackInstanceIdentifier }) => {
    const instanceIdentifier = responseLog.instanceIdentifier || fallbackInstanceIdentifier;
    const responseStatus = String(responseLog.status || "").trim().toUpperCase();

    if (!instanceIdentifier) return;

    await queueRepository.markResponseByInstanceIdentifier({
        instanceIdentifier,
        isSuccess: responseStatus === "SUCCESS"
    });
};

const isValidationErrorStatus = (status) =>
    String(status || "").trim().toUpperCase() === "VALIDATION_ERROR";

const sendValidationErrorNotification = async ({
    instanceIdentifier,
    invNumber,
    docType
}) => {
    const details = await responseRepository.getValidationErrorNotificationDetails({
        instanceIdentifier,
        invNumber,
        docType
    });

    if (!details) {
        throw new Error(`No validation error details found for ${instanceIdentifier || invNumber}`);
    }

    const errorLogId = await errorRepository.insertValidationError({
        instanceIdentifier: details.InstanceIdentifier,
        invNumber: details.InvNumber,
        errorAt: details.ErrorAt,
        error: details.Error,
        customer: details.Customer,
        status: details.Status || details.status,
        invoiceAmt: details.InvoiceAmt,
        invDate: details.InvDate
    });

    try {
        const mailResult = await sendInvoiceValidationErrorMail(details);
        if (!mailResult.delivered) {
            const error = new Error(`Validation error mail was not delivered to ${mailResult.to}`);
            error.providerMessageId = mailResult.messageId;
            throw error;
        }

        await errorRepository.markMailSuccess({
            id: errorLogId,
            toMail: mailResult.to,
            providerMessageId: mailResult.messageId
        });
        return mailResult;
    } catch (error) {
        await errorRepository.markMailFailure({
            id: errorLogId,
            providerMessageId: error.providerMessageId
        });
        throw error;
    }
};



const sendXmlWithToken = async ({ xml, token, createdBy, invNumber, docType }) => {
    // Prefer InstanceIdentifier inside the XML. If missing, generate using invnumber-issueDate-timestamp
    let instanceIdentifier = extractInstanceIdentifierFromXml(xml);

    // If instanceIdentifier wasn't found in XML, generate it from invoice/credit-note fields
    if (!instanceIdentifier) {
        const invFromXml = extractInvoiceNumberFromXml(xml) || invNumber;
        const issueDateMatch = String(xml).match(/<cbc:IssueDate>([^<]+)<\/cbc:IssueDate>/i);
        const issueDate = issueDateMatch?.[1]?.trim();
        instanceIdentifier = generateInstanceIdentifierForLog(invFromXml, issueDate);
    }


    if (invNumber) {
        await queueRepository.markSentByInvoiceNumber({
            invNumber,
            docType,
            instanceIdentifier
        });
    }

    // Create/ensure response log row on send time (instanceIdentifier is the unique key)
    if (instanceIdentifier) {
        const invFromXml = extractInvoiceNumberFromXml(xml);
        const inv = invNumber || invFromXml;

        await responseRepository.upsertSendLogByInstanceIdentifier({
            instanceIdentifier,
            invNumber: inv || null,
            messageId: null,
            createdBy
        });
    }



    const response = await fetchTaxilla(TAXILLA_OUTBOUND_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token.accessToken}`,
            "Content-Type": "application/xml",
            Accept: "application/json, text/plain, */*"
        },
        body: xml
    }, "Taxilla outbound");

    const data = await parseResponseBody(response);
    const responseLog = buildResponseLogPayload({
        body: data,
        response,
        createdBy
    });

    await updateQueueFromResponse({
        responseLog,
        fallbackInstanceIdentifier: instanceIdentifier
    });

    const persistedResponseLog = {
        ...responseLog,
        instanceIdentifier: responseLog.instanceIdentifier || instanceIdentifier,
        // Do not overwrite InvNumber on response. It is stored on send-time insert.
        invNumber: undefined,
        createdBy
    };

    await responseRepository.saveResponseLog(persistedResponseLog);

    if (isValidationErrorStatus(persistedResponseLog.status)) {
        runInBackground("Taxilla validation error mail", () => {
            return sendValidationErrorNotification({
                instanceIdentifier: persistedResponseLog.instanceIdentifier,
                invNumber: invNumber || extractInvoiceNumberFromXml(xml),
                docType
            });
        });
    }


    if (!response.ok) {
        throw new Error(buildErrorMessage("Failed to send XML to Taxilla", response, data));
    }

    return {
        success: true,
        statusCode: response.status,
        tokenExpiresAtDubai: token.expiresAtDubai,
        responseMessage: responseLog.responseMessage,
        response: data
    };
};

const sendXml = async ({ xml, createdBy }) => {
    const token = await requestAccessToken({ createdBy });
    return sendXmlWithToken({ xml, token, createdBy });
};

const sendGeneratedXml = async ({ generateXml, createdBy, invNumber, docType }) => {
    const xml = await generateXml();
    const token = await requestAccessToken({ createdBy });
    return sendXmlWithToken({ xml, token, createdBy, invNumber, docType });
};

module.exports = {
    getCreatedBy,
    requestAccessToken,
    sendXml,
    sendGeneratedXml
};
