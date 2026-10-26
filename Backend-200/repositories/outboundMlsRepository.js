const db = require("../db");
const { sqlInt } = require("../utils/sqlCompatibility");

const normalizeText = (value) => {
    if (value === null || value === undefined || value === "") return null;
    return String(value);
};

const toBit = (value) => {
    if (value === true || value === 1) return 1;
    if (typeof value === "string" && value.toLowerCase() === "true") return 1;
    return 0;
};

const getEligibleInvoiceQueueRows = async ({
    limit = Number(process.env.OUTBOUND_MLS_BATCH_SIZE) || 50,
    client = db
} = {}) =>
    client.queryStatement(`
        SELECT TOP (@p0)
            [QueueID],
            [InvNumber],
            [DocType],
            [instanceIdentifier],
            [OutMls],
            [OutMlsAt]
        FROM [E_InvoiceQueue]
        WHERE NULLIF(LTRIM(RTRIM([instanceIdentifier])), '') IS NOT NULL
          AND ISNULL(${sqlInt("[OutMls]")}, 0) < 4
          AND IsReceived = 1
        ORDER BY [QueueID]
    `, [Number.isFinite(Number(limit)) && Number(limit) > 0 ? Number(limit) : 50]);

const upsertOutboundTransactionDetails = async ({
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
            UPDATE [E_Get_Outbound_Transaction]
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
            INSERT INTO [E_Get_Outbound_Transaction] (
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

const updateQueueOutboundMls = async ({
    queueId,
    outMls,
    client = db
}) =>
    client.execute`
        UPDATE [E_InvoiceQueue]
        SET [OutMls] = ${Number.isFinite(Number(outMls)) ? Number(outMls) : 0},
            [OutMlsAt] = GETDATE()
        WHERE [QueueID] = ${queueId}
    `;

module.exports = {
    getEligibleInvoiceQueueRows,
    upsertOutboundTransactionDetails,
    updateQueueOutboundMls
};
