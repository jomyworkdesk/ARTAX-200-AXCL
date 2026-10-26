const db = require("../db");
const { sqlInt } = require("../utils/sqlCompatibility");

const normalizeText = (value) => {
    if (value === null || value === undefined || value === "") return null;
    return String(value);
};

const markSentByInvoiceNumber = async ({ invNumber, docType, instanceIdentifier }) => {
    if (!invNumber) return 0;

    if (docType === null || docType === undefined) {
        const affected = await db.execute`
            UPDATE E_InvoiceQueue
            SET [instanceIdentifier] = ${normalizeText(instanceIdentifier)},
                IsSent = 1,
                [Status] = 2,
                SentAt = GETDATE()
            WHERE InvNumber = ${normalizeText(invNumber)}
        `;

        return affected || 0;
    }

    const affected = await db.execute`
        UPDATE E_InvoiceQueue
        SET [instanceIdentifier] = ${normalizeText(instanceIdentifier)},
            IsSent = 1,
            [Status] = 2,
            SentAt = GETDATE()
        WHERE InvNumber = ${normalizeText(invNumber)}
          AND DocType = ${docType}
    `;

    return affected || 0;
};

const markArtaxErrorByInvoiceNumber = async ({ invNumber, docType, errorMessage }) => {
    if (!invNumber) return 0;

    const updateInvNumArtaxErrorStatus = async () => {
        if (docType === null || docType === undefined) {
            await db.execute`
                UPDATE I
                SET   ucIDSOrdEinvoiceStatus = ${normalizeText("Error")},
                      ucIDCrnEinvoiceStatus = ${normalizeText("Error")}
                FROM InvNum I
                INNER JOIN E_InvoiceQueue q ON I.InvNumber = q.InvNumber AND (
                    (I.DocType = q.DocType) OR (I.DocType IS NULL AND q.DocType IS NULL)
                )
                WHERE q.InvNumber = ${normalizeText(invNumber)}
                  AND q.[Status] IN (6)
            `;
            return;
        }

        await db.execute`
            UPDATE I
            SET   ucIDSOrdEinvoiceStatus = ${normalizeText("Error")},
                  ucIDCrnEinvoiceStatus = ${normalizeText("Error")}
            FROM InvNum I
            INNER JOIN E_InvoiceQueue q ON I.InvNumber = q.InvNumber AND (
                (I.DocType = q.DocType) OR (I.DocType IS NULL AND q.DocType IS NULL)
            )
            WHERE q.InvNumber = ${normalizeText(invNumber)}
              AND q.[Status] IN (6)
              AND q.DocType = ${docType}
        `;
    };

    if (docType === null || docType === undefined) {
        const affected = await db.execute`
            UPDATE E_InvoiceQueue
            SET IsArtaxError = 1,
                IsArtaxErrorAt = GETDATE(),
                IsProcessing = 0,
                [Status] = 6,
                ErrorMessage = ${normalizeText(errorMessage)}
            WHERE InvNumber = ${normalizeText(invNumber)}
        `;

        await updateInvNumArtaxErrorStatus();
        return affected || 0;
    }

    const affected = await db.execute`
        UPDATE E_InvoiceQueue
        SET IsArtaxError = 1,
            IsArtaxErrorAt = GETDATE(),
            IsProcessing = 0,
            [Status] = 6,
            ErrorMessage = ${normalizeText(errorMessage)}
        WHERE InvNumber = ${normalizeText(invNumber)}
          AND DocType = ${docType}
    `;

    await updateInvNumArtaxErrorStatus();
    return affected || 0;
};

const markArtaxErrorsByInvoiceNumbers = async ({ invoiceNumbers, docType, errorMessage }) => {
    if (!Array.isArray(invoiceNumbers) || invoiceNumbers.length === 0) return 0;

    let affected = 0;
    for (const invNumber of invoiceNumbers) {
        affected += await markArtaxErrorByInvoiceNumber({
            invNumber,
            docType,
            errorMessage
        });
    }

    return affected;
};

const lockAutoSendQueue = async (client = db, batchSize = 5) => {
    const result = await client.queryStatement(`
        ;WITH next_queue AS (
            SELECT TOP (@p0) q.QueueID
            FROM E_InvoiceQueue q
            WHERE ${sqlInt("q.autosend")} = 1
              AND q.DocType IN (1, 4)
              AND ISNULL(q.IsInvoiced, 0) = 1
              AND ISNULL(q.IsArtax, 0) = 0
              AND ISNULL(q.IsSent, 0) = 0
              AND ISNULL(q.IsProcessing, 0) = 0
              AND ISNULL(q.IsError, 0) = 0
              AND ${sqlInt("q.Status")} = 1
              AND EXISTS (
                  SELECT 1
                  FROM E_Invoicing e
                  WHERE e.invoice_no = q.InvNumber
                    AND e.DocType = q.DocType
                    AND (
                        q.DocType <> 1
                        OR NULLIF(LTRIM(RTRIM(e.preceding_invoice_ref)), '') IS NOT NULL
                    )
              )
            ORDER BY q.QueueID ASC
        )
        UPDATE E_InvoiceQueue
        SET IsProcessing = 1
        OUTPUT inserted.QueueID, inserted.AutoIndex, inserted.DocType, inserted.InvNumber
        WHERE QueueID IN (SELECT QueueID FROM next_queue)
    `, [batchSize]);

    return result;
};

