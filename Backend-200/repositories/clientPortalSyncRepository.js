const db = require("../db");

const normalizeText = (value) => {
    if (value === null || value === undefined || value === "") return null;
    return String(value);
};

const getSafeLimit = (limit) => {
    const numericLimit = Number(limit);
    return Number.isFinite(numericLimit) && numericLimit > 0
        ? Math.floor(numericLimit)
        : 10;
};

const getClientPortalConfig = async (client = db) => {
    const rows = await client.query`
        SELECT TOP (1)
            [id],
            [Ref],
            [RefCode],
            [PeppolId],
            [Period],
            [Volume]
        FROM [E_config]
        ORDER BY [id]
    `;

    return rows[0] || null;
};

const getPendingOutboundTransactions = async ({
    limit = 10,
    client = db
} = {}) =>
    client.query`
        SELECT TOP (${getSafeLimit(limit)})
            q.[QueueID],
            c.[RefCode] AS [clientCode],
            c.[PeppolId] AS [Peppolid],
            c.[Period],
            c.[Volume] AS [lastVolume],
            q.[instanceIdentifier] AS [InstanceIdentifier],
            CONVERT(varchar(10), q.[InvDate], 23) AS [DocDate],
            q.[InvNumber] AS [Invoiceno],
            CASE
                WHEN TRY_CONVERT(INT, q.[DocType]) = 4 THEN 'Invoice'
                ELSE 'CreditNote'
            END AS [Type],
            'outbound' AS [transtype]
        FROM [E_InvoiceQueue] q
        CROSS JOIN (
            SELECT TOP (1)
                [RefCode],
                [PeppolId],
                [Period],
                [Volume]
            FROM [E_config]
            ORDER BY [id]
        ) c
        WHERE ISNULL(q.[IsReceived], 0) = 1
          AND ISNULL(q.[IsPortal], 0) <> 1
        ORDER BY q.[QueueID]
    `;

const getPendingInboundTransactions = async ({
    limit = 10,
    client = db
} = {}) =>
    client.query`
        SELECT TOP (${getSafeLimit(limit)})
            q.[QueueId],
            c.[RefCode] AS [clientCode],
            c.[PeppolId] AS [Peppolid],
            c.[Period],
            c.[Volume] AS [lastVolume],
            q.[InstanceIdentifier],
            CONVERT(varchar(10), q.[TransCreatedAt], 23) AS [DocDate],
            q.[InvoiceNo] AS [Invoiceno],
            CASE
                WHEN TRY_CONVERT(INT, q.[InvoiceType]) = 380 THEN 'Invoice'
                WHEN TRY_CONVERT(INT, q.[InvoiceType]) = 381 THEN 'CreditNote'
                ELSE 'CreditNote'
            END AS [Type],
            'inbound' AS [transtype]
        FROM [E_PurchaseQueue] q
        CROSS JOIN (
            SELECT TOP (1)
                [RefCode],
                [PeppolId],
                [Period],
                [Volume]
            FROM [E_config]
            ORDER BY [id]
        ) c
        WHERE ISNULL(q.[IsInserted], 0) = 1
          AND ISNULL(q.[IsPortal], 0) <> 1
        ORDER BY q.[QueueId]
    `;

const buildIdClause = (ids = []) =>
    ids
        .map((id) => Number(id))
        .filter(Number.isFinite)
        .map((id) => Math.floor(id))
        .join(",");

const markOutboundTransactionsPortalSent = async ({
    queueIds,
    client = db
}) => {
    const idClause = buildIdClause(queueIds);
    if (!idClause) return 0;

    return client.executeUnsafe(`
        UPDATE [E_InvoiceQueue]
        SET [IsPortal] = 1
        WHERE [QueueID] IN (${idClause})
    `);
};

const markInboundTransactionsPortalSent = async ({
    queueIds,
    client = db
}) => {
    const idClause = buildIdClause(queueIds);
    if (!idClause) return 0;

    return client.executeUnsafe(`
        UPDATE [E_PurchaseQueue]
        SET [IsPortal] = 1
        WHERE [QueueId] IN (${idClause})
    `);
};

const updateClientPortalSubscription = async ({
    configId,
    periodId,
    volume,
    ref,
    client = db
}) =>
    client.execute`
        UPDATE [E_config]
        SET [Period] = ${periodId},
            [Volume] = ${volume},
            [Ref] = ${normalizeText(ref)}
        WHERE [id] = ${configId}
    `;

module.exports = {
    getClientPortalConfig,
    getPendingOutboundTransactions,
    getPendingInboundTransactions,
    markOutboundTransactionsPortalSent,
    markInboundTransactionsPortalSent,
    updateClientPortalSubscription
};
