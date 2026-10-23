const db = require("../db");
const INVOICE_DOC_TYPE = 4;
const INVOICE_TABLE = "E_Invoicing";
const OUT_DOCUMENT_TABLE = "E_InvoiceoutDocument";
const INVOICE_DETAIL_FIELDS = `
            e.*,
            e.invoice_no AS InvoiceNumber,
            e.invoice_issue_date AS InvoiceIssueDate,
            e.payment_due_date AS InvoicePaymentDueDate,
            e.invoice_currency_code AS InvoiceCurrencyCode,
            e.invoice_txn_type_code AS TransactionCode,
            e.buyer_name AS BuyerName,
            e.buyer_addr_line1 AS BuyerAddressline1,
            e.buyer_city AS BuyerCity,
            e.buyer_country_subdivision AS BuyerCountrySubdivision,
            e.buyer_country_code AS BuyerCountry,
            e.payment_means_type_code AS PaymentType,
            e.vat_cat_code AS VatCategory,
            e.invoice_line_id AS InvoiceLineIdentifier,
            e.invoiced_qty AS InvoicedQuantity,
            e.invoice_line_net_amt AS LineExtensionAmount,
            e.item_name AS ItemName,
            e.item_description AS ItemDescription,
            e.item_vat_cat_code AS ItemVatCategory,
            e.item_vat_rate AS ItemVatPrice,
            e.invoiced_qty_uom_code AS UOMCode,
            e.item_net_price AS PriceExcl,
            e.seller_name AS SellerName,
            e.seller_addr_line1 AS SellerAddressline1,
            e.seller_city AS SellerCity,
            e.seller_country_subdivision AS SellerCountrySubdivision,
            e.seller_country_code AS SellerCountryCode,
            e.invoice_total_without_tax AS InvTotExcl,
            e.invoice_total_tax_amt AS InvTotTax,
            e.invoice_total_with_tax AS InvTotIncl,
            e.invoice_line_net_amt AS LineNet,
            e.vat_line_amt_aed AS LineTax,
            e.invoice_line_amt_aed AS LineTotal,
            e.vat_cat_taxable_amt AS TotalInvoiceAmt,
            od.[ID] AS [outdoc_id],
            od.[EinvoiceID] AS [outdoc_einvoice_id],
            od.[invoice_no] AS [outdoc_invoice_no],
            od.[invoiced_obj_id] AS [outdoc_invoiced_obj_id],
            od.[invoiced_obj_scheme_id] AS [outdoc_invoiced_obj_scheme_id],
            od.[document_type_code] AS [outdoc_document_type_code],
            od.[support_doc_ref] AS [outdoc_support_doc_ref],
            od.[support_doc_desc] AS [outdoc_support_doc_desc],
            od.[attached_document] AS [outdoc_attached_document],
            od.[attached_doc_mime_code] AS [outdoc_attached_doc_mime_code],
            od.[attached_doc_filename] AS [outdoc_attached_doc_filename],
            od.[external_doc_location] AS [outdoc_external_doc_location]`;

const OUTBOUND_TRANSACTION_RESPONSE_FIELDS = `
                COALESCE(MAX(CASE
                    WHEN LOWER(LTRIM(RTRIM(tx.[TransmissionType]))) = 'mls_inbound'
                    THEN CASE
                        WHEN UPPER(LTRIM(RTRIM(tx.[Status]))) = 'SUCCESS' THEN 'Accepted'
                        ELSE 'Rejected'
                    END
                END), 'Pending') AS [C3ResponseStatus],
                COALESCE(MAX(CASE
                    WHEN LOWER(LTRIM(RTRIM(tx.[TransmissionType]))) = 'c2_tdd_mls_inbound'
                    THEN CASE
                        WHEN UPPER(LTRIM(RTRIM(tx.[Status]))) = 'SUCCESS' THEN 'Accepted'
                        ELSE 'Rejected'
                    END
                END), 'Pending') AS [C5ResponseStatus]`;

