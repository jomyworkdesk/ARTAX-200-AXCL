const db = require("../db");

const normalizeText = (value) => {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    return String(value);
};

const normalizeNumber = (value) => {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

const insertValidationError = async ({
    instanceIdentifier,
    invNumber,
    errorAt,
    error,
    customer,
    status,
    invoiceAmt,
    invDate,
    useDubaiNowForErrorAt = false
}) => {
    const rows = await db.query`
        INSERT INTO [E_InvoiceError] (
            [InstanceIdentifier],
            [InvNumber],
            [ErrorAt],
            [Error],
            [Customer],
            [Status],
            [InvoiceAmt],
            [InvDate],
            [IsMail],
            [IsError],
            [RetryCount],
            [CreatedAt]
        )
        OUTPUT INSERTED.[Id]
        VALUES (
            ${normalizeText(instanceIdentifier)},
            ${normalizeText(invNumber)},
            CASE
                WHEN ${useDubaiNowForErrorAt ? 1 : 0} = 1
                THEN CAST(DATEADD(HOUR, 4, SYSUTCDATETIME()) AS DATETIME)
                ELSE ${errorAt || null}
            END,
            ${normalizeText(error)},
            ${normalizeText(customer)},
            ${normalizeText(status)},
            ${normalizeNumber(invoiceAmt)},
            ${invDate || null},
            0,
            0,
            0,
            CAST(DATEADD(HOUR, 4, SYSUTCDATETIME()) AS DATETIME)
        )
    `;

    return rows[0]?.Id || null;
};

const getMailRecipients = async () => {
    const rows = await db.query`
        SELECT TOP (1)
            [tomail],
            [ccmail]
        FROM [E_config]
        ORDER BY [id]
    `;

    return rows[0] || {};
};

const markMailSuccess = async ({ id, toMail, providerMessageId }) => {
    if (!id) return;

    await db.execute`
        UPDATE [E_InvoiceError]
        SET
            [IsMail] = 1,
            [IsMailId] = ${normalizeText(toMail)},
            [ProviderMessageId] = ${normalizeText(providerMessageId)},
            [IsMailAt] = CAST(DATEADD(HOUR, 4, SYSUTCDATETIME()) AS DATETIME),
            [IsError] = 0
        WHERE [Id] = ${id}
    `;
};

const markMailFailure = async ({ id, providerMessageId }) => {
    if (!id) return;

    await db.execute`
        UPDATE [E_InvoiceError]
        SET
            [ProviderMessageId] = ${normalizeText(providerMessageId)},
            [IsError] = 1,
            [RetryCount] = 1
        WHERE [Id] = ${id}
    `;
};

module.exports = {
    insertValidationError,
    getMailRecipients,
    markMailSuccess,
    markMailFailure
};
