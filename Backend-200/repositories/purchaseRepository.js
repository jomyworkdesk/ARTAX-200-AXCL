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

let selectableColumnsCache = null;
let exportColumnsCache = null;
let inDocumentColumnsCache = null;

const quoteIdentifier = (identifier) => `[${String(identifier).replace(/]/g, "]]")}]`;

const isBinaryColumn = (dataType) =>
    ["binary", "varbinary", "image"].includes(String(dataType || "").toLowerCase());

const IN_DOCUMENT_APPLY = `
         OUTER APPLY (
            SELECT TOP (1) d.*
            FROM [${IN_DOCUMENT_TABLE}] d
            WHERE e.[inDocument] IS NOT NULL
              AND (
                d.[ID] = TRY_CONVERT(int, e.[inDocument])
                OR d.[EinvoiceID] = e.[ID]
                OR d.[invoice_no] = e.[invoice_no]
              )
            ORDER BY
                CASE
                    WHEN d.[ID] = TRY_CONVERT(int, e.[inDocument]) THEN 0
                    WHEN d.[EinvoiceID] = e.[ID] THEN 1
                    ELSE 2
                END,
                d.[ID] DESC
         ) idoc`;

const normalizeSqlDate = (value) => {
    if (typeof value !== "string") return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
};

const normalizeInvoiceTypeCode = (value) => {
    const code = String(value || "").trim();
    return /^(380|381)$/.test(code) ? code : null;
};

const purchaseDateExpression =
    "COALESCE(e.[invoice_issue_date], e.[DocCreatedAt], e.[created_at])";

const getInDocumentColumns = async () => {
    if (inDocumentColumnsCache) return inDocumentColumnsCache;

    const rows = await db.query`
        SELECT [COLUMN_NAME], [DATA_TYPE]
        FROM [INFORMATION_SCHEMA].[COLUMNS]
        WHERE [TABLE_NAME] = ${IN_DOCUMENT_TABLE}
    `;

    inDocumentColumnsCache = new Map(
        rows.map((row) => [
            String(row.COLUMN_NAME || "").toLowerCase(),
            {
                name: row.COLUMN_NAME,
                dataType: String(row.DATA_TYPE || "").toLowerCase()
            }
        ])
    );

    return inDocumentColumnsCache;
};

