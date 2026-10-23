const { requestAccessToken } = require("./taxillaService");
const outboundMlsRepository = require("../repositories/outboundMlsRepository");

const TAXILLA_OUTBOUND_TRANSACTIONS_URL =
    process.env.TAXILLA_OUTBOUND_TRANSACTIONS_URL ||
    "https://uat.entransact.taxilla.com/accesspoint/v1/transactions/OUTBOUND/{instanceIdentifier}";
const OUTBOUND_USER_AGENT = process.env.OUTBOUND_USER_AGENT;

let isRunning = false;

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
                return new URL(url).host;
            } catch {
                return url;
            }
        })();

        throw new Error(`${label} network request failed for ${target}: ${error.message}${getFetchErrorDetail(error)}`);
    }
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

const buildOutboundTransactionUrl = (instanceIdentifier) => {
    if (TAXILLA_OUTBOUND_TRANSACTIONS_URL.includes("{instanceIdentifier}")) {
        return TAXILLA_OUTBOUND_TRANSACTIONS_URL.replace(
            "{instanceIdentifier}",
            encodeURIComponent(instanceIdentifier)
        );
    }

    const baseUrl = TAXILLA_OUTBOUND_TRANSACTIONS_URL.replace(/\/$/, "");
    return `${baseUrl}/${encodeURIComponent(instanceIdentifier)}`;
};

const getOutboundTransactions = async ({ token, instanceIdentifier }) => {
    const response = await fetchTaxilla(buildOutboundTransactionUrl(instanceIdentifier), {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token.accessToken}`,
            Accept: "application/json"
        }
    }, "Taxilla outbound transactions");

    const data = await parseResponseBody(response);

    if (!response.ok) {
        throw new Error(buildErrorMessage("Failed to get Taxilla outbound transactions", response, data));
    }

    return normalizeTransactionResponse(data);
};

const updateOutboundMls = async ({
    createdBy = "outbound-mls-cron",
    limit
} = {}) => {
    if (isRunning) {
        return {
            skipped: true,
            reason: "Outbound Mls is already processing"
        };
    }

    isRunning = true;

    try {
        const queueRows = await outboundMlsRepository.getEligibleInvoiceQueueRows({ limit });
        let processed = 0;
        let insertedTransactions = 0;
        let updatedTransactions = 0;
        let skippedTransactions = 0;
        let failed = 0;

        if (!queueRows.length) {
            return {
                queued: 0,
                processed,
                insertedTransactions,
                updatedTransactions,
                skippedTransactions,
                failed
            };
        }

        const token = await requestAccessToken({ createdBy });

        for (const queueRow of queueRows) {
            try {
                const transactionResponse = await getOutboundTransactions({
                    token,
                    instanceIdentifier: queueRow.instanceIdentifier
                });
                const details = transactionResponse.transactionDetailFlow;
                const upsertResult = await outboundMlsRepository.upsertOutboundTransactionDetails({
                    rootInstanceIdentifier:
                        transactionResponse.rootInstanceIdentifier || queueRow.instanceIdentifier,
                    rootTransmissionType: transactionResponse.rootTransmissionType,
                    details
                });

                await outboundMlsRepository.updateQueueOutboundMls({
                    queueId: queueRow.QueueID,
                    outMls: details.length
                });

                insertedTransactions += upsertResult.insertedTransactions;
                updatedTransactions += upsertResult.updatedTransactions;
                skippedTransactions += upsertResult.skippedTransactions;
                processed += 1;
            } catch (error) {
                failed += 1;
                console.error(
                    `[OutboundMls ${new Date().toISOString()}] failed QueueID=${queueRow.QueueID}, ` +
                    `instanceIdentifier=${queueRow.instanceIdentifier}: ${error.message || error}`
                );
            }
        }

        return {
            queued: queueRows.length,
            processed,
            insertedTransactions,
            updatedTransactions,
            skippedTransactions,
            failed
        };
    } finally {
        isRunning = false;
    }
};

module.exports = {
    getOutboundTransactions,
    updateOutboundMls
};
