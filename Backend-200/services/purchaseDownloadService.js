const crypto = require("crypto");
const { requestAccessToken } = require("./taxillaService");
const purchaseDownloadRepository = require("../repositories/purchaseDownloadRepository");
const { sendPurchaseQueueMail } = require("./purchaseQueueMailerService");

const TAXILLA_INSTANCE_IDENTIFIERS_URL = process.env.TAXILLA_INSTANCE_IDENTIFIERS_URL;
const TAXILLA_TRANSACTIONS_URL = process.env.TAXILLA_TRANSACTIONS_URL;
const TAXILLA_ARTIFACT_STREAM_URL = process.env.TAXILLA_ARTIFACT_STREAM_URL;
const OUTBOUND_USER_AGENT = process.env.OUTBOUND_USER_AGENT;
const DUBAI_TIME_ZONE = "Asia/Dubai";

const parseResponseBody = async (response) => {
    const text = await response.text();
    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
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

const getDubaiDateText = (date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: DUBAI_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date).reduce((result, part) => {
        if (["year", "month", "day"].includes(part.type)) {
            result[part.type] = part.value;
        }

        return result;
    }, {});

    return `${parts.year}-${parts.month}-${parts.day}`;
};

const getDateRange = () => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 1);

    return {
        startDate: getDubaiDateText(start),
        endDate: getDubaiDateText(end)
    };
};

const normalizeIdentifierResponse = (body) => {
    if (Array.isArray(body)) return body;
    if (Array.isArray(body?.response)) return body.response;
    return [];
};

const normalizeTransactionResponse = (body) => {
    const response = body?.response || body || {};
    const transactionDetailFlow = Array.isArray(response?.transactionDetailFlow)
        ? response.transactionDetailFlow
        : [];

    return {
        rootInstanceIdentifier: response?.instanceIdentifier || null,
        rootTransmissionType: response?.rootTransmissionType || null,
        transactionDetailFlow
    };
};

const buildTransactionUrl = (instanceIdentifier) => {
    if (TAXILLA_TRANSACTIONS_URL.includes("{instanceIdentifier}")) {
        return TAXILLA_TRANSACTIONS_URL.replace(
            "{instanceIdentifier}",
            encodeURIComponent(instanceIdentifier)
        );
    }

    const url = new URL(TAXILLA_TRANSACTIONS_URL);
    url.searchParams.set("instanceIdentifier", instanceIdentifier);
    return url.toString();
};

const buildArtifactStreamUrl = (transactionId) => {
    if (TAXILLA_ARTIFACT_STREAM_URL.includes("{transactionId}")) {
        return TAXILLA_ARTIFACT_STREAM_URL.replace(
            "{transactionId}",
            encodeURIComponent(transactionId)
        );
    }

    const url = new URL(TAXILLA_ARTIFACT_STREAM_URL);
    url.searchParams.set("transactionId", transactionId);
    return url.toString();
};

const getInstanceIdentifiers = async ({ token, startDate, endDate }) => {
    const url = new URL(TAXILLA_INSTANCE_IDENTIFIERS_URL);
    url.searchParams.set("startDate", startDate);
    url.searchParams.set("endDate", endDate);
    url.searchParams.set("status", "SUCCESS");

    const response = await fetchTaxilla(url.toString(), {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token.accessToken}`,
            Accept: "application/json"
        }
    }, "Taxilla instance identifiers");

    const data = await parseResponseBody(response);

    if (!response.ok) {
        throw new Error(buildErrorMessage("Failed to get Taxilla instance identifiers", response, data));
    }

    return normalizeIdentifierResponse(data);
};

const getTransactions = async ({ token, instanceIdentifier }) => {
    const response = await fetchTaxilla(buildTransactionUrl(instanceIdentifier), {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token.accessToken}`,
            Accept: "application/json"
        }
    }, "Taxilla transactions");

    const data = await parseResponseBody(response);

    if (!response.ok) {
        throw new Error(buildErrorMessage("Failed to get Taxilla transactions", response, data));
    }

    return normalizeTransactionResponse(data);
};

