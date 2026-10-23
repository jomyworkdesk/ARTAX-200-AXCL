const db = require("../db");

const PURCHASE_TABLE = "E_Purchase";
const IN_DOCUMENT_TABLE = "E_InvoiceinDocument";
const IN_DOCUMENT_COLUMNS = [
    "invoiced_obj_id",
    "invoiced_obj_scheme_id",
    "document_type_code",
    "support_doc_ref",
    "support_doc_desc",
    "attached_document",
    "attached_doc_mime_code",
    "attached_doc_filename",
    "external_doc_location"
];
const IN_DOCUMENT_COLUMN_SET = new Set(IN_DOCUMENT_COLUMNS.map((column) => column.toLowerCase()));

const normalizeText = (value) => {
    if (value === null || value === undefined || value === "") return null;
    return String(value);
};

const normalizeTextMax = (value, maxLength) => {
    const text = normalizeText(value);
    return text && maxLength ? text.slice(0, maxLength) : text;
};

const quoteIdentifier = (identifier) => `[${String(identifier).replace(/]/g, "]]")}]`;

const getPurchaseColumns = async (client = db) => {
    const rows = await client.query`
        SELECT
            [COLUMN_NAME],
            [DATA_TYPE],
            [CHARACTER_MAXIMUM_LENGTH]
        FROM [INFORMATION_SCHEMA].[COLUMNS]
        WHERE [TABLE_NAME] = ${PURCHASE_TABLE}
    `;

    return new Map(
        rows.map((row) => [
            String(row.COLUMN_NAME).toLowerCase(),
            {
                name: row.COLUMN_NAME,
                dataType: String(row.DATA_TYPE || "").toLowerCase(),
                maxLength: row.CHARACTER_MAXIMUM_LENGTH
            }
        ])
    );
};

const getInDocumentColumns = async (client = db) => {
    const rows = await client.query`
        SELECT
            [COLUMN_NAME],
            [DATA_TYPE],
            [CHARACTER_MAXIMUM_LENGTH]
        FROM [INFORMATION_SCHEMA].[COLUMNS]
        WHERE [TABLE_NAME] = ${IN_DOCUMENT_TABLE}
    `;

    return new Map(
        rows.map((row) => [
            String(row.COLUMN_NAME).toLowerCase(),
            {
                name: row.COLUMN_NAME,
                dataType: String(row.DATA_TYPE || "").toLowerCase(),
                maxLength: row.CHARACTER_MAXIMUM_LENGTH
            }
        ])
    );
};

const getCharacterLimit = (column) => {
    if (!column || column.maxLength === null || column.maxLength === undefined) return null;
    const maxLength = Number(column.maxLength);
    if (!Number.isFinite(maxLength) || maxLength < 0) return null;
    if (["nchar", "nvarchar"].includes(column.dataType)) return Math.floor(maxLength);
    if (["char", "varchar"].includes(column.dataType)) return maxLength;
    return null;
};

const prepareTableValue = (tableName, column, value) => {
    if (value === null || value === undefined) return null;

    if (["binary", "varbinary", "image"].includes(column.dataType)) {
        if (Buffer.isBuffer(value)) return value;
        return Buffer.from(String(value), "base64");
    }

    const limit = getCharacterLimit(column);
    if (limit && typeof value === "string" && value.length > limit) {
        throw new Error(
            `${tableName}.${column.name} length ${value.length} exceeds max ${limit}`
        );
    }

    return value;
};

const preparePurchaseValue = (column, value) => prepareTableValue(PURCHASE_TABLE, column, value);
const prepareInDocumentValue = (column, value) => prepareTableValue(IN_DOCUMENT_TABLE, column, value);

const isServerTimestampColumn = (column) =>
    ["created_at", "updated_at"].includes(String(column?.name || "").toLowerCase());

