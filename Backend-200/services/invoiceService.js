const invoiceRepository = require("../repositories/invoiceRepository");
const queueRepository = require("../repositories/eInvoiceQueueRepository");
const errorRepository = require("../repositories/eInvoiceErrorRepository");
const { requestAccessToken } = require("./taxillaService");
const { getPurchaseInvoiceXml } = require("./purchaseDownloadService");
const { buildInvoiceXml } = require("./ublInvoiceXmlBuilder");
const { sendInvoiceValidationErrorMail } = require("./invoiceValidationErrorMailerService");

class InvoiceXmlValidationError extends Error {
    constructor(message, details = []) {
        super(message);
        this.name = "InvoiceXmlValidationError";
        this.details = details;
    }
}

const isMissing = (value) => value === null || value === undefined || value === "";

const firstFilled = (...values) =>
    values.find((value) => !isMissing(value)) ?? "";

const ALLOWED_ATTACHMENT_MIME_CODES = new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/xml"
]);
const SUPPORTING_DOCUMENT_TYPE_CODE = "130";

const inputError = (message, statusCode = 400) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const textValue = (value) =>
    value === null || value === undefined ? "" : String(value).trim();

const nullableTextValue = (value) => {
    const text = textValue(value);
    return text || null;
};

const normalizeBase64Document = (value) => {
    const rawValue = textValue(value);
    if (!rawValue) return null;

    const base64Value = rawValue.startsWith("data:") && rawValue.includes(",")
        ? rawValue.slice(rawValue.indexOf(",") + 1)
        : rawValue;
    const normalized = base64Value.replace(/\s/g, "");

    if (!normalized || normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
        throw inputError("Attached document must be base64 encoded");
    }

    return normalized;
};

const buildOutDocumentPayload = (invoiceNumber, body = {}) => {
    const safeInvoiceNumber = textValue(invoiceNumber);
    const attachedDocument = normalizeBase64Document(body.attached_document);
    const mimeCode = nullableTextValue(body.attached_doc_mime_code);
    const filename = nullableTextValue(body.attached_doc_filename);
    const hasAttachment = attachedDocument !== null
        || body.has_attached_document === true
        || body.has_attached_document === 1
        || body.has_attached_document === "1";

    if (mimeCode && !ALLOWED_ATTACHMENT_MIME_CODES.has(mimeCode)) {
        throw inputError("Attached document type is not supported");
    }

    if (hasAttachment && (!mimeCode || !filename)) {
        throw inputError("Please select an attached document again");
    }

    return {
        attachedDocumentProvided: attachedDocument !== null,
        outDocument: {
            invoiced_obj_id: nullableTextValue(body.invoiced_obj_id) || safeInvoiceNumber,
            invoiced_obj_scheme_id: nullableTextValue(body.invoiced_obj_scheme_id),
            document_type_code: SUPPORTING_DOCUMENT_TYPE_CODE,
            support_doc_ref: nullableTextValue(body.support_doc_ref),
            support_doc_desc: nullableTextValue(body.support_doc_desc),
            attached_document: attachedDocument,
            attached_doc_mime_code: mimeCode,
            attached_doc_filename: filename,
            external_doc_location: nullableTextValue(body.external_doc_location)
        }
    };
};

const getTransactionTypeCode = (row = {}) =>
    String(firstFilled(
        row.invoice_txn_type_code,
        row.TransactionCode,
        row.transaction_code,
        row.syntax_binding_qualifier
    )).trim();

const getSellerSupplierPartyId = (row = {}) =>
    firstFilled(row.seller_supplier_party_id, row.seller_party_id, row.principle_id);

const normalizedVatCategoryCode = (value) =>
    String(value || "").trim().toUpperCase();

const invoiceKey = (row) =>
    String(row?.invoice_no || row?.InvoiceNumber || row?.InvNumber || row?.ID || "").trim();

const groupRowsByInvoice = (rows) => {
    const grouped = new Map();

    rows.forEach((row) => {
        const key = invoiceKey(row);
        if (!grouped.has(key)) grouped.set(key, { invoiceNumber: key, header: row, lines: [] });
        grouped.get(key).lines.push(row);
    });

    return [...grouped.values()];
};

