const db = require("../db");
const { resolveIdentifier } = require("../config/databaseSchema");

let responseLogTableReady = false;
const responseLogTableName = resolveIdentifier("e_invoice_response_log").replace(/'/g, "''");

const normalizeText = (value) => {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    return String(value);
};

const ensureResponseLogTable = async () => {
    if (responseLogTableReady) return;

    await db.executeUnsafe(`
        IF OBJECT_ID('${responseLogTableName}', 'U') IS NULL
        BEGIN
            CREATE TABLE dbo.e_invoice_response_log (
                Id INT IDENTITY(1,1) PRIMARY KEY,
                response_id UNIQUEIDENTIFIER,
                messageId NVARCHAR(255),
                instanceIdentifier NVARCHAR(255),
                invNumber NVARCHAR(255),
                senderParticipantID NVARCHAR(255),
                receiverParticipantID NVARCHAR(255),
                documentTypeID NVARCHAR(500),
                processID NVARCHAR(255),
                transmissionType NVARCHAR(50),
                status NVARCHAR(50),
                serviceProviderId UNIQUEIDENTIFIER,
                responseCreatedDate DATETIME2,
                responseMessage NVARCHAR(MAX),
                errorDetails NVARCHAR(MAX),
                createdby NVARCHAR(100),
                createdAt DATETIME DEFAULT GETDATE()
            )
        END
    `);

    responseLogTableReady = true;
};

const saveResponseLog = async ({
    responseId,
    messageId,
    instanceIdentifier,
    invNumber,
    senderParticipantID,
    receiverParticipantID,
    documentTypeID,
    processID,
    transmissionType,
    status,
    serviceProviderId,
    responseCreatedDate,
    responseMessage,
    errorDetails,
    createdBy
}) => {
    await ensureResponseLogTable();

    // instanceIdentifier is a unique key; update first, then insert as fallback
    const affected = await db.execute`
        UPDATE e_invoice_response_log
        SET
            response_id = ${responseId || null},
            messageId = ${normalizeText(messageId)},
            -- invNumber intentionally not updated on response (send-time only)
            senderParticipantID = ${normalizeText(senderParticipantID)},
            receiverParticipantID = ${normalizeText(receiverParticipantID)},
            documentTypeID = ${normalizeText(documentTypeID)},
            processID = ${normalizeText(processID)},
            transmissionType = ${normalizeText(transmissionType)},
            status = ${normalizeText(status)},
            serviceProviderId = ${serviceProviderId || null},
            responseCreatedDate = ${responseCreatedDate || null},
            responseMessage = ${normalizeText(responseMessage)},
            errorDetails = ${normalizeText(errorDetails)},
            createdby = ${normalizeText(createdBy)}
        WHERE instanceIdentifier = ${normalizeText(instanceIdentifier)}
    `;

    if (affected && affected > 0) return;

    await db.execute`
        INSERT INTO e_invoice_response_log (
            response_id,
            messageId,
            instanceIdentifier,
            invNumber,
            senderParticipantID,
            receiverParticipantID,
            documentTypeID,
            processID,
            transmissionType,
            status,
            serviceProviderId,
            responseCreatedDate,
            responseMessage,
            errorDetails,
            createdby,
            createdAt
        )
        VALUES (
            ${responseId || null},
            ${normalizeText(messageId)},
            ${normalizeText(instanceIdentifier)},
            ${normalizeText(invNumber)},
            ${normalizeText(senderParticipantID)},
            ${normalizeText(receiverParticipantID)},
            ${normalizeText(documentTypeID)},
            ${normalizeText(processID)},
            ${normalizeText(transmissionType)},
            ${normalizeText(status)},
            ${serviceProviderId || null},
            ${responseCreatedDate || null},
            ${normalizeText(responseMessage)},
            ${normalizeText(errorDetails)},
            ${normalizeText(createdBy)},
            CAST(DATEADD(HOUR, 4, SYSUTCDATETIME()) AS DATETIME)
        )
    `;
};

const upsertSendLogByInstanceIdentifier = async ({
    messageId,
    instanceIdentifier,
    invNumber,
    createdBy
}) => {
    await ensureResponseLogTable();

    const affected = await db.execute`
        UPDATE e_invoice_response_log
        SET
            messageId = ${normalizeText(messageId)},
            createdby = ${normalizeText(createdBy)},

            createdAt = CAST(DATEADD(HOUR, 4, SYSUTCDATETIME()) AS DATETIME)
        WHERE instanceIdentifier = ${normalizeText(instanceIdentifier)}
    `;

    if (affected && affected > 0) return;

    await db.execute`
        INSERT INTO e_invoice_response_log (
            messageId,
            instanceIdentifier,
            invNumber,
            createdby,
            createdAt
        )
        VALUES (
            ${normalizeText(messageId)},
            ${normalizeText(instanceIdentifier)},
            ${normalizeText(invNumber)},
            ${normalizeText(createdBy)},
            CAST(DATEADD(HOUR, 4, SYSUTCDATETIME()) AS DATETIME)
        )
    `;
};

const getValidationErrorNotificationDetails = async ({
    instanceIdentifier,
    invNumber,
    docType
}) => {
    await ensureResponseLogTable();

    const rows = await db.query`
        ;WITH latest_log AS (
            SELECT TOP 1
                l.[Id],
                l.[instanceIdentifier],
                l.[InvNumber],
                l.[createdAt],
                l.[errorDetails],
                l.[status]
            FROM [e_invoice_response_log] l
            WHERE (
                (${normalizeText(instanceIdentifier)} IS NOT NULL AND l.[instanceIdentifier] = ${normalizeText(instanceIdentifier)})
                OR (${normalizeText(invNumber)} IS NOT NULL AND l.[InvNumber] = ${normalizeText(invNumber)})
            )
            ORDER BY
                CASE
                    WHEN ${normalizeText(instanceIdentifier)} IS NOT NULL
                         AND l.[instanceIdentifier] = ${normalizeText(instanceIdentifier)}
                    THEN 0
                    ELSE 1
                END,
                l.[Id] DESC
        )
        SELECT
            CONCAT(
                COALESCE(MAX(e.[seller_elec_scheme_id]), ''),
                ':',
                COALESCE(MAX(e.[seller_elec_address]), '')
            ) AS [ReceiverId],
            l.[instanceIdentifier] AS [InstanceIdentifier],
            l.[InvNumber],
            l.[createdAt] AS [ErrorAt],
            l.[createdAt] AS [CreatedAt],
            l.[status] AS [Status],
            l.[status] AS [status],
            MAX(e.[buyer_name]) AS [Customer],
            l.[errorDetails] AS [Error],
            MAX(e.[invoice_total_with_tax]) AS [InvoiceAmt],
            MAX(e.[invoice_issue_date]) AS [InvDate],
            MAX(c.[tomail]) AS [tomail],
            MAX(c.[ccmail]) AS [ccmail]
        FROM latest_log l
        LEFT JOIN [E_Invoicing] e
            ON e.[invoice_no] = l.[InvNumber]
           AND (${docType ?? null} IS NULL OR e.[DocType] = ${docType ?? null})
        OUTER APPLY (
            SELECT TOP (1)
                [tomail],
                [ccmail]
            FROM [E_config]
            ORDER BY [id]
        ) c
        GROUP BY
            l.[instanceIdentifier],
            l.[InvNumber],
            l.[createdAt],
            l.[errorDetails],
            l.[status]
    `;

    return rows[0] || null;
};

module.exports = {
    saveResponseLog,
    upsertSendLogByInstanceIdentifier,
    getValidationErrorNotificationDetails
};
