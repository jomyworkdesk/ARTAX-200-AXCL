const db = require("../db");
const CREDIT_NOTE_DOC_TYPE = 1;
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

const getAllCreditNotes = async () => {
    return db.queryUnsafe(`
        SELECT ${INVOICE_DETAIL_FIELDS}
        FROM ${INVOICE_TABLE} e
        ${OUT_DOCUMENT_APPLY}
        WHERE e.DocType = ${CREDIT_NOTE_DOC_TYPE}
    `);
};

const getCreditNoteDetailsByNumbers = async (invoiceNumbers) => {
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
        AND e.DocType = ${CREDIT_NOTE_DOC_TYPE}
        ORDER BY e.invoice_no ASC, e.ID ASC
    `);
};

const normalizeSqlDate = (value) => {
    if (typeof value !== "string") return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
};

const buildCreditNoteDateFilter = (fromDate, toDate, alias = "e") => {
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

const getDashboardCounts = async (fromDate, toDate) => {
    const dateFilter = buildQueueDateFilter(fromDate, toDate, "q");
    const result = await db.queryUnsafe(`
        SELECT
            COUNT(DISTINCT q.QueueID) AS total,
            COUNT(DISTINCT CASE WHEN TRY_CONVERT(int, q.Status) = 1 AND ISNULL(q.IsInvoiced, 0) = 1 THEN q.QueueID END) AS pending,
            COUNT(DISTINCT CASE WHEN TRY_CONVERT(int, q.Status) = 3 THEN q.QueueID END) AS success,
            COUNT(DISTINCT CASE WHEN TRY_CONVERT(int, q.Status) = 3 THEN q.QueueID END) AS received,
            COUNT(DISTINCT CASE WHEN ISNULL(q.IsInvoiced, 0) = 1 THEN q.QueueID END) AS invoiced,
            COUNT(DISTINCT CASE WHEN TRY_CONVERT(int, q.Status) = 4 THEN q.QueueID END) AS failed,
            COUNT(DISTINCT CASE WHEN TRY_CONVERT(int, q.Status) = 6 THEN q.QueueID END) AS error
        FROM E_InvoiceQueue q
        WHERE q.DocType = ${CREDIT_NOTE_DOC_TYPE}
        ${dateFilter.replace('WHERE', 'AND')}
    `);
    return result[0] || {};
};


const getCreditNotesByType = async (type, fromDate, toDate) => {
    const dateFilter = buildCreditNoteDateFilter(fromDate, toDate, "e");
    const selectSummary = `
                e.invoice_no AS InvoiceNumber,
                MAX(e.unique_identifier_no) AS AutoIndex,
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
${OUTBOUND_TRANSACTION_RESPONSE_FIELDS}`;

    if (type === "sent") {
        return db.queryUnsafe(`
            SELECT
                ${selectSummary}
            FROM ${INVOICE_TABLE} e
            INNER JOIN E_InvoiceQueue q
                ON e.invoice_no = q.InvNumber AND e.DocType = q.DocType
${OUTBOUND_TRANSACTION_JOIN}
            WHERE ISNULL(q.IsSent, 0) = 1
            AND e.DocType = ${CREDIT_NOTE_DOC_TYPE} AND q.DocType = ${CREDIT_NOTE_DOC_TYPE}
            ${dateFilter}
            GROUP BY e.invoice_no
            ORDER BY MAX(e.invoice_issue_date) DESC
        `);
    }
    if (type === "received") {
        return db.queryUnsafe(`
            SELECT
                ${selectSummary}
            FROM ${INVOICE_TABLE} e
            INNER JOIN E_InvoiceQueue q
                ON e.invoice_no = q.InvNumber AND e.DocType = q.DocType
${OUTBOUND_TRANSACTION_JOIN}
            WHERE ISNULL(q.IsReceived, 0) = 1
            AND e.DocType = ${CREDIT_NOTE_DOC_TYPE} AND q.DocType = ${CREDIT_NOTE_DOC_TYPE}
            ${dateFilter}
            GROUP BY e.invoice_no
            ORDER BY MAX(e.invoice_issue_date) DESC
        `);
    }
    if (type === "invoiced") {
        return db.queryUnsafe(`
            SELECT
                ${selectSummary}
            FROM ${INVOICE_TABLE} e
            INNER JOIN E_InvoiceQueue q
                ON e.invoice_no = q.InvNumber AND e.DocType = q.DocType
${OUTBOUND_TRANSACTION_JOIN}
            WHERE ISNULL(q.IsInvoiced, 0) = 1
            AND e.DocType = ${CREDIT_NOTE_DOC_TYPE} AND q.DocType = ${CREDIT_NOTE_DOC_TYPE}
            ${dateFilter}
            GROUP BY e.invoice_no
            ORDER BY MAX(e.invoice_issue_date) DESC
        `);
    }
    if (type === "error" || type === "failed") {
        const statusCode = type === "error" ? 6 : 4;
        return db.queryUnsafe(`
            SELECT
                ${selectSummary}
            FROM ${INVOICE_TABLE} e
            INNER JOIN E_InvoiceQueue q
                ON e.invoice_no = q.InvNumber AND e.DocType = q.DocType
${OUTBOUND_TRANSACTION_JOIN}
            WHERE TRY_CONVERT(int, q.Status) = ${statusCode}
            AND e.DocType = ${CREDIT_NOTE_DOC_TYPE} AND q.DocType = ${CREDIT_NOTE_DOC_TYPE}
            ${dateFilter}
            GROUP BY e.invoice_no
            ORDER BY MAX(e.invoice_issue_date) DESC
        `);
    }

    if (type === "success" || type === "received") {

        return db.queryUnsafe(`
            SELECT
                ${selectSummary}
            FROM ${INVOICE_TABLE} e
            INNER JOIN E_InvoiceQueue q
                ON e.invoice_no = q.InvNumber AND e.DocType = q.DocType
${OUTBOUND_TRANSACTION_JOIN}
            WHERE TRY_CONVERT(int, q.Status) = 3
            AND e.DocType = ${CREDIT_NOTE_DOC_TYPE} AND q.DocType = ${CREDIT_NOTE_DOC_TYPE}
            ${dateFilter}
            GROUP BY e.invoice_no
            ORDER BY MAX(e.invoice_issue_date) DESC
        `);
    }

    if (type === "pending") {
        return db.queryUnsafe(`
            SELECT
                ${selectSummary}
            FROM ${INVOICE_TABLE} e
            INNER JOIN E_InvoiceQueue q
                ON e.invoice_no = q.InvNumber AND e.DocType = q.DocType
${OUTBOUND_TRANSACTION_JOIN}
            WHERE TRY_CONVERT(int, q.Status) = 1
            AND ISNULL(q.IsInvoiced, 0) = 1
            AND e.DocType = ${CREDIT_NOTE_DOC_TYPE} AND q.DocType = ${CREDIT_NOTE_DOC_TYPE}
            ${dateFilter}
            GROUP BY e.invoice_no
            ORDER BY MAX(e.invoice_issue_date) DESC
        `);
    }


    return db.queryUnsafe(`
        SELECT
            ${selectSummary}
        FROM ${INVOICE_TABLE} e
        LEFT JOIN E_InvoiceQueue q
            ON e.invoice_no = q.InvNumber AND e.DocType = q.DocType
${OUTBOUND_TRANSACTION_JOIN}
        WHERE 1 = 1
        AND e.DocType = ${CREDIT_NOTE_DOC_TYPE}
        AND (q.QueueID IS NULL OR q.DocType = ${CREDIT_NOTE_DOC_TYPE})
        AND (q.QueueID IS NULL OR ISNULL(TRY_CONVERT(int, q.Status), -1) <> 0)
        ${dateFilter}
        GROUP BY e.invoice_no
        ORDER BY MAX(e.invoice_issue_date) DESC
    `);
};

const getCreditNoteDetails = async (invNumber) => {
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
        AND e.DocType = ${CREDIT_NOTE_DOC_TYPE} AND (q.QueueID IS NULL OR q.DocType = ${CREDIT_NOTE_DOC_TYPE})
        ORDER BY e.ID ASC
    `);
    return result;
};


module.exports = {
    getAllCreditNotes,
    getCreditNoteDetailsByNumbers,
    getDashboardCounts,
    getCreditNotesByType,
    getCreditNoteDetails
};