const HEADER_MANDATORY_FIELDS = [
    ["spec_identifier", "Specification identifier"],
    ["business_process_type", "Business process type"],
    ["invoice_txn_type_code", "Invoice transaction type code"],
    ["invoice_no", "Invoice number"],
    ["unique_identifier_no", "Unique Identifier Number"],
    ["invoice_issue_date", "Invoice issue date"],
    ["payment_due_date", "Payment due date"],
    ["invoice_type_code", "Invoice type code"],
    ["invoice_currency_code", "Invoice currency code"],
    ["seller_elec_address", "Seller electronic address"],
    ["seller_elec_scheme_id", "Seller electronic address identification scheme identifier"],
    ["seller_addr_line1", "Seller address line 1"],
    ["seller_city", "Seller city"],
    ["seller_country_subdivision", "Seller country subdivision"],
    ["seller_country_code", "Seller country code"],
    ["seller_vat_id", "Seller VAT identifier"],
    ["seller_tax_scheme_code", "Seller tax scheme code"],
    ["seller_name", "Seller name"],
    ["seller_legal_reg_type", "Seller legal registration identifier type"],
    ["buyer_elec_address", "Buyer electronic address"],
    ["buyer_elec_scheme_id", "Buyer electronic address scheme identifier"],
    ["buyer_addr_line1", "Buyer address line 1"],
    ["buyer_city", "Buyer city"],
    ["buyer_country_subdivision", "Buyer country subdivision"],
    ["buyer_country_code", "Buyer country code"],
    ["buyer_vat_id", "Buyer VAT identifier"],
    ["buyer_tax_scheme_code", "Buyer tax scheme code"],
    ["buyer_name", "Buyer name"],
    ["payment_means_type_code", "Payment means type code"],
    ["invoice_total_tax_amt", "Invoice total TAX amount"],
    ["vat_cat_taxable_amt", "VAT category taxable amount"],
    ["vat_cat_tax_amt", "VAT category tax amount"],
    ["vat_cat_code", "VAT category code"],
    ["vat_cat_rate", "VAT category rate"],
    ["vat_cat_tax_scheme_code", "VAT category tax scheme code"],
    ["invoice_line_net_total", "Sum of Invoice line net amount"],
    ["invoice_total_without_tax", "Invoice total amount without TAX"],
    ["invoice_total_with_tax", "Invoice total amount with TAX"],
    ["amount_due", "Amount due for payment"]
];

const LINE_MANDATORY_FIELDS = [
    ["invoice_line_id", "Invoice line identifier"],
    ["invoiced_qty", "Invoiced quantity"],
    ["invoiced_qty_uom_code", "Invoiced quantity unit of measure code"],
    ["invoice_line_net_amt", "Invoice line net amount"],
    ["item_description", "Item description"],
    ["item_name", "Item name"],
    ["item_vat_cat_code", "Invoiced item VAT category code"],
    ["item_vat_rate", "Invoiced item VAT rate"],
    ["item_tax_scheme", "Item tax scheme"],
    ["item_net_price", "Item net price"],
    ["item_price_base_qty", "Item price base quantity"],
    ["item_gross_price", "Item gross price"],
    ["invoice_line_amt_aed", "Invoice line amount in AED"],
    ["vat_line_amt_aed", "VAT Line amount in AED"]
];

const LINE_VAT_CATEGORY_MANDATORY_FIELDS = {
    AE: [
        ["goods_service_type", "Type of goods or services"]
    ],
    Z: [
        ["vat_exempt_reason_text", "VAT exemption reason text"]
    ],
    E: [
        ["vat_exempt_reason_code", "VAT exemption reason code"]
    ]
};

const TRANSACTION_TYPE_HEADER_MANDATORY_FIELDS = {
    "10000000": [
        ["beneficiary_id", "Beneficiary ID"]
    ],
    "00000001": [
        ["deliver_to_addr_line1", "Delivery address line 1"],
        ["deliver_to_city", "Delivery city"],
        ["deliver_to_country_code", "Delivery country code"]
    ]
};

const TRANSACTION_TYPE_HEADER_VALIDATORS = {
    // "00000100": [
    //     {
    //         isMissing: (header) => isMissing(getSellerSupplierPartyId(header)),
    //         label: "Seller supplier party ID"
    //     }
    // ]
};

const validateInvoiceRows = (rows) => {
    const errors = [];

    for (const group of groupRowsByInvoice(rows)) {
        const transactionTypeCode = getTransactionTypeCode(group.header);
        const headerMandatoryFields = [
            ...HEADER_MANDATORY_FIELDS,
            ...(TRANSACTION_TYPE_HEADER_MANDATORY_FIELDS[transactionTypeCode] || [])
        ];
        const missingHeaderFields = headerMandatoryFields
            .filter(([field]) => isMissing(group.header[field]))
            .map(([, label]) => label);
        const conditionalMissingHeaderFields = (TRANSACTION_TYPE_HEADER_VALIDATORS[transactionTypeCode] || [])
            .filter((validator) => validator.isMissing(group.header))
            .map((validator) => validator.label);
        missingHeaderFields.push(...conditionalMissingHeaderFields);

        if (missingHeaderFields.length) {
            errors.push({
                invoiceNumber: group.invoiceNumber,
                docType: group.header.DocType ?? group.header.doc_type,
                missingFields: missingHeaderFields
            });
        }

        group.lines.forEach((line, index) => {
            const itemVatCategoryCode = normalizedVatCategoryCode(line.item_vat_cat_code);
            const missingLineFields = LINE_MANDATORY_FIELDS
                .filter(([field]) => isMissing(line[field]))
                .map(([, label]) => label);
            const missingConditionalLineFields = (LINE_VAT_CATEGORY_MANDATORY_FIELDS[itemVatCategoryCode] || [])
                .filter(([field]) => isMissing(line[field]))
                .map(([, label]) => label);
            missingLineFields.push(...missingConditionalLineFields);

            if (missingLineFields.length) {
                errors.push({
                    invoiceNumber: group.invoiceNumber,
                    docType: line.DocType ?? line.doc_type ?? group.header.DocType ?? group.header.doc_type,
                    lineNumber: index + 1,
                    lineId: line.invoice_line_id,
                    missingFields: missingLineFields
                });
            }
        });
    }

    return errors;
};