const hasActivePurchaseProcess = async (client = db) => {
    const rows = await client.query`
        SELECT TOP (1) [QueueId]
        FROM [E_PurchaseQueue]
        WHERE ISNULL([IsProcessing], 0) = 1
          AND [ProcessEndedAt] IS NULL
    `;

    return rows.length > 0;
};

const getQueuedInstancesByCorrelationId = async ({ correlationId, client = db }) =>
    client.query`
        SELECT
            [QueueId],
            [InstanceIdentifier],
            [CorrelationId]
        FROM [E_PurchaseQueue]
        WHERE [CorrelationId] = ${normalizeText(correlationId)}
          AND ISNULL([IsProcessing], 0) = 1
          AND ISNULL([IsTrans], 0) = 0
        ORDER BY [QueueId]
    `;

const getIncompleteTransactionQueueRows = async ({ limit = 100, client = db } = {}) =>
    client.query`
        SELECT TOP (${Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : 100})
            [QueueId],
            [InstanceIdentifier],
            [TransactionId],
            [TransCount]
        FROM [E_PurchaseQueue]
        WHERE [InstanceIdentifier] IS NOT NULL
          AND (TRY_CONVERT(INT, [TransCount]) IS NULL OR TRY_CONVERT(INT, [TransCount]) <> 4)
        ORDER BY [QueueId]
    `;

const getQueuedTransactionsByCorrelationId = async ({ correlationId, client = db }) =>
    client.query`
        SELECT
            [QueueId],
            [InstanceIdentifier],
            [CorrelationId],
            [TransactionId]
        FROM [E_PurchaseQueue]
        WHERE [CorrelationId] = ${normalizeText(correlationId)}
          AND ISNULL([IsProcessing], 0) = 1
          AND ISNULL([IsTrans], 0) = 1
          AND ISNULL([IsInserted], 0) = 0
          AND [TransactionId] IS NOT NULL
        ORDER BY [QueueId]
    `;

const getQueuedInsertedInvoicesByCorrelationId = async ({ correlationId, client = db }) =>
    client.query`
        SELECT
            [QueueId],
            [InstanceIdentifier],
            [CorrelationId],
            [TransactionId],
            [InvoiceNo],
            [InvoiceType]
        FROM [E_PurchaseQueue]
        WHERE [CorrelationId] = ${normalizeText(correlationId)}
          AND ISNULL([IsProcessing], 0) = 1
          AND ISNULL([IsInserted], 0) = 1
          AND ISNULL([IsMail], 0) = 0
        ORDER BY [QueueId]
    `;

const getMailConfig = async (client = db) => {
    const rows = await client.query`
        SELECT TOP (1)
            [tomail],
            [ccmail]
        FROM [E_config]
        ORDER BY [id]
    `;

    return rows[0] || null;
};

const getPurchaseRowsByInstanceIdentifier = async ({ instanceIdentifier, client = db }) =>
    client.query`
        SELECT *
        FROM [E_Purchase]
        WHERE [InstanceIdentifier] = ${normalizeText(instanceIdentifier)}
        ORDER BY [ID]
    `;

const insertEmailLog = async ({
    queueId,
    receiverId,
    instanceIdentifier,
    invoiceType,
    toMail,
    ccMail,
    subject,
    status,
    providerMessageId,
    errorMessage,
    sentAt = null,
    client = db
}) =>
    client.execute`
        INSERT INTO [E_EmailLog] (
            [QueueId],
            [ReceiverId],
            [InstanceIdentifier],
            [InvoiceType],
            [ToMail],
            [CcMail],
            [Subject],
            [Status],
            [ProviderMessageId],
            [ErrorMessage],
            [SentAt],
            [EventAt],
            [CreatedAt]
        )
        VALUES (
            ${queueId},
            ${normalizeText(receiverId)},
            ${normalizeText(instanceIdentifier)},
            ${normalizeText(invoiceType)},
            ${normalizeText(toMail)},
            ${normalizeText(ccMail)},
            ${normalizeText(subject)},
            ${normalizeText(status)},
            ${normalizeText(providerMessageId)},
            ${normalizeTextMax(errorMessage, 3900)},
            ${sentAt},
            GETDATE(),
            GETDATE()
        )
    `;

