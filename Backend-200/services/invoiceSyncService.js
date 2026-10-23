const db = require("../db");
const invoiceSyncRepository = require("../repositories/invoiceSyncRepository");

const UPSERT_CONCURRENCY = 5;
let isRunning = false;

const runWithConcurrency = async (items, limit, worker) => {
    let index = 0;
    const workerCount = Math.min(limit, items.length);

    const workers = Array.from({ length: workerCount }, async () => {
        while (index < items.length) {
            const currentIndex = index;
            index += 1;
            await worker(items[currentIndex]);
        }
    });

    await Promise.all(workers);
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

    const rows = await invoiceSyncRepository.fetchInvoiceSourceRows(
        db,
        sanitizedDocuments
    );
    const uniqueRows = [
        ...new Map(
            rows.map((row) => [row.InvoiceLineIdentifier, row])
        ).values()
    ];

    await runWithConcurrency(uniqueRows, UPSERT_CONCURRENCY, (row) =>
        invoiceSyncRepository.upsertInvoiceRow(db, row)
    );

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

    try {
        const queueData = await db.withTransaction((tx) =>
            invoiceSyncRepository.lockPendingQueue(tx)
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

        await db.withTransaction(async (tx) => {
                await invoiceSyncRepository.markQueueInvoiced(tx, matchedQueueRows);
                await invoiceSyncRepository.releaseQueueEntries(tx, unmatchedQueueRows);
            });

        console.log("Sage Transaction Sync Completed");
        return {
            requested: queueData.length,
            processed: syncResult.processed,
            matched: matchedQueueRows.length,
            unmatched: unmatchedQueueRows.length
        };
    } catch (error) {
        console.error("Sync Error:", error);
        await invoiceSyncRepository.releaseStuckQueue();
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
