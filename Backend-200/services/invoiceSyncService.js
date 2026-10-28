const db = require("../db");
const invoiceSyncRepository = require("../repositories/invoiceSyncRepository");

const DEADLOCK_MAX_ATTEMPTS = 3;
const DEADLOCK_RETRY_DELAY_MS = 500;
let isRunning = false;

const runWithDeadlockRetry = async (operation, worker) => {
    for (let attempt = 1; ; attempt += 1) {
        try {
            return await worker();
        } catch (error) {
            error.syncOperation = operation;
            const errorNumber = Number(error.number ?? error.originalError?.info?.number);

            // Timeouts can have an uncertain outcome; retry only rolled-back deadlocks.
            if (errorNumber !== 1205 || attempt >= DEADLOCK_MAX_ATTEMPTS) {
                throw error;
            }

            const delay = DEADLOCK_RETRY_DELAY_MS * attempt + Math.floor(Math.random() * 250);
            console.warn(`Sage Transaction Sync deadlock during ${operation}; retrying (${attempt + 1}/${DEADLOCK_MAX_ATTEMPTS}) in ${delay}ms`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
};

const normalizeAutoIndex = (value) => {
    const autoIndex = Number(value);
    return Number.isFinite(autoIndex) && autoIndex > 0 ? autoIndex : null;
};

const hasDocumentNumber = (value) =>
    value !== null && value !== undefined && String(value).trim() !== "";

const getDocumentKey = (document) => {
    const autoIndex = normalizeAutoIndex(document?.AutoIndex);
    if (autoIndex !== null) return `auto:${autoIndex}`;

    return `inv:${String(document.InvNumber).trim()}::${document.DocType ?? ""}`;
};

const getDocumentMatchKeys = (document) => {
    const keys = [];
    const autoIndex = normalizeAutoIndex(document?.AutoIndex);

    if (autoIndex !== null) keys.push(`auto:${autoIndex}`);
    if (hasDocumentNumber(document?.InvNumber)) {
        keys.push(`inv:${String(document.InvNumber).trim()}::${document.DocType ?? ""}`);
    }

    return keys;
};

const normalizeDocuments = (documents = [], defaultDocType = null) => {
    const seen = new Set();
    const normalized = [];

    documents.forEach((document) => {
        const InvNumber = typeof document === "object" ? document.InvNumber : document;
        const AutoIndex = typeof document === "object" ? normalizeAutoIndex(document.AutoIndex) : null;
        const rawDocType = typeof document === "object" ? document.DocType : defaultDocType;
        const DocType = rawDocType === null || rawDocType === undefined || rawDocType === ""
            ? null
            : Number(rawDocType);

        if (AutoIndex === null && !hasDocumentNumber(InvNumber)) return;

        const normalizedDocument = {
            InvNumber: hasDocumentNumber(InvNumber) ? String(InvNumber).trim() : InvNumber,
            AutoIndex,
            DocType: Number.isFinite(DocType) ? DocType : null
        };
        const key = getDocumentKey(normalizedDocument);

        if (!seen.has(key)) {
            seen.add(key);
            normalized.push(normalizedDocument);
        }
    });

    return normalized;
};

const syncInvoiceNumbers = async (documents = [], defaultDocType = null) => {
    const sanitizedDocuments = normalizeDocuments(documents, defaultDocType);

    if (sanitizedDocuments.length === 0) {
        return {
            requested: 0,
            processed: 0
        };
    }

    const rows = await runWithDeadlockRetry("fetch invoice source rows", () =>
        invoiceSyncRepository.fetchInvoiceSourceRows(db, sanitizedDocuments)
    );
    const uniqueRows = [
        ...new Map(
            rows.map((row) => [row.InvoiceLineIdentifier, row])
        ).values()
    ];

    // Keep the existence check and write atomic, with no competing writes from this run.
    for (const row of uniqueRows) {
        await runWithDeadlockRetry(`upsert invoice line ${row.InvoiceLineIdentifier}`, () =>
            db.withTransaction((tx) => invoiceSyncRepository.upsertInvoiceRow(tx, row))
        );
    }

    const fetchedDocuments = [
        ...new Map(
            uniqueRows
                .filter((row) => row.InvoiceNumber)
                .map((row) => [
                    getDocumentKey({ AutoIndex: row.ReferenceNumber, InvNumber: row.InvoiceNumber, DocType: row.DocType }),
                    { AutoIndex: row.ReferenceNumber, InvNumber: row.InvoiceNumber, DocType: row.DocType }
                ])
        ).values()
    ];

    return {
        requested: sanitizedDocuments.length,
        processed: fetchedDocuments.length,
        fetchedInvoiceNumbers: [...new Set(fetchedDocuments.map((row) => row.InvNumber))],
        fetchedDocuments
    };
};

const syncInvoices = async () => {
    if (isRunning) {
        console.log("Job already running, skipping...");
        return {
            skipped: true,
            message: "Sage Transaction Sync is already running"
        };
    }

    isRunning = true;
    let queueData = [];

    try {
        queueData = await runWithDeadlockRetry("claim queue entries", () =>
            db.withTransaction((tx) => invoiceSyncRepository.lockPendingQueue(tx))
        );

        if (queueData.length === 0) {
            return {
                requested: 0,
                processed: 0,
                matched: 0,
                unmatched: 0,
                noNewTransactions: true,
                message: "No new Transaction exist"
            };
        }

        console.log(`Sage Transaction Sync processing ${queueData.length} document(s)`);

        const syncResult = await syncInvoiceNumbers(queueData);
        const fetchedDocumentKeys = new Set(
            (syncResult.fetchedDocuments || []).flatMap(getDocumentMatchKeys)
        );
        const hasFetchedDocument = (queueRow) =>
            getDocumentMatchKeys(queueRow).some((key) => fetchedDocumentKeys.has(key));

        const matchedQueueRows = queueData.filter(hasFetchedDocument);
        const unmatchedQueueRows = queueData.filter((queueRow) => !hasFetchedDocument(queueRow));

        await runWithDeadlockRetry("complete queue entries", () =>
            db.withTransaction(async (tx) => {
                await invoiceSyncRepository.markQueueInvoiced(tx, matchedQueueRows);
                await invoiceSyncRepository.releaseQueueEntries(tx, unmatchedQueueRows);
            })
        );

        console.log("Sage Transaction Sync Completed");
        return {
            requested: queueData.length,
            processed: syncResult.processed,
            matched: matchedQueueRows.length,
            unmatched: unmatchedQueueRows.length
        };
    } catch (error) {
        console.error("Sync Error:", error);
        if (queueData.length > 0) {
            try {
                await runWithDeadlockRetry("release claimed queue entries", () =>
                    invoiceSyncRepository.releaseQueueEntries(db, queueData)
                );
            } catch (releaseError) {
                console.error("Failed to release sync queue entries:", releaseError);
            }
        }
        throw error;
    } finally {
        isRunning = false;
    }
};

const syncSelectedInvoices = async (invNumbers = [], docType = null) => {
    if (isRunning) {
        throw new Error("Sage Transaction Sync is already running");
    }

    isRunning = true;

    try {
        const result = await syncInvoiceNumbers(invNumbers, docType);

        if (result.processed === 0) {
            throw new Error("The selected invoice was not found in Sage or has no invoice lines to synchronize");
        }

        return result;
    } finally {
        isRunning = false;
    }
};

module.exports = {
    syncInvoices,
    syncSelectedInvoices
};