const insertInstanceIdentifiers = async ({
    identifiers,
    correlationId,
    startDate,
    endDate,
    client = db
}) => {
    let insertedInstances = 0;
    let insertedQueue = 0;
    let skipped = 0;

    for (const item of identifiers) {
        const instanceIdentifier = normalizeText(item?.instanceIdentifier);
        if (!instanceIdentifier) {
            skipped += 1;
            continue;
        }

        const rows = await client.query`
            SELECT TOP (1) [InstanceIdentifier]
            FROM [E_Get_InstanceIdentifiers]
            WHERE [InstanceIdentifier] = ${instanceIdentifier}
        `;

        const exists = rows.length > 0;

        if (!exists) {
            insertedInstances += await client.execute`
                INSERT INTO [E_Get_InstanceIdentifiers] (
                    [InstanceIdentifier],
                    [TransmissionType],
                    [Status],
                    [StartDate],
                    [EndDate],
                    [IsProcessed],
                    [CreatedAt]
                )
                VALUES (
                    ${instanceIdentifier},
                    ${normalizeText(item?.transmissionType)},
                    ${normalizeText(item?.status)},
                    ${startDate},
                    ${endDate},
                    0,
                    GETDATE()
                )
            `;
        }

        const queueRows = await client.query`
            SELECT TOP (1) [InstanceIdentifier]
            FROM [E_PurchaseQueue]
            WHERE [InstanceIdentifier] = ${instanceIdentifier}
        `;

        if (queueRows.length > 0) {
            skipped += 1;
            continue;
        }

        insertedQueue += await client.execute`
            INSERT INTO [E_PurchaseQueue] (
                [InstanceIdentifier],
                [CorrelationId],
                [TransmissionType],
                [ApiStatus],
                [IsInstance],
                [InstanceAt],
                [IsProcessing],
                [Status],
                [ProcessingStatus],
                [ProcessStartedAt],
                [ProcessEndedAt],
                [CreatedAt],
                [UpdatedAt]
            )
            VALUES (
                ${instanceIdentifier},
                ${normalizeText(correlationId)},
                ${normalizeText(item?.transmissionType)},
                ${normalizeText(item?.status)},
                1,
                GETDATE(),
                1,
                2,
                ${normalizeText("InstanceIdentifier Received")},
                GETDATE(),
                NULL,
                GETDATE(),
                GETDATE()
            )
        `;
    }

    return {
        insertedInstances,
        insertedQueue,
        skipped
    };
};

const toBit = (value) => {
    if (value === true || value === 1) return 1;
    if (typeof value === "string" && value.toLowerCase() === "true") return 1;
    return 0;
};

const insertTransactionDetails = async ({
    rootInstanceIdentifier,
    rootTransmissionType,
    details,
    client = db
}) => {
    let insertedTransactions = 0;

    for (const detail of details) {
        insertedTransactions += await client.execute`
            INSERT INTO [E_Get_Transaction] (
                [RootInstanceIdentifier],
                [RootTransmissionType],
                [TransactionId],
                [TransmissionType],
                [Status],
                [SenderParticipantId],
                [ReceiverParticipantId],
                [InstanceIdentifier],
                [RefInstanceIdentifier],
                [ErrorDetails],
                [C5DispatchStatus],
                [CreatedDate],
                [LastModifiedDate],
                [HasFile],
                [InsertedOn]
            )
            VALUES (
                ${normalizeText(rootInstanceIdentifier)},
                ${normalizeText(rootTransmissionType)},
                ${normalizeText(detail?.transactionId)},
                ${normalizeText(detail?.transmissionType)},
                ${normalizeText(detail?.status)},
                ${normalizeText(detail?.senderParticipantId)},
                ${normalizeText(detail?.receiverParticipantId)},
                ${normalizeText(detail?.instanceIdentifier)},
                ${normalizeText(detail?.refInstanceIdentifier)},
                ${normalizeText(detail?.errorDetails)},
                ${normalizeText(detail?.c5DispatchStatus)},
                ${normalizeText(detail?.createdDate)},
                ${normalizeText(detail?.lastModifiedDate)},
                ${toBit(detail?.hasFile)},
                GETDATE()
            )
        `;
    }

    return insertedTransactions;
};