const getPurchaseInvoiceXml = async ({ token, transactionId }) => {
    const response = await fetchTaxilla(buildArtifactStreamUrl(transactionId), {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token.accessToken}`,
            Accept: "application/xml, text/xml, text/plain, */*"
        }
    }, "Taxilla artifact stream");

    const xml = await response.text();

    if (!response.ok) {
        throw new Error(buildErrorMessage("Failed to download Taxilla purchase invoice", response, xml));
    }

    return xml;
};

const findQueueTransaction = (details) => {
    const detail = details.find(
        (detail) => String(detail?.transmissionType || "").toLowerCase() === "inbound"
    ) || details[0] || {};

    return {
        transactionId: detail?.transactionId || null,
        transCreatedAt: detail?.createdDate || null
    };
};

const updateIncompletePurchaseTransactions = async ({
    createdBy = "purchase-transaction-update-cron",
    limit = Number(process.env.PURCHASE_TRANSACTION_UPDATE_LIMIT)
} = {}) => {
    const queueRows = await purchaseDownloadRepository.getIncompleteTransactionQueueRows({
        limit
    });
    let processedTransactions = 0;
    let insertedTransactions = 0;
    let updatedTransactions = 0;
    let skippedTransactions = 0;
    let transactionErrors = 0;

    if (!queueRows.length) {
        return {
            queuedForTransactionUpdate: 0,
            processedTransactions,
            insertedTransactions,
            updatedTransactions,
            skippedTransactions,
            transactionErrors
        };
    }

    const token = await requestAccessToken({ createdBy });

    for (const queueRow of queueRows) {
        try {
            const transactionResponse = await getTransactions({
                token,
                instanceIdentifier: queueRow.InstanceIdentifier
            });
            const details = transactionResponse.transactionDetailFlow;
            const upsertResult = await purchaseDownloadRepository.upsertTransactionDetails({
                rootInstanceIdentifier:
                    transactionResponse.rootInstanceIdentifier || queueRow.InstanceIdentifier,
                rootTransmissionType: transactionResponse.rootTransmissionType,
                details
            });
            const queueTransaction = findQueueTransaction(details);

            await purchaseDownloadRepository.updateQueueTransaction({
                queueId: queueRow.QueueId,
                transactionId: queueTransaction.transactionId,
                transCreatedAt: queueTransaction.transCreatedAt,
                transCount: details.length
            });

            insertedTransactions += upsertResult.insertedTransactions;
            updatedTransactions += upsertResult.updatedTransactions;
            skippedTransactions += upsertResult.skippedTransactions;
            processedTransactions += 1;
        } catch (error) {
            transactionErrors += 1;
            await purchaseDownloadRepository.updateQueueError({
                queueId: queueRow.QueueId,
                error
            });
        }
    }

    return {
        queuedForTransactionUpdate: queueRows.length,
        processedTransactions,
        insertedTransactions,
        updatedTransactions,
        skippedTransactions,
        transactionErrors
    };
};

const processPurchaseTransactions = async ({ token, correlationId }) => {
    const queueRows = await purchaseDownloadRepository.getQueuedInstancesByCorrelationId({
        correlationId
    });
    let processedTransactions = 0;
    let insertedTransactions = 0;
    let transactionErrors = 0;

    for (const queueRow of queueRows) {
        try {
            const transactionResponse = await getTransactions({
                token,
                instanceIdentifier: queueRow.InstanceIdentifier
            });
            const details = transactionResponse.transactionDetailFlow;

            insertedTransactions += await purchaseDownloadRepository.insertTransactionDetails({
                rootInstanceIdentifier:
                    transactionResponse.rootInstanceIdentifier || queueRow.InstanceIdentifier,
                rootTransmissionType: transactionResponse.rootTransmissionType,
                details
            });

            const queueTransaction = findQueueTransaction(details);

            await purchaseDownloadRepository.updateQueueTransaction({
                queueId: queueRow.QueueId,
                transactionId: queueTransaction.transactionId,
                transCreatedAt: queueTransaction.transCreatedAt,
                transCount: details.length
            });

            processedTransactions += 1;
        } catch (error) {
            transactionErrors += 1;
            await purchaseDownloadRepository.updateQueueError({
                queueId: queueRow.QueueId,
                error
            });
        }
    }

    return {
        queuedForTransaction: queueRows.length,
        processedTransactions,
        insertedTransactions,
        transactionErrors
    };
};

const getFirstValue = (rows, key) =>
    rows.find((row) => row[key] !== undefined && row[key] !== null && row[key] !== "")?.[key] || null;

const buildMailSubject = (invoiceType) => `New ${invoiceType || "Purchase Document"} Received`;

const formatDetailedError = (error) => {
    if (!error) return "Unknown error";

    const details = {
        message: error.message || String(error),
        name: error.name,
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        command: error.command,
        responseCode: error.responseCode,
        response: error.response,
        host: error.host,
        port: error.port,
        address: error.address,
        reason: error.reason,
        opensslErrorStack: error.opensslErrorStack,
        cause: error.cause
            ? {
                message: error.cause.message,
                name: error.cause.name,
                code: error.cause.code,
                reason: error.cause.reason,
                host: error.cause.host
            }
            : undefined
    };

    return JSON.stringify(
        Object.fromEntries(
            Object.entries(details).filter(([, value]) => (
                value !== undefined &&
                value !== null &&
                !(Array.isArray(value) && value.length === 0)
            ))
        )
    );
};

const processPurchaseInvoices = async ({ token, correlationId }) => {
    const { mapXmlToPurchaseRows } = require("./xmlPurchaseMapper");
    const queueRows = await purchaseDownloadRepository.getQueuedTransactionsByCorrelationId({
        correlationId
    });
    let processedInvoices = 0;
    let insertedPurchaseRows = 0;
    let invoiceErrors = 0;

    for (const queueRow of queueRows) {
        try {
            const xml = await getPurchaseInvoiceXml({
                token,
                transactionId: queueRow.TransactionId
            });
            const purchaseRows = mapXmlToPurchaseRows(xml);

            insertedPurchaseRows += await purchaseDownloadRepository.insertPurchaseRows({
                rows: purchaseRows
            });

            await purchaseDownloadRepository.updateQueueInvoiceInserted({
                queueId: queueRow.QueueId,
                senderId: getFirstValue(purchaseRows, "SenderId"),
                invoiceNo: getFirstValue(purchaseRows, "invoice_no"),
                invoiceType: getFirstValue(purchaseRows, "invoice_type_code")
            });

            processedInvoices += 1;
        } catch (error) {
            invoiceErrors += 1;
            await purchaseDownloadRepository.updateQueueError({
                queueId: queueRow.QueueId,
                error
            });
        }
    }

    return {
        queuedForInvoice: queueRows.length,
        processedInvoices,
        insertedPurchaseRows,
        invoiceErrors
    };
};

const processPurchaseMails = async ({ correlationId }) => {
    const queueRows = await purchaseDownloadRepository.getQueuedInsertedInvoicesByCorrelationId({
        correlationId
    });
    const mailConfig = await purchaseDownloadRepository.getMailConfig();
    let processedMails = 0;
    let mailErrors = 0;

    for (const queueRow of queueRows) {
        try {
            const purchaseRows = await purchaseDownloadRepository.getPurchaseRowsByInstanceIdentifier({
                instanceIdentifier: queueRow.InstanceIdentifier
            });

            if (!purchaseRows.length) {
                throw new Error(`No E_Purchase rows found for InstanceIdentifier ${queueRow.InstanceIdentifier}`);
            }

            const mailResult = await sendPurchaseQueueMail({
                queueRow,
                purchaseRows,
                mailConfig
            });
            const invoiceType = getFirstValue(purchaseRows, "invoice_type_code") || queueRow.InvoiceType || "Purchase Document";

            await purchaseDownloadRepository.insertEmailLog({
                queueId: queueRow.QueueId,
                receiverId: getFirstValue(purchaseRows, "ReceiverId"),
                instanceIdentifier: queueRow.InstanceIdentifier,
                invoiceType,
                toMail: mailResult.to,
                ccMail: mailResult.cc.join(", "),
                subject: buildMailSubject(invoiceType),
                status: "SENT",
                providerMessageId: mailResult.messageId,
                sentAt: new Date()
            });

            await purchaseDownloadRepository.updateQueueMailSent({
                queueId: queueRow.QueueId,
                toMail: mailResult.to
            });

            processedMails += 1;
        } catch (error) {
            mailErrors += 1;
            const detailedError = formatDetailedError(error);
            await purchaseDownloadRepository.insertEmailLog({
                queueId: queueRow.QueueId,
                receiverId: null,
                instanceIdentifier: queueRow.InstanceIdentifier,
                invoiceType: queueRow.InvoiceType || "Purchase Document",
                toMail: mailConfig?.tomail,
                ccMail: mailConfig?.ccmail,
                subject: buildMailSubject(queueRow.InvoiceType),
                status: "FAILED",
                errorMessage: detailedError
            });
            await purchaseDownloadRepository.updateQueueError({
                queueId: queueRow.QueueId,
                error: detailedError
            });
        }
    }

    return {
        queuedForMail: queueRows.length,
        processedMails,
        mailErrors
    };
};

const downloadPurchaseInstances = async ({ createdBy = "system" } = {}) => {
    const activeProcess = await purchaseDownloadRepository.hasActivePurchaseProcess();
    if (activeProcess) {
        return {
            skipped: true,
            reason: "Purchase download is already processing"
        };
    }

    const { startDate, endDate } = getDateRange();
    const correlationId = crypto.randomUUID();
    const token = await requestAccessToken({ createdBy });
    const identifiers = await getInstanceIdentifiers({ token, startDate, endDate });
    const insertResult = await purchaseDownloadRepository.insertInstanceIdentifiers({
        identifiers,
        correlationId,
        startDate,
        endDate
    });
    const transactionResult = await processPurchaseTransactions({
        token,
        correlationId
    });
    const invoiceResult = await processPurchaseInvoices({
        token,
        correlationId
    });
    const mailResult = await processPurchaseMails({
        correlationId
    });

    return {
        correlationId,
        startDate,
        endDate,
        fetched: identifiers.length,
        ...insertResult,
        ...transactionResult,
        ...invoiceResult,
        ...mailResult
    };
};

module.exports = {
    downloadPurchaseInstances,
    getDateRange,
    getPurchaseInvoiceXml,
    getTransactions,
    updateIncompletePurchaseTransactions
};