const getAutoSendQueueStatus = async (client = db) => {
    const rows = await client.queryStatement(`
        ;WITH queue_status AS (
            SELECT
                q.autosend,
                q.IsInvoiced,
                q.IsArtax,
                q.IsSent,
                q.IsProcessing,
                q.IsError,
                q.Status,
                CASE WHEN EXISTS (
                    SELECT 1
                    FROM E_Invoicing e
                    WHERE e.invoice_no = q.InvNumber
                      AND e.DocType = q.DocType
                      AND (
                          q.DocType <> 1
                          OR NULLIF(LTRIM(RTRIM(e.preceding_invoice_ref)), '') IS NOT NULL
                      )
                ) THEN 1 ELSE 0 END AS HasEInvoicing
            FROM E_InvoiceQueue q
        )
        SELECT
            COUNT(CASE WHEN ${sqlInt("autosend")} = 1 THEN 1 END) AS autoSendOn,
            COUNT(CASE WHEN ${sqlInt("autosend")} = 2 THEN 1 END) AS autoSendOff,
            COUNT(CASE WHEN ${sqlInt("autosend")} = 1
                         AND ISNULL(IsInvoiced, 0) = 1
                         AND ISNULL(IsArtax, 0) = 0
                         AND ISNULL(IsSent, 0) = 0
                         AND ISNULL(IsProcessing, 0) = 0
                         AND ISNULL(IsError, 0) = 0
                         AND ${sqlInt("Status")} = 1
                         AND HasEInvoicing = 1
                       THEN 1 END) AS readyToSend,
            COUNT(CASE WHEN ${sqlInt("autosend")} = 1
                         AND ISNULL(IsInvoiced, 0) = 0
                       THEN 1 END) AS waitingForEInvoicing,
            COUNT(CASE WHEN ${sqlInt("autosend")} = 1
                         AND ISNULL(IsProcessing, 0) = 1
                       THEN 1 END) AS processing,
            COUNT(CASE WHEN ${sqlInt("autosend")} = 1
                         AND ISNULL(IsSent, 0) = 1
                       THEN 1 END) AS sent,
            COUNT(CASE WHEN ${sqlInt("autosend")} = 1
                         AND ISNULL(IsError, 0) = 1
                       THEN 1 END) AS error
        FROM queue_status
    `);

    return rows[0] || {};
};

const releaseQueueEntries = async (client = db, queueRows = []) => {
    if (!queueRows.length) return 0;

    const queueClause = queueRows
        .map((row) => Number(row.QueueID))
        .filter(Number.isFinite)
        .join(",");

    if (!queueClause) return 0;

    return client.executeUnsafe(`
        UPDATE E_InvoiceQueue
        SET IsProcessing = 0
        WHERE QueueID IN (${queueClause})
    `);
};

const markResponseByInstanceIdentifier = async ({ instanceIdentifier, isSuccess }) => {
    if (!instanceIdentifier) return 0;
    const affected = await db.execute`
        UPDATE E_InvoiceQueue
        SET IsReceived = ${isSuccess ? 1 : 0},
            IsError = ${isSuccess ? 0 : 1},
            IsProcessing = 0,
            [Status] = ${isSuccess ? 3 : 4},
            ReceivedAt = CASE WHEN ${isSuccess ? 1 : 0} = 1 THEN GETDATE() ELSE ReceivedAt END,
            ErrorAt = CASE WHEN ${isSuccess ? 1 : 0} = 1 THEN ErrorAt ELSE GETDATE() END
        WHERE [instanceIdentifier] = ${normalizeText(instanceIdentifier)}
    `;

    // Update InvNum status fields (statuses 3 (success) and 4 (failed)) to human-readable values
    await db.execute`
        UPDATE I
        SET   ucIDSOrdEinvoiceStatus = ${isSuccess ? normalizeText("Success") : normalizeText("Failed")},
              ucIDCrnEinvoiceStatus = ${isSuccess ? normalizeText("Success") : normalizeText("Failed")}
        FROM InvNum I
        INNER JOIN E_InvoiceQueue q ON I.InvNumber = q.InvNumber AND (
            (I.DocType = q.DocType) OR (I.DocType IS NULL AND q.DocType IS NULL)
        )
        WHERE q.[instanceIdentifier] = ${normalizeText(instanceIdentifier)}
          AND q.[Status] IN (3,4)
    `;

    return affected || 0;
};

module.exports = {
    lockAutoSendQueue,
    getAutoSendQueueStatus,
    releaseQueueEntries,
    markSentByInvoiceNumber,
    markArtaxErrorByInvoiceNumber,
    markArtaxErrorsByInvoiceNumbers,
    markResponseByInstanceIdentifier
};