const upsertTransactionDetails = async ({
    rootInstanceIdentifier,
    rootTransmissionType,
    details,
    client = db
}) => {
    let insertedTransactions = 0;
    let updatedTransactions = 0;
    let skippedTransactions = 0;

    for (const detail of details) {
        const transactionId = normalizeText(detail?.transactionId);

        if (!transactionId) {
            skippedTransactions += 1;
            continue;
        }

        const updated = await client.execute`
            UPDATE [E_Get_Transaction]
            SET [RootTransmissionType] = ${normalizeText(rootTransmissionType)},
                [TransmissionType] = ${normalizeText(detail?.transmissionType)},
                [Status] = ${normalizeText(detail?.status)},
                [SenderParticipantId] = ${normalizeText(detail?.senderParticipantId)},
                [ReceiverParticipantId] = ${normalizeText(detail?.receiverParticipantId)},
                [InstanceIdentifier] = ${normalizeText(detail?.instanceIdentifier)},
                [RefInstanceIdentifier] = ${normalizeText(detail?.refInstanceIdentifier)},
                [ErrorDetails] = ${normalizeText(detail?.errorDetails)},
                [C5DispatchStatus] = ${normalizeText(detail?.c5DispatchStatus)},
                [CreatedDate] = ${normalizeText(detail?.createdDate)},
                [LastModifiedDate] = ${normalizeText(detail?.lastModifiedDate)},
                [HasFile] = ${toBit(detail?.hasFile)}
            WHERE [RootInstanceIdentifier] = ${normalizeText(rootInstanceIdentifier)}
              AND [TransactionId] = ${transactionId}
        `;

        if (updated > 0) {
            updatedTransactions += 1;
            continue;
        }

        insertedTransactions += await client.execute`
            INSERT INTO [E_Get_Transaction] (
                [RootInstanceIdentifier],
                [RootTransmissionType],
                [TransactionId],
                [TransmissionType],
                [Status],
                [SenderParticipantId],
                [ReceiverParticipantId],
                [InstanceIdentifier],
                [RefInstanceIdentifier],
                [ErrorDetails],
                [C5DispatchStatus],
                [CreatedDate],
                [LastModifiedDate],
                [HasFile],
                [InsertedOn]
            )
            VALUES (
                ${normalizeText(rootInstanceIdentifier)},
                ${normalizeText(rootTransmissionType)},
                ${transactionId},
                ${normalizeText(detail?.transmissionType)},
                ${normalizeText(detail?.status)},
                ${normalizeText(detail?.senderParticipantId)},
                ${normalizeText(detail?.receiverParticipantId)},
                ${normalizeText(detail?.instanceIdentifier)},
                ${normalizeText(detail?.refInstanceIdentifier)},
                ${normalizeText(detail?.errorDetails)},
                ${normalizeText(detail?.c5DispatchStatus)},
                ${normalizeText(detail?.createdDate)},
                ${normalizeText(detail?.lastModifiedDate)},
                ${toBit(detail?.hasFile)},
                GETDATE()
            )
        `;
    }

    return {
        insertedTransactions,
        updatedTransactions,
        skippedTransactions
    };
};