const OUTBOUND_TRANSACTION_JOIN = `
            LEFT JOIN [E_Get_Outbound_Transaction] tx
                ON q.[instanceIdentifier] = tx.[RootInstanceIdentifier]`;

const OUT_DOCUMENT_APPLY = `
        OUTER APPLY (
            SELECT TOP (1) d.*
            FROM [${OUT_DOCUMENT_TABLE}] d
            WHERE e.[outDocument] IS NOT NULL
              AND d.[ID] = TRY_CONVERT(int, e.[outDocument])
            ORDER BY d.[ID] DESC
        ) od`;

const OUT_DOCUMENT_COLUMNS = [
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

const quoteIdentifier = (identifier) => `[${String(identifier).replace(/]/g, "]]")}]`;

let outDocumentColumnsCache = null;

const getOutDocumentColumnMap = async () => {
    if (outDocumentColumnsCache) return outDocumentColumnsCache;

    const rows = await db.query`
        SELECT [COLUMN_NAME], [DATA_TYPE]
        FROM [INFORMATION_SCHEMA].[COLUMNS]
        WHERE [TABLE_NAME] = ${OUT_DOCUMENT_TABLE}
    `;

    outDocumentColumnsCache = new Map(
        rows.map((row) => [
            String(row.COLUMN_NAME || "").toLowerCase(),
            String(row.DATA_TYPE || "").toLowerCase()
        ])
    );

    return outDocumentColumnsCache;
};

const isBinaryColumn = (dataType) =>
    ["binary", "varbinary", "image"].includes(String(dataType || "").toLowerCase());

const prepareOutDocumentValue = (columnMap, columnName, value) => {
    if (value === null || value === undefined || value === "") return null;

    if (columnName === "attached_document" && isBinaryColumn(columnMap.get(columnName))) {
        return Buffer.isBuffer(value) ? value : Buffer.from(String(value), "base64");
    }

    return value;
};

const normalizeAttachmentContent = (value) => {
    if (!value) return null;
    if (Buffer.isBuffer(value)) return value;
    if (value.type === "Buffer" && Array.isArray(value.data)) {
        return Buffer.from(value.data);
    }

    const rawValue = String(value).trim();
    if (!rawValue) return null;

    if (/^0x[0-9a-f]+$/i.test(rawValue)) {
        return Buffer.from(rawValue.slice(2), "hex");
    }

    const base64Value = rawValue.startsWith("data:") && rawValue.includes(",")
        ? rawValue.slice(rawValue.indexOf(",") + 1)
        : rawValue;
    const buffer = Buffer.from(base64Value.replace(/\s/g, ""), "base64");

    return buffer.length ? buffer : null;
};

const getAllInvoices = async (docType = INVOICE_DOC_TYPE) => {
    return db.queryUnsafe(`
        SELECT ${INVOICE_DETAIL_FIELDS}
        FROM ${INVOICE_TABLE} e
        ${OUT_DOCUMENT_APPLY}
        WHERE e.DocType = ${docType}
    `);
};

const getInvoiceDetailsByNumbers = async (invoiceNumbers, docType = INVOICE_DOC_TYPE) => {
    if (!Array.isArray(invoiceNumbers) || invoiceNumbers.length === 0) {
        return [];
    }

    const sanitizedInvoiceNumbers = invoiceNumbers
        .filter((value) => value !== null && value !== undefined && value !== "")
        .map((value) => String(value).replace(/'/g, "''"));

    if (sanitizedInvoiceNumbers.length === 0) {
        return [];
    }

    const inClause = sanitizedInvoiceNumbers
        .map((invoiceNumber) => `'${invoiceNumber}'`)
        .join(", ");

    return db.queryUnsafe(`
        SELECT
            ${INVOICE_DETAIL_FIELDS},
            q.Status,
            q.IsSent,
            q.IsReceived,
            q.IsInvoiced,
            q.IsError,
            q.ErrorMessage,
            q.InvoicedAt,
            q.SentAt,
            q.ReceivedAt,
            q.ErrorAt
        FROM ${INVOICE_TABLE} e
        ${OUT_DOCUMENT_APPLY}
        LEFT JOIN E_InvoiceQueue q ON e.invoice_no = q.InvNumber AND e.DocType = q.DocType
        WHERE e.invoice_no IN (${inClause})
        AND e.DocType = ${docType}
        ORDER BY e.invoice_no ASC, e.ID ASC
    `);
};

const normalizeSqlDate = (value) => {
    if (typeof value !== "string") return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
};

const buildInvoiceDateFilter = (fromDate, toDate, alias = "e") => {
    const safeFromDate = normalizeSqlDate(fromDate);
    const safeToDate = normalizeSqlDate(toDate);
    const conditions = [];

    if (safeFromDate) {
        conditions.push(`${alias}.invoice_issue_date >= '${safeFromDate}'`);
    }

    if (safeToDate) {
        conditions.push(`${alias}.invoice_issue_date < DATEADD(day, 1, '${safeToDate}')`);
    }

    return conditions.length ? ` AND ${conditions.join(" AND ")}` : "";
};

const buildQueueDateFilter = (fromDate, toDate, alias = "q") => {
    const safeFromDate = normalizeSqlDate(fromDate);
    const safeToDate = normalizeSqlDate(toDate);
    const conditions = [];

    if (safeFromDate) {
        conditions.push(`${alias}.InvDate >= '${safeFromDate}'`);
    }

    if (safeToDate) {
        conditions.push(`${alias}.InvDate < DATEADD(day, 1, '${safeToDate}')`);
    }

    return conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
};

const getDashboardCounts = async (fromDate, toDate, docType = INVOICE_DOC_TYPE) => {
    const dateFilter = buildQueueDateFilter(fromDate, toDate, "q");
    const result = await db.queryUnsafe(`
        SELECT
            COUNT(DISTINCT q.QueueID) AS total,
            COUNT(DISTINCT CASE WHEN TRY_CONVERT(int, q.Status) = 1 AND ISNULL(q.IsInvoiced, 0) = 1 THEN q.QueueID END) AS pending,
            COUNT(DISTINCT CASE WHEN TRY_CONVERT(int, q.Status) = 2 THEN q.QueueID END) AS sent,
            COUNT(DISTINCT CASE WHEN TRY_CONVERT(int, q.Status) = 3 THEN q.QueueID END) AS success,
            COUNT(DISTINCT CASE WHEN TRY_CONVERT(int, q.Status) = 3 THEN q.QueueID END) AS received,
            COUNT(DISTINCT CASE WHEN ISNULL(q.IsInvoiced, 0) = 1 THEN q.QueueID END) AS invoiced,
            COUNT(DISTINCT CASE WHEN TRY_CONVERT(int, q.Status) = 4 THEN q.QueueID END) AS failed,
            COUNT(DISTINCT CASE WHEN TRY_CONVERT(int, q.Status) = 6 THEN q.QueueID END) AS error
        FROM E_InvoiceQueue q
        WHERE q.DocType = ${docType}
        ${dateFilter.replace('WHERE', 'AND')}
    `);
    return result[0] || {};
};

const getInvoicesByType = async (type, fromDate, toDate, docType = INVOICE_DOC_TYPE) => {
    const dateFilter = buildInvoiceDateFilter(fromDate, toDate, "e");

    if (type === "pending" || type === "sent" || type === "success" || type === "received" || type === "error" || type === "failed") {
        const statusCodeMap = {
            pending: 1,
            sent: 2,
            success: 3,
            received: 3,
            error: 4,
            failed: 4
        };
        const statusCode = statusCodeMap[type];
        const statusCondition = type === "error"
            ? "TRY_CONVERT(int, q.Status) = 6"
            : `TRY_CONVERT(int, q.Status) = ${statusCode}`;

        return db.queryUnsafe(`
            SELECT
                e.invoice_no AS InvoiceNumber,
                MAX(e.unique_identifier_no) AS AutoIndex,
                MAX(COALESCE(q.QueueID, 0)) AS QueueID,
                MAX(e.invoice_issue_date) AS InvoiceIssueDate,
                CONVERT(varchar(19), MAX(e.created_at), 120) AS CreatedAt,
                MAX(COALESCE(e.buyer_name, '')) AS Customer,
                MAX(e.invoice_total_without_tax) AS InvTotExcl,
                MAX(e.invoice_total_tax_amt) AS InvTotTax,
                MAX(e.invoice_total_with_tax) AS InvTotIncl,
                MAX(e.invoice_currency_code) AS InvoiceCurrencyCode,
                MAX(e.vat_cat_taxable_amt) AS TotalInvoiceAmt,
                MAX(q.[instanceIdentifier]) AS [InstanceIdentifier],
                MAX(COALESCE(q.Status, '')) AS Status,
${OUTBOUND_TRANSACTION_RESPONSE_FIELDS}
            FROM ${INVOICE_TABLE} e
            INNER JOIN E_InvoiceQueue q
                ON e.invoice_no = q.InvNumber AND e.DocType = q.DocType
${OUTBOUND_TRANSACTION_JOIN}
            WHERE ${statusCondition}
            ${statusCode === 1 ? "AND ISNULL(q.IsInvoiced, 0) = 1" : ""}
            AND e.DocType = ${docType} AND q.DocType = ${docType}
            ${dateFilter}
            GROUP BY e.invoice_no
            ORDER BY MAX(COALESCE(q.QueueID, 0)) DESC
        `);
    }
    if (type === "invoiced") {
        return db.queryUnsafe(`
            SELECT
                e.invoice_no AS InvoiceNumber,
                MAX(e.unique_identifier_no) AS AutoIndex,
                MAX(COALESCE(q.QueueID, 0)) AS QueueID,
                MAX(e.invoice_issue_date) AS InvoiceIssueDate,
                CONVERT(varchar(19), MAX(e.created_at), 120) AS CreatedAt,
                MAX(COALESCE(e.buyer_name, '')) AS Customer,
                MAX(e.invoice_total_without_tax) AS InvTotExcl,
                MAX(e.invoice_total_tax_amt) AS InvTotTax,
                MAX(e.invoice_total_with_tax) AS InvTotIncl,
                MAX(e.invoice_currency_code) AS InvoiceCurrencyCode,
                MAX(e.vat_cat_taxable_amt) AS TotalInvoiceAmt,
                MAX(q.[instanceIdentifier]) AS [InstanceIdentifier],
                MAX(COALESCE(q.Status, '')) AS Status,
${OUTBOUND_TRANSACTION_RESPONSE_FIELDS}
            FROM ${INVOICE_TABLE} e
            INNER JOIN E_InvoiceQueue q
                ON e.invoice_no = q.InvNumber AND e.DocType = q.DocType
${OUTBOUND_TRANSACTION_JOIN}
            WHERE ISNULL(q.IsInvoiced, 0) = 1
            AND e.DocType = ${docType} AND q.DocType = ${docType}
            ${dateFilter}
            GROUP BY e.invoice_no
            ORDER BY MAX(COALESCE(q.QueueID, 0)) DESC
        `);
    }
    if (type === "error" || type === "failed") {
        // Only return queue status = 4 (Failed)
        // Also project fields required by the Errors screen.
        return db.queryUnsafe(`
            SELECT
                MAX(e.invoice_txn_type_code) AS EINVOICETYPE,
                e.invoice_no AS InvNumber,
                MAX(e.unique_identifier_no) AS AutoIndex,
                MAX(e.invoice_issue_date) AS InvDate,
                CONVERT(varchar(19), MAX(e.created_at), 120) AS CreatedAt,
                MAX(COALESCE(e.buyer_name, '')) AS BUYER_NAME,
                MAX(e.invoice_total_with_tax) AS INVOICE_TOTAL_WITH_TAX,
                MAX(COALESCE(q.Status, '')) AS Status,
                MAX(COALESCE(q.QueueID, 0)) AS QueueID,
                MAX(q.[instanceIdentifier]) AS [InstanceIdentifier],
                MAX(q.ErrorMessage) AS ErrorMessage,
${OUTBOUND_TRANSACTION_RESPONSE_FIELDS}
            FROM ${INVOICE_TABLE} e
            INNER JOIN E_InvoiceQueue q
                ON e.invoice_no = q.InvNumber AND e.DocType = q.DocType
${OUTBOUND_TRANSACTION_JOIN}
            WHERE TRY_CONVERT(int, q.Status) = 6
            AND e.DocType = ${docType} AND q.DocType = ${docType}
            ${dateFilter}
            GROUP BY e.invoice_no
            ORDER BY MAX(COALESCE(q.QueueID, 0)) DESC
        `);
    }
    return db.queryUnsafe(`
        SELECT
            e.invoice_no AS InvoiceNumber,
            MAX(e.unique_identifier_no) AS AutoIndex,
            MAX(COALESCE(q.QueueID, 0)) AS QueueID,
            MAX(e.invoice_issue_date) AS InvoiceIssueDate,
            CONVERT(varchar(19), MAX(e.created_at), 120) AS CreatedAt,
            MAX(COALESCE(e.buyer_name, '')) AS Customer,
            MAX(e.invoice_total_without_tax) AS InvTotExcl,
            MAX(e.invoice_total_tax_amt) AS InvTotTax,
            MAX(e.invoice_total_with_tax) AS InvTotIncl,
            MAX(e.invoice_currency_code) AS InvoiceCurrencyCode,
            MAX(e.vat_cat_taxable_amt) AS TotalInvoiceAmt,
            MAX(q.[instanceIdentifier]) AS [InstanceIdentifier],
            MAX(COALESCE(q.Status, '')) AS Status,
${OUTBOUND_TRANSACTION_RESPONSE_FIELDS}
        FROM ${INVOICE_TABLE} e
        LEFT JOIN E_InvoiceQueue q
            ON e.invoice_no = q.InvNumber AND e.DocType = q.DocType
${OUTBOUND_TRANSACTION_JOIN}
        WHERE 1 = 1
        AND e.DocType = ${docType}
        AND (q.QueueID IS NULL OR q.DocType = ${docType})
        AND (q.QueueID IS NULL OR ISNULL(TRY_CONVERT(int, q.Status), -1) <> 0)
        ${dateFilter}
        GROUP BY e.invoice_no
        ORDER BY MAX(COALESCE(q.QueueID, 0)) DESC
    `);
};

const getFailedInvoiceErrors = async (fromDate, toDate) => {
    const dateFilter = buildQueueDateFilter(fromDate, toDate, "EQ").replace("WHERE", "AND");

    return db.queryUnsafe(`
        SELECT
            EQ.InvNumber,
            MAX(EQ.InvDate) AS InvDate,
            MAX(E.EInvoiceType) AS EInvoiceType,
            MAX(E.buyer_name) AS buyer_name,
            MAX(E.invoice_total_with_tax) AS AMOUNT
        FROM E_InvoiceQueue EQ
        LEFT JOIN E_Invoicing E
            ON EQ.INVNUMBER = E.invoice_no
        WHERE TRY_CONVERT(int, EQ.Status) IN (4)
        ${dateFilter}
        GROUP BY EQ.InvNumber
        ORDER BY MAX(EQ.InvDate) DESC, EQ.InvNumber DESC
    `);
};

const getArtaxInvoiceErrors = async (fromDate, toDate) => {
    const dateFilter = buildQueueDateFilter(fromDate, toDate, "EQ").replace("WHERE", "AND");

    return db.queryUnsafe(`
        SELECT
        EQ.AutoIndex,
            EQ.InvNumber,
            MAX(EQ.InvDate) AS InvDate,
            MAX(E.EInvoiceType) AS EInvoiceType,
            MAX(E.buyer_name) AS buyer_name,
            MAX(E.invoice_total_with_tax) AS AMOUNT
        FROM E_InvoiceQueue EQ
        LEFT JOIN E_Invoicing E
            ON EQ.INVNUMBER = E.invoice_no
        WHERE TRY_CONVERT(int, EQ.Status) IN (6)
        ${dateFilter}
        GROUP BY EQ.InvNumber , EQ.AutoIndex
        ORDER BY MAX(EQ.InvDate) DESC, EQ.InvNumber DESC
    `);
};

const getInvoiceResponseLogs = async (invNumber) => {
    const sanitizedInvNumber = String(invNumber || "").replace(/'/g, "''");

    if (!sanitizedInvNumber) {
        return [];
    }

    return db.queryUnsafe(`
        SELECT
            [Id],
            [InvNumber],
            [status],
            [responseCreatedDate],
            [responseMessage]
        FROM [e_invoice_response_log]
        WHERE [InvNumber] = '${sanitizedInvNumber}'
        ORDER BY [Id] DESC
    `);
};

const getArtaxErrorsResponse = async (invNumber) => {
    const sanitizedInvNumber = String(invNumber || "").replace(/'/g, "''");

    if (!sanitizedInvNumber) {
        return [];
    }

    return db.queryUnsafe(`
        SELECT
            [Id],
            [InvNumber],
            Status as [status],
           [ErrorAt] as  [responseCreatedDate],
           [Error] as  [responseMessage]
        FROM [E_InvoiceError]
        WHERE [InvNumber] = '${sanitizedInvNumber}'
        and status = 'ARTAX_ERROR'
        ORDER BY [Id] DESC
    `);
};


const getInvoiceDetails = async (invNumber, docType = INVOICE_DOC_TYPE) => {
    const sanitizedInvNumber = String(invNumber).replace(/'/g, "''");
    const result = await db.queryUnsafe(`
        SELECT
            ${INVOICE_DETAIL_FIELDS},
            q.Status,
            q.IsSent,
            q.IsReceived,
            q.IsInvoiced,
            q.IsError,
            q.ErrorMessage,
            q.InvoicedAt,
            q.SentAt,
            q.ReceivedAt,
            q.ErrorAt
        FROM ${INVOICE_TABLE} e
        ${OUT_DOCUMENT_APPLY}
        LEFT JOIN E_InvoiceQueue q ON e.invoice_no = q.InvNumber AND e.DocType = q.DocType
        WHERE e.invoice_no = '${sanitizedInvNumber}'
        AND e.DocType = ${docType} AND (q.QueueID IS NULL OR q.DocType = ${docType})
        ORDER BY e.ID ASC
    `);
    return result;
};

const getInvoiceOutDocument = async (invNumber, docType = INVOICE_DOC_TYPE) => {
    const safeInvNumber = String(invNumber || "").trim();

    if (!safeInvNumber) return null;

    const rows = await db.queryStatement(
        `SELECT TOP (1)
            e.[ID] AS [EinvoiceID],
            e.[invoice_no],
            e.[outDocument],
            od.[ID],
            od.[invoiced_obj_id],
            od.[invoiced_obj_scheme_id],
            od.[document_type_code],
            od.[support_doc_ref],
            od.[support_doc_desc],
            CASE WHEN od.[attached_document] IS NULL THEN CAST(0 AS bit) ELSE CAST(1 AS bit) END AS [has_attached_document],
            od.[attached_doc_mime_code],
            od.[attached_doc_filename],
            od.[external_doc_location]
         FROM [${INVOICE_TABLE}] e
         ${OUT_DOCUMENT_APPLY}
         WHERE e.[invoice_no] = @p0
           AND e.[DocType] = @p1
         ORDER BY e.[ID] ASC`,
        [safeInvNumber, docType]
    );

    return rows[0] || null;
};

const getInvoiceOutDocumentAttachment = async (invNumber, docType = INVOICE_DOC_TYPE) => {
    const safeInvNumber = String(invNumber || "").trim();

    if (!safeInvNumber) return null;

    const rows = await db.queryStatement(
        `SELECT TOP (1)
            od.[attached_document],
            od.[attached_doc_mime_code],
            od.[attached_doc_filename]
         FROM [${INVOICE_TABLE}] e
         ${OUT_DOCUMENT_APPLY}
         WHERE e.[invoice_no] = @p0
           AND e.[DocType] = @p1
         ORDER BY e.[ID] ASC`,
        [safeInvNumber, docType]
    );
    const row = rows[0];
    const content = normalizeAttachmentContent(row?.attached_document);

    if (!content) return null;

    return {
        content,
        mimeCode: row.attached_doc_mime_code || "application/octet-stream",
        filename: row.attached_doc_filename || `attachment-${safeInvNumber}`
    };
};

const getInvoiceOutDocumentOptions = async () => {
    const [objectIdentifierRows, mimeCodeRows] = await Promise.all([
        db.query`
            SELECT [DisplayName], [Value]
            FROM [EM_ObjectIdentifier]
            WHERE NULLIF(LTRIM(RTRIM(CONVERT(varchar(255), [Value]))), '') IS NOT NULL
            ORDER BY [DisplayName]
        `,
        db.query`
            SELECT [Value] AS [DisplayName], [Value]
            FROM [EM_MimeCode]
            WHERE NULLIF(LTRIM(RTRIM(CONVERT(varchar(255), [Value]))), '') IS NOT NULL
            ORDER BY [Value]
        `
    ]);

    return {
        objectIdentifiers: objectIdentifierRows,
        mimeCodes: mimeCodeRows
    };
};

const findInvoiceOutDocumentId = async (client, invoiceRow) => {
    const rows = await client.queryStatement(
        `SELECT TOP (1) [ID]
         FROM [${OUT_DOCUMENT_TABLE}]
         WHERE [ID] = TRY_CONVERT(int, @p0)
            OR [EinvoiceID] = @p1
            OR [invoice_no] = @p2
         ORDER BY
            CASE
                WHEN [ID] = TRY_CONVERT(int, @p0) THEN 0
                WHEN [EinvoiceID] = @p1 THEN 1
                ELSE 2
            END,
            [ID] DESC`,
        [invoiceRow.outDocument ?? null, invoiceRow.ID, invoiceRow.invoice_no]
    );

    return rows[0]?.ID || null;
};

const saveInvoiceOutDocument = async ({
    invoiceNumber,
    docType = INVOICE_DOC_TYPE,
    outDocument,
    attachedDocumentProvided = false
}) => {
    const safeInvoiceNumber = String(invoiceNumber || "").trim();

    if (!safeInvoiceNumber) {
        const error = new Error("Invoice number is required");
        error.statusCode = 400;
        throw error;
    }

    const columnMap = await getOutDocumentColumnMap();

    return db.withTransaction(async (tx) => {
        const invoiceRows = await tx.queryStatement(
            `
            SELECT TOP (1) [ID], [invoice_no], [outDocument]
            FROM [${INVOICE_TABLE}]
            WHERE [invoice_no] = @p0
              AND [DocType] = @p1
            ORDER BY [ID] ASC
            `,
            [safeInvoiceNumber, docType]
        );
        const invoiceRow = invoiceRows[0];

        if (!invoiceRow) {
            const error = new Error(`Invoice ${safeInvoiceNumber} was not found`);
            error.statusCode = 404;
            throw error;
        }

        const existingOutDocumentId = await findInvoiceOutDocumentId(tx, invoiceRow);
        const updateColumns = OUT_DOCUMENT_COLUMNS.filter(
            (column) => column !== "attached_document" || attachedDocumentProvided
        );

        const documentValues = {
            EinvoiceID: invoiceRow.ID,
            invoice_no: invoiceRow.invoice_no,
            ...outDocument
        };

        let outDocumentId = existingOutDocumentId;

        if (outDocumentId) {
            const updateFields = ["EinvoiceID", "invoice_no", ...updateColumns];
            const setSql = updateFields
                .map((column, index) => `${quoteIdentifier(column)} = @p${index}`)
                .join(", ");
            const values = updateFields.map((column) =>
                prepareOutDocumentValue(columnMap, column, documentValues[column])
            );

            values.push(outDocumentId);

            await tx.executeStatement(
                `UPDATE [${OUT_DOCUMENT_TABLE}]
                 SET ${setSql}
                 WHERE [ID] = @p${values.length - 1}`,
                values
            );
        } else {
            const insertColumns = ["EinvoiceID", "invoice_no", ...OUT_DOCUMENT_COLUMNS];
            const columnSql = insertColumns.map(quoteIdentifier).join(", ");
            const valueSql = insertColumns.map((_, index) => `@p${index}`).join(", ");
            const values = insertColumns.map((column) =>
                prepareOutDocumentValue(columnMap, column, documentValues[column])
            );
            const insertedRows = await tx.queryStatement(
                `INSERT INTO [${OUT_DOCUMENT_TABLE}] (${columnSql})
                 OUTPUT INSERTED.[ID] AS [ID]
                 VALUES (${valueSql})`,
                values
            );

            outDocumentId = insertedRows[0]?.ID;
        }

        if (!outDocumentId) {
            throw new Error("Failed to save invoice supporting document");
        }

        await tx.executeStatement(
            `
            UPDATE [${INVOICE_TABLE}]
            SET [outDocument] = @p0
            WHERE [invoice_no] = @p1
              AND [DocType] = @p2
            `,
            [outDocumentId, invoiceRow.invoice_no, docType]
        );

        return {
            ID: outDocumentId,
            EinvoiceID: invoiceRow.ID,
            invoice_no: invoiceRow.invoice_no
        };
    });
};

const getOutboundTransactions = async (instanceIdentifier) => {
    const safeInstanceIdentifier = String(instanceIdentifier || "").trim();

    if (!safeInstanceIdentifier) return [];

    return db.queryStatement(
        `SELECT
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
         FROM [E_Get_Outbound_Transaction]
         WHERE [RootInstanceIdentifier] = @p0
         ORDER BY
            CASE LOWER(LTRIM(RTRIM([TransmissionType])))
                WHEN 'outbound' THEN 1
                WHEN 'c2_tdd_outbound' THEN 2
                WHEN 'mls_inbound' THEN 3
                WHEN 'c2_tdd_mls_inbound' THEN 4
                ELSE 5
            END,
            [CreatedDate] DESC,
            [InsertedOn] DESC`,
        [safeInstanceIdentifier]
    );
};


module.exports = {
    INVOICE_DOC_TYPE,
    getAllInvoices,
    getInvoiceDetailsByNumbers,
    getDashboardCounts,
    getInvoicesByType,
    getFailedInvoiceErrors,
    getArtaxInvoiceErrors,
    getInvoiceResponseLogs,
    getArtaxErrorsResponse,
    getInvoiceDetails,
    getInvoiceOutDocument,
    getInvoiceOutDocumentAttachment,
    getInvoiceOutDocumentOptions,
    saveInvoiceOutDocument,
    getOutboundTransactions
};