const buildValidationMessage = (errors) => {
    const summaries = errors.slice(0, 5).map((error) => {
        const lineText = error.lineNumber ? ` line ${error.lineNumber}` : "";
        return `${error.invoiceNumber || "Unknown invoice"}${lineText}: ${error.missingFields.join(", ")}`;
    });

    const suffix = errors.length > summaries.length
        ? `; and ${errors.length - summaries.length} more issue(s)`
        : "";

    return `Invoice XML mandatory field validation failed. ${summaries.join("; ")}${suffix}`;
};

const buildInvoiceValidationMessage = (invoiceNumber, errors) => {
    const summaries = errors.map((error) => {
        const lineText = error.lineNumber ? ` line ${error.lineNumber}` : "";
        return `${invoiceNumber || "Unknown invoice"}${lineText}: ${error.missingFields.join(", ")}`;
    });

    return `Artax error: Invoice XML Missing field. ${summaries.join("; ")}`;
};

const insertAndSendArtaxError = async ({ group, errors, docType, errorMessage }) => {
    const dubaiNow = new Date(Date.now() + (4 * 60 * 60 * 1000));
    const header = group.header || {};
    const validationMessage = errorMessage || buildInvoiceValidationMessage(group.invoiceNumber, errors);

    const errorLogId = await errorRepository.insertValidationError({
        instanceIdentifier: null,
        invNumber: group.invoiceNumber,
        errorAt: null,
        useDubaiNowForErrorAt: true,
        error: validationMessage,
        customer: header.buyer_name || header.BuyerName || header.Customer,
        status: "ARTAX_ERROR",
        invoiceAmt: header.invoice_total_with_tax || header.InvTotIncl,
        invDate: header.invoice_issue_date || header.InvoiceIssueDate
    });

    const recipients = await errorRepository.getMailRecipients();
    const mailRow = {
        InstanceIdentifier: null,
        InvNumber: group.invoiceNumber,
        ErrorAt: dubaiNow,
        CreatedAt: dubaiNow,
        Error: validationMessage,
        Customer: header.buyer_name || header.BuyerName || header.Customer,
        Status: "ARTAX_ERROR",
        status: "ARTAX_ERROR",
        InvoiceAmt: header.invoice_total_with_tax || header.InvTotIncl,
        InvDate: header.invoice_issue_date || header.InvoiceIssueDate,
        tomail: recipients.tomail,
        ccmail: recipients.ccmail,
        DocType: docType
    };

    try {
        const mailResult = await sendInvoiceValidationErrorMail(mailRow);
        if (!mailResult.delivered) {
            const error = new Error(`Artax error mail was not delivered to ${mailResult.to}`);
            error.providerMessageId = mailResult.messageId;
            throw error;
        }

        await errorRepository.markMailSuccess({
            id: errorLogId,
            toMail: mailResult.to,
            providerMessageId: mailResult.messageId
        });
    } catch (error) {
        await errorRepository.markMailFailure({
            id: errorLogId,
            providerMessageId: error.providerMessageId
        });
        throw error;
    }
};