const updateQueueTransaction = async ({
    queueId,
    transactionId,
    transCreatedAt,
    transCount,
    client = db
}) =>
    client.execute`
        UPDATE [E_PurchaseQueue]
        SET [TransactionId] = ${normalizeText(transactionId)},
            [TransCount] = ${Number.isFinite(Number(transCount)) ? Number(transCount) : 0},
            [IsTrans] = 1,
            [TransAt] = GETDATE(),
            [TransCreatedAt] = ${normalizeText(transCreatedAt)},
            [Status] = 3,
            [ProcessingStatus] = ${normalizeText("Transactions Received")},
            [UpdatedAt] = GETDATE()
        WHERE [QueueId] = ${queueId}
    `;

const getFirstValue = (rows, key) =>
    rows.find((row) => row[key] !== undefined && row[key] !== null && row[key] !== "")?.[key] || null;

const hasInDocumentValue = (row) =>
    IN_DOCUMENT_COLUMNS.some((column) => {
        const value = row?.[column];
        return value !== null && value !== undefined && value !== "";
    });

const buildInDocumentData = (rows, purchaseIds) => {
    const sourceRow = rows.find(hasInDocumentValue);
    const purchaseId = purchaseIds[0];

    if (!sourceRow || !purchaseId) return null;

    return {
        EinvoiceID: purchaseId,
        invoice_no: getFirstValue(rows, "invoice_no"),
        ...Object.fromEntries(IN_DOCUMENT_COLUMNS.map((column) => [column, sourceRow[column]]))
    };
};

const insertInDocument = async ({ row, client = db }) => {
    if (!row) return null;

    const columns = await getInDocumentColumns(client);
    const rowValues = new Map(
        Object.entries(row).map(([key, value]) => [String(key).toLowerCase(), value])
    );
    const entries = ["EinvoiceID", "invoice_no", ...IN_DOCUMENT_COLUMNS]
        .map((key) => columns.get(String(key).toLowerCase()))
        .filter(Boolean);

    if (!entries.length) return null;

    const columnSql = entries.map((column) => quoteIdentifier(column.name)).join(", ");
    const valueSql = entries.map((_, index) => `@p${index}`).join(", ");
    const values = entries.map((column) =>
        prepareInDocumentValue(column, rowValues.get(String(column.name).toLowerCase()))
    );
    const insertedRows = await client.queryStatement(
        `INSERT INTO [${IN_DOCUMENT_TABLE}] (${columnSql})
         OUTPUT INSERTED.[ID] AS [ID]
         VALUES (${valueSql})`,
        values
    );

    return insertedRows[0]?.ID || null;
};

const updatePurchaseInDocument = async ({ purchaseIds, inDocumentId, client = db }) => {
    if (!inDocumentId || !Array.isArray(purchaseIds) || !purchaseIds.length) return 0;

    const idSql = purchaseIds.map((_, index) => `@p${index + 1}`).join(", ");

    return client.executeStatement(
        `UPDATE [${PURCHASE_TABLE}]
         SET [inDocument] = @p0
         WHERE [ID] IN (${idSql})`,
        [inDocumentId, ...purchaseIds]
    );
};

const insertPurchaseRows = async ({ rows, client = db }) => {
    if (!Array.isArray(rows) || !rows.length) return 0;

    const insertRows = async (activeClient) => {
        const columns = await getPurchaseColumns(activeClient);
        let inserted = 0;
        const purchaseIds = [];

        for (const row of rows) {
            const entries = Object.entries(row)
                .filter(([key]) => !IN_DOCUMENT_COLUMN_SET.has(String(key).toLowerCase()))
                .map(([key, value]) => [columns.get(String(key).toLowerCase()), value])
                .filter(([column]) => Boolean(column));

            if (!entries.length) continue;

            const values = [];
            const valueSql = entries.map(([column, value]) => {
                if (isServerTimestampColumn(column)) return "GETDATE()";

                values.push(preparePurchaseValue(column, value));
                return `@p${values.length - 1}`;
            }).join(", ");
            const columnSql = entries.map(([column]) => quoteIdentifier(column.name)).join(", ");
            const insertedRows = await activeClient.queryStatement(
                `INSERT INTO [${PURCHASE_TABLE}] (${columnSql})
                 OUTPUT INSERTED.[ID] AS [ID]
                 VALUES (${valueSql})`,
                values
            );
            const purchaseId = insertedRows[0]?.ID;

            if (!purchaseId) {
                throw new Error("Failed to capture inserted purchase row ID");
            }

            purchaseIds.push(purchaseId);
            inserted += 1;
        }

        const inDocumentData = buildInDocumentData(rows, purchaseIds);

        if (inDocumentData) {
            const inDocumentId = await insertInDocument({
                row: inDocumentData,
                client: activeClient
            });

            if (!inDocumentId) {
                throw new Error("Failed to insert purchase supporting document");
            }

            await updatePurchaseInDocument({
                purchaseIds,
                inDocumentId,
                client: activeClient
            });
        }

        return inserted;
    };

    if (client !== db) {
        return insertRows(client);
    }

    return db.withTransaction(insertRows);
};