const getInDocumentSelectColumns = async ({ forExport = false, includeIdentity = true } = {}) => {
    const columns = await getInDocumentColumns();

    const documentIdentityColumns = [
        columns.has("id") ? "idoc.[ID] AS [in_document_id]" : "NULL AS [in_document_id]",
        columns.has("einvoiceid") ? "idoc.[EinvoiceID] AS [in_document_einvoice_id]" : "NULL AS [in_document_einvoice_id]",
        columns.has("invoice_no") ? "idoc.[invoice_no] AS [in_document_invoice_no]" : "NULL AS [in_document_invoice_no]"
    ];
    const documentDetailColumns = IN_DOCUMENT_COLUMNS.map((columnName) => {
        const column = columns.get(columnName);
        if (!column) return `NULL AS ${quoteIdentifier(columnName)}`;

        const sourceSql = `idoc.${quoteIdentifier(column.name)}`;

        if (columnName === "attached_document" && !forExport) {
            return `CASE WHEN ${sourceSql} IS NULL THEN NULL ELSE 1 END AS ${quoteIdentifier(columnName)}`;
        }

        if (forExport && isBinaryColumn(column.dataType)) {
            return `CONVERT(varchar(max), ${sourceSql}, 1) AS ${quoteIdentifier(columnName)}`;
        }

        return `${sourceSql} AS ${quoteIdentifier(columnName)}`;
    });

    return includeIdentity
        ? [...documentIdentityColumns, ...documentDetailColumns]
        : documentDetailColumns;
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

const getSelectableColumns = async () => {
    if (selectableColumnsCache) return selectableColumnsCache;

    const rows = await db.query`
        SELECT [COLUMN_NAME], [DATA_TYPE]
        FROM [INFORMATION_SCHEMA].[COLUMNS]
        WHERE [TABLE_NAME] = ${PURCHASE_TABLE}
        ORDER BY [ORDINAL_POSITION]
    `;

    selectableColumnsCache = rows.map((row) => {
        if (IN_DOCUMENT_COLUMN_SET.has(String(row.COLUMN_NAME || "").toLowerCase())) {
            return null;
        }

        if (isBinaryColumn(row.DATA_TYPE)) {
            return `CASE WHEN e.${quoteIdentifier(row.COLUMN_NAME)} IS NULL THEN NULL ELSE 1 END AS ${quoteIdentifier(row.COLUMN_NAME)}`;
        }

        return `e.${quoteIdentifier(row.COLUMN_NAME)}`;
    }).filter(Boolean);

    return selectableColumnsCache;
};

const buildPurchaseFilter = (fromDate, toDate, invoiceTypeCode) => {
    const conditions = [];
    const values = [];
    const safeInvoiceTypeCode = normalizeInvoiceTypeCode(invoiceTypeCode);

    if (normalizeSqlDate(fromDate)) {
        conditions.push(`${purchaseDateExpression} >= @p${values.length}`);
        values.push(fromDate);
    }

    if (normalizeSqlDate(toDate)) {
        conditions.push(`${purchaseDateExpression} < DATEADD(day, 1, @p${values.length})`);
        values.push(toDate);
    }

    if (safeInvoiceTypeCode) {
        conditions.push(`e.[invoice_type_code] = @p${values.length}`);
        values.push(safeInvoiceTypeCode);
    }

    return {
        sql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
        values
    };
};

const buildPurchaseQueueDateFilter = (fromDate, toDate) => {
    const conditions = [];
    const values = [];

    if (normalizeSqlDate(fromDate)) {
        conditions.push(`q.[TransCreatedAt] >= @p${values.length}`);
        values.push(fromDate);
    }

    if (normalizeSqlDate(toDate)) {
        conditions.push(`q.[TransCreatedAt] < DATEADD(day, 1, @p${values.length})`);
        values.push(toDate);
    }

    return {
        sql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
        values
    };
};

const buildPurchaseCreatedAtFilter = (fromDate, toDate) => {
    const conditions = [];
    const values = [];

    if (normalizeSqlDate(fromDate)) {
        conditions.push(`e.[created_at] >= @p${values.length}`);
        values.push(fromDate);
    }

    if (normalizeSqlDate(toDate)) {
        conditions.push(`e.[created_at] < DATEADD(day, 1, @p${values.length})`);
        values.push(toDate);
    }

    return {
        sql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
        values
    };
};

const buildExportFilter = (fromDate, toDate, search, invoiceTypeCode) => {
    const filter = buildPurchaseFilter(fromDate, toDate, invoiceTypeCode);
    const searchText = String(search || "").trim();

    if (searchText) {
        filter.sql = filter.sql || "WHERE 1 = 1";
        filter.sql += ` AND (
            e.[invoice_no] LIKE @p${filter.values.length}
            OR e.[seller_name] LIKE @p${filter.values.length}
            OR e.[buyer_name] LIKE @p${filter.values.length}
            OR e.[SenderId] LIKE @p${filter.values.length}
            OR e.[ReceiverId] LIKE @p${filter.values.length}
        )`;
        filter.values.push(`%${searchText}%`);
    }

    return filter;
};

const getExportColumns = async () => {
    if (exportColumnsCache) return exportColumnsCache;

    const rows = await db.query`
        SELECT [COLUMN_NAME], [DATA_TYPE]
        FROM [INFORMATION_SCHEMA].[COLUMNS]
        WHERE [TABLE_NAME] = ${PURCHASE_TABLE}
        ORDER BY [ORDINAL_POSITION]
    `;

    const purchaseColumns = rows
        .filter((row) => !IN_DOCUMENT_COLUMN_SET.has(String(row.COLUMN_NAME || "").toLowerCase()))
        .map((row) => ({
            name: row.COLUMN_NAME,
            selectSql: isBinaryColumn(row.DATA_TYPE)
                ? `CONVERT(varchar(max), e.${quoteIdentifier(row.COLUMN_NAME)}, 1) AS ${quoteIdentifier(row.COLUMN_NAME)}`
                : `e.${quoteIdentifier(row.COLUMN_NAME)}`
        }));
    const inDocumentColumns = await getInDocumentSelectColumns({
        forExport: true,
        includeIdentity: false
    });

    exportColumnsCache = [
        ...purchaseColumns,
        ...IN_DOCUMENT_COLUMNS.map((columnName, index) => ({
            name: columnName,
            selectSql: inDocumentColumns[index]
        }))
    ];

    return exportColumnsCache;
};

const documentNumberExpression =
    "COALESCE(NULLIF(LTRIM(RTRIM(e.[invoice_no])), ''), CONVERT(varchar(50), e.[ID]))";

const getDashboardCounts = async (fromDate, toDate, invoiceTypeCode) => {
    const { sql, values } = buildPurchaseFilter(fromDate, toDate, invoiceTypeCode);
    const queueFilter = buildPurchaseQueueDateFilter(fromDate, toDate);

    const [rows, queueRows, dailyQueueRows] = await Promise.all([
        db.queryStatement(
            `SELECT
                COUNT(DISTINCT ${documentNumberExpression}) AS [total],
                COUNT(DISTINCT CASE
                    WHEN LTRIM(RTRIM(COALESCE(CONVERT(varchar(50), e.[invoice_type_code]), ''))) = '380'
                    THEN ${documentNumberExpression}
                END) AS [purchase],
                COUNT(DISTINCT CASE
                    WHEN LTRIM(RTRIM(COALESCE(CONVERT(varchar(50), e.[invoice_type_code]), ''))) <> '380'
                    THEN ${documentNumberExpression}
                END) AS [purchaseReturn]
             FROM [${PURCHASE_TABLE}] e
             ${sql}`,
            values
        ),
        db.queryStatement(
            `SELECT COUNT(q.[InstanceIdentifier]) AS [purchaseQueue]
             FROM [E_PurchaseQueue] q
             ${queueFilter.sql}`,
            queueFilter.values
        ),
        db.queryStatement(
            `SELECT
                CONVERT(varchar(10), q.[TransCreatedAt], 23) AS [date],
                COUNT(q.[InstanceIdentifier]) AS [purchase]
             FROM [E_PurchaseQueue] q
             ${queueFilter.sql}
             GROUP BY CONVERT(varchar(10), q.[TransCreatedAt], 23)
             ORDER BY CONVERT(varchar(10), q.[TransCreatedAt], 23)`,
            queueFilter.values
        )
    ]);

    return {
        total: rows[0]?.total || 0,
        purchase: queueRows[0]?.purchaseQueue || 0,
        purchaseFromDocuments: rows[0]?.purchase || 0,
        purchaseReturn: rows[0]?.purchaseReturn || 0,
        dailyPurchaseCounts: dailyQueueRows.map((row) => ({
            date: row.date,
            purchase: row.purchase || 0
        }))
    };
};

const getPurchases = async (_type, fromDate, toDate, invoiceTypeCode) => {
    const { sql, values } = buildPurchaseFilter(fromDate, toDate, invoiceTypeCode);

    return db.queryStatement(
        `SELECT
            ${documentNumberExpression} AS [InvoiceNumber],
            MAX(e.[ID]) AS [AutoIndex],
            MAX(e.[invoice_issue_date]) AS [InvoiceIssueDate],
            MAX(COALESCE(NULLIF(e.[seller_name], ''), NULLIF(e.[SenderId], ''), '')) AS [Customer],
            MAX(e.[invoice_total_without_tax]) AS [InvTotExcl],
            MAX(e.[invoice_total_tax_amt]) AS [InvTotTax],
            MAX(e.[invoice_total_with_tax]) AS [InvTotIncl],
            MAX(e.[invoice_currency_code]) AS [InvoiceCurrencyCode],
            MAX(e.[vat_cat_taxable_amt]) AS [TotalInvoiceAmt],
            MAX(e.[InstanceIdentifier]) AS [InstanceIdentifier],
            MAX(e.[DocCreatedAt]) AS [DocCreatedAt],
            COALESCE(MAX(CASE
                WHEN LOWER(LTRIM(RTRIM(t.[TransmissionType]))) = 'inbound'
                THEN t.[Status]
            END), 'Pending') AS [InboundStatus],
            COALESCE(MAX(CASE
                WHEN LOWER(LTRIM(RTRIM(t.[TransmissionType]))) = 'mls_outbound'
                THEN t.[Status]
            END), 'Pending') AS [C3ResponseStatus],
            COALESCE(MAX(CASE
                WHEN LOWER(LTRIM(RTRIM(t.[TransmissionType]))) = 'c3_tdd_mls_inbound'
                THEN t.[Status]
            END), 'Pending') AS [C5ResponseStatus]
         FROM [${PURCHASE_TABLE}] e
         LEFT JOIN [E_Get_Transaction] t
            ON e.[InstanceIdentifier] = t.[RootInstanceIdentifier]
         ${sql}
         GROUP BY ${documentNumberExpression}
         ORDER BY MAX(COALESCE(e.[DocCreatedAt], e.[created_at], e.[invoice_issue_date])) DESC, MAX(e.[ID]) DESC`,
        values
    );
};

const getRecentActivity = async (fromDate, toDate) => {
    const { sql, values } = buildPurchaseQueueDateFilter(fromDate, toDate);

    return db.queryStatement(
        `WITH QueueActivity AS (
            SELECT
                COALESCE(
                    NULLIF(LTRIM(RTRIM(q.[InvoiceNo])), ''),
                    NULLIF(LTRIM(RTRIM(q.[InstanceIdentifier])), ''),
                    CONVERT(varchar(50), q.[QueueId])
                ) AS [DocumentNo],
                MAX(q.[InstanceIdentifier]) AS [InstanceIdentifier],
                MAX(q.[InvoiceNo]) AS [InvoiceNo],
                MAX(q.[InvoiceType]) AS [InvoiceType],
                MAX(q.[Status]) AS [QueueStatus],
                MAX(q.[ProcessingStatus]) AS [ProcessingStatus],
                MAX(COALESCE(q.[TransCreatedAt], q.[CreatedAt], q.[UpdatedAt])) AS [CreatedAt]
             FROM [E_PurchaseQueue] q
             ${sql}
             GROUP BY COALESCE(
                NULLIF(LTRIM(RTRIM(q.[InvoiceNo])), ''),
                NULLIF(LTRIM(RTRIM(q.[InstanceIdentifier])), ''),
                CONVERT(varchar(50), q.[QueueId])
             )
        ),
        PurchaseSummary AS (
            SELECT
                e.[invoice_no] AS [DocumentNo],
                MAX(e.[invoice_issue_date]) AS [Date],
                MAX(e.[seller_name]) AS [Client],
                MAX(e.[invoice_currency_code]) AS [CurrencyCode],
                MAX(e.[invoice_total_with_tax]) AS [AmountValue]
             FROM [${PURCHASE_TABLE}] e
             GROUP BY e.[invoice_no]
        )
        SELECT
            'INBOUND' AS [Type],
            qa.[DocumentNo],
            qa.[InvoiceType],
            ps.[Date],
            COALESCE(ps.[Client], qa.[InstanceIdentifier], 'Unknown') AS [Client],
            COALESCE(ps.[CurrencyCode], 'AED') AS [CurrencyCode],
            ps.[AmountValue],
            COALESCE(qa.[ProcessingStatus], CONVERT(varchar(50), qa.[QueueStatus]), 'Pending') AS [Status],
            CONVERT(varchar(19), qa.[CreatedAt], 120) AS [CreatedAt]
         FROM QueueActivity qa
         LEFT JOIN PurchaseSummary ps
            ON qa.[DocumentNo] = ps.[DocumentNo]
         ORDER BY qa.[CreatedAt] DESC, qa.[DocumentNo] DESC`,
        values
    );
};

const getPurchaseDetails = async (documentNumber, invoiceTypeCode) => {
    const selectableColumns = await getSelectableColumns();
    const inDocumentColumns = await getInDocumentSelectColumns();
    const safeDocumentNumber = String(documentNumber || "").trim();
    const safeInvoiceTypeCode = normalizeInvoiceTypeCode(invoiceTypeCode);

    if (!safeDocumentNumber) return [];

    const typeSql = safeInvoiceTypeCode ? "AND e.[invoice_type_code] = @p1" : "";
    const values = safeInvoiceTypeCode
        ? [safeDocumentNumber, safeInvoiceTypeCode]
        : [safeDocumentNumber];

    return db.queryStatement(
        `SELECT
            ${selectableColumns.join(",\n            ")},
            ${inDocumentColumns.join(",\n            ")},
            ${documentNumberExpression} AS [InvoiceNumber],
            e.[invoice_issue_date] AS [InvoiceIssueDate],
            e.[payment_due_date] AS [InvoicePaymentDueDate],
            e.[invoice_currency_code] AS [InvoiceCurrencyCode],
            e.[invoice_txn_type_code] AS [TransactionCode],
            e.[buyer_name] AS [BuyerName],
            e.[buyer_addr_line1] AS [BuyerAddressline1],
            e.[buyer_city] AS [BuyerCity],
            e.[buyer_country_subdivision] AS [BuyerCountrySubdivision],
            e.[buyer_country_code] AS [BuyerCountry],
            e.[payment_means_type_code] AS [PaymentType],
            e.[vat_cat_code] AS [VatCategory],
            e.[invoice_line_id] AS [InvoiceLineIdentifier],
            e.[invoiced_qty] AS [InvoicedQuantity],
            e.[invoice_line_net_amt] AS [LineExtensionAmount],
            e.[item_name] AS [ItemName],
            e.[item_description] AS [ItemDescription],
            e.[item_vat_cat_code] AS [ItemVatCategory],
            e.[item_vat_rate] AS [ItemVatPrice],
            e.[invoiced_qty_uom_code] AS [UOMCode],
            e.[item_net_price] AS [PriceExcl],
            e.[seller_name] AS [SellerName],
            e.[seller_addr_line1] AS [SellerAddressline1],
            e.[seller_city] AS [SellerCity],
            e.[seller_country_subdivision] AS [SellerCountrySubdivision],
            e.[seller_country_code] AS [SellerCountryCode],
            e.[invoice_total_without_tax] AS [InvTotExcl],
            e.[invoice_total_tax_amt] AS [InvTotTax],
            e.[invoice_total_with_tax] AS [InvTotIncl],
            e.[invoice_line_net_amt] AS [LineNet],
            e.[vat_line_amt_aed] AS [LineTax],
            e.[invoice_line_amt_aed] AS [LineTotal],
            e.[vat_cat_taxable_amt] AS [TotalInvoiceAmt]
         FROM [${PURCHASE_TABLE}] e
         ${IN_DOCUMENT_APPLY}
         WHERE ${documentNumberExpression} = @p0
         ${typeSql}
         ORDER BY e.[ID] ASC`,
        values
    );
};

const getPurchaseTransactions = async (instanceIdentifier) => {
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
         FROM [E_Get_Transaction]
         WHERE [RootInstanceIdentifier] = @p0
         ORDER BY
            CASE LOWER(LTRIM(RTRIM([TransmissionType])))
                WHEN 'inbound' THEN 1
                WHEN 'c3_tdd_outbound' THEN 2
                WHEN 'mls_outbound' THEN 3
                WHEN 'c3_tdd_mls_inbound' THEN 4
                ELSE 5
            END,
            [CreatedDate] DESC,
            [InsertedOn] DESC`,
        [safeInstanceIdentifier]
    );
};

const getPurchaseInDocumentAttachment = async (documentNumber, invoiceTypeCode) => {
    const safeDocumentNumber = String(documentNumber || "").trim();
    const safeInvoiceTypeCode = normalizeInvoiceTypeCode(invoiceTypeCode);

    if (!safeDocumentNumber) return null;

    const typeSql = safeInvoiceTypeCode ? "AND e.[invoice_type_code] = @p1" : "";
    const values = safeInvoiceTypeCode
        ? [safeDocumentNumber, safeInvoiceTypeCode]
        : [safeDocumentNumber];
    const rows = await db.queryStatement(
        `SELECT TOP (1)
            idoc.[attached_document],
            idoc.[attached_doc_mime_code],
            idoc.[attached_doc_filename]
         FROM [${PURCHASE_TABLE}] e
         ${IN_DOCUMENT_APPLY}
         WHERE ${documentNumberExpression} = @p0
         ${typeSql}
           AND idoc.[attached_document] IS NOT NULL
         ORDER BY e.[ID] ASC`,
        values
    );
    const row = rows[0];
    const content = normalizeAttachmentContent(row?.attached_document);

    if (!content) return null;

    return {
        content,
        mimeCode: row.attached_doc_mime_code || "application/octet-stream",
        filename: row.attached_doc_filename
    };
};

const getPurchaseExportRows = async (fromDate, toDate, search, invoiceTypeCode) => {
    const exportColumns = await getExportColumns();
    const { sql, values } = buildExportFilter(fromDate, toDate, search, invoiceTypeCode);

    const rows = await db.queryStatement(
        `SELECT
            ${exportColumns.map((column) => column.selectSql).join(",\n            ")}
         FROM [${PURCHASE_TABLE}] e
         ${IN_DOCUMENT_APPLY}
         ${sql}
         ORDER BY COALESCE(e.[DocCreatedAt], e.[created_at], e.[invoice_issue_date]) DESC, e.[ID] DESC`,
        values
    );

    return {
        columns: exportColumns.map((column) => column.name),
        rows
    };
};

module.exports = {
    getDashboardCounts,
    getPurchases,
    getRecentActivity,
    getPurchaseDetails,
    getPurchaseTransactions,
    getPurchaseInDocumentAttachment,
    getPurchaseExportRows
};