const validateAndMarkRows = async (rows, fallbackDocType, { notifyArtaxError = false } = {}) => {
    const errors = validateInvoiceRows(rows);
    if (!errors.length) return;

    const message = buildValidationMessage(errors);
    const invoiceDocTypes = new Map();
    const errorsByInvoice = new Map();
    const groupsByInvoice = new Map(groupRowsByInvoice(rows).map((group) => [group.invoiceNumber, group]));

    errors.forEach((error) => {
        if (!error.invoiceNumber) return;
        invoiceDocTypes.set(error.invoiceNumber, error.docType ?? fallbackDocType);
        if (!errorsByInvoice.has(error.invoiceNumber)) errorsByInvoice.set(error.invoiceNumber, []);
        errorsByInvoice.get(error.invoiceNumber).push(error);
    });

    for (const [invoiceNumber, docType] of invoiceDocTypes.entries()) {
        await queueRepository.markArtaxErrorByInvoiceNumber({
            invNumber: invoiceNumber,
            docType,
            errorMessage: message
        });

        if (notifyArtaxError) {
            try {
                await insertAndSendArtaxError({
                    group: groupsByInvoice.get(invoiceNumber) || { invoiceNumber, header: {} },
                    errors: errorsByInvoice.get(invoiceNumber) || [],
                    docType
                });
            } catch (error) {
                console.error(
                    `Failed to log/send Artax validation error for ${invoiceNumber}:`,
                    error.message || error
                );
            }
        }
    }

    throw new InvoiceXmlValidationError(message, errors);
};

const getInvoicesXml = async (docType = invoiceRepository.INVOICE_DOC_TYPE, options = {}) => {
    const rows = await invoiceRepository.getAllInvoices(docType);
    await validateAndMarkRows(rows, docType, options);
    return buildInvoiceXml(rows);
};

const getSelectedInvoicesXml = async (invoiceNumbers, docType = invoiceRepository.INVOICE_DOC_TYPE, options = {}) => {
    const rows = await invoiceRepository.getInvoiceDetailsByNumbers(invoiceNumbers, docType);
    await validateAndMarkRows(rows, docType, options);
    return buildInvoiceXml(rows);
};

const getSingleInvoiceXml = async (invoiceNumber, docType = invoiceRepository.INVOICE_DOC_TYPE, options = {}) => {
    const rows = await invoiceRepository.getInvoiceDetails(invoiceNumber, docType);
    await validateAndMarkRows(rows, docType, options);
    return buildInvoiceXml(rows);
};

const getDashboard = async (fromDate, toDate) =>
    invoiceRepository.getDashboardCounts(fromDate, toDate);
const getInvoices = async (type, fromDate, toDate) =>
    invoiceRepository.getInvoicesByType(type, fromDate, toDate);
const getFailedInvoiceErrors = async (fromDate, toDate) =>
    invoiceRepository.getFailedInvoiceErrors(fromDate, toDate);
const getArtaxInvoiceErrors = async (fromDate, toDate) =>
    invoiceRepository.getArtaxInvoiceErrors(fromDate, toDate);
const getInvoiceResponseLogs = async (invNumber) =>
    invoiceRepository.getInvoiceResponseLogs(invNumber);
const getArtaxErrorsResponse = async (invNumber) =>
    invoiceRepository.getArtaxErrorsResponse(invNumber);
const getInvoiceDetails = async (invNumber) =>
    invoiceRepository.getInvoiceDetails(invNumber);
const getInvoiceOutDocument = async (invNumber, docType = invoiceRepository.INVOICE_DOC_TYPE) =>
    invoiceRepository.getInvoiceOutDocument(invNumber, docType);
const getInvoiceOutDocumentAttachment = async (invNumber, docType = invoiceRepository.INVOICE_DOC_TYPE) =>
    invoiceRepository.getInvoiceOutDocumentAttachment(invNumber, docType);
const getInvoiceOutDocumentOptions = async () =>
    invoiceRepository.getInvoiceOutDocumentOptions();
const saveInvoiceOutDocument = async (
    invoiceNumber,
    body,
    docType = invoiceRepository.INVOICE_DOC_TYPE
) => {
    const payload = buildOutDocumentPayload(invoiceNumber, body);

    return invoiceRepository.saveInvoiceOutDocument({
        invoiceNumber,
        docType,
        ...payload
    });
};
const getOutboundTransactions = async (instanceIdentifier) =>
    invoiceRepository.getOutboundTransactions(instanceIdentifier);
const getOutboundTransactionXml = async (transactionId, createdBy = "system") => {
    const safeTransactionId = String(transactionId || "").trim();

    if (!safeTransactionId) {
        throw new Error("TransactionId is required");
    }

    const token = await requestAccessToken({ createdBy });
    return getPurchaseInvoiceXml({
        token,
        transactionId: safeTransactionId
    });
};


module.exports = { 
    InvoiceXmlValidationError,
    insertAndSendArtaxError,
    getInvoicesXml,
    getSelectedInvoicesXml,
    getSingleInvoiceXml,
    getDashboard,
    getInvoices,
    getFailedInvoiceErrors,
    getArtaxInvoiceErrors,
    getInvoiceResponseLogs,
    getArtaxErrorsResponse,
    getInvoiceDetails,
    getInvoiceOutDocument,
    getInvoiceOutDocumentAttachment,
    getInvoiceOutDocumentOptions,
    saveInvoiceOutDocument,
    getOutboundTransactions,
    getOutboundTransactionXml
};