const updateQueueInvoiceInserted = async ({
    queueId,
    senderId,
    invoiceNo,
    invoiceType,
    client = db
}) =>
    client.execute`
        UPDATE [E_PurchaseQueue]
        SET [SenderId] = ${normalizeText(senderId)},
            [InvoiceNo] = ${normalizeText(invoiceNo)},
            [InvoiceType] = ${normalizeText(invoiceType)},
            [IsInserted] = 1,
            [IsInsertedAt] = GETDATE(),
            [Status] = 4,
            [ProcessingStatus] = ${normalizeText("Invoice Received")},
            [UpdatedAt] = GETDATE()
        WHERE [QueueId] = ${queueId}
    `;

const updateQueueMailSent = async ({
    queueId,
    toMail,
    client = db
}) =>
    client.execute`
        UPDATE [E_PurchaseQueue]
        SET [IsMail] = 1,
            [MailId] = ${normalizeText(toMail)},
            [IsMailAt] = GETDATE(),
            [ProcessingStatus] = ${normalizeText("Mail sent")},
            [Status] = 5,
            [IsProcessing] = 0,
            [ProcessEndedAt] = GETDATE(),
            [UpdatedAt] = GETDATE()
        WHERE [QueueId] = ${queueId}
    `;

const updateQueueError = async ({
    queueId,
    error,
    client = db
}) =>
    client.execute`
        UPDATE [E_PurchaseQueue]
        SET [ErrorCode] = 1,
            [ErrorMessage] = LEFT(
                CAST(${normalizeTextMax(error?.message || error || "Purchase download failed", 3900)} AS NVARCHAR(MAX)),
                CASE
                    WHEN COL_LENGTH('E_PurchaseQueue', 'ErrorMessage') IS NULL THEN 3900
                    WHEN COL_LENGTH('E_PurchaseQueue', 'ErrorMessage') < 0 THEN 3900
                    WHEN COL_LENGTH('E_PurchaseQueue', 'ErrorMessage') / 2 < 1 THEN 1
                    ELSE COL_LENGTH('E_PurchaseQueue', 'ErrorMessage') / 2
                END
            ),
            [IsProcessing] = 0,
            [ProcessEndedAt] = GETDATE(),
            [UpdatedAt] = GETDATE()
        WHERE [QueueId] = ${queueId}
    `;

module.exports = {
    getIncompleteTransactionQueueRows,
    getQueuedInstancesByCorrelationId,
    getQueuedInsertedInvoicesByCorrelationId,
    getQueuedTransactionsByCorrelationId,
    getMailConfig,
    getPurchaseRowsByInstanceIdentifier,
    hasActivePurchaseProcess,
    insertEmailLog,
    insertInstanceIdentifiers,
    insertTransactionDetails,
    upsertTransactionDetails,
    insertPurchaseRows,
    updateQueueInvoiceInserted,
    updateQueueError,
    updateQueueMailSent,
    updateQueueTransaction
};
