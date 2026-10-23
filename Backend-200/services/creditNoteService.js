const creditNoteRepository = require("../repositories/creditNoteRepository");
const queueRepository = require("../repositories/eInvoiceQueueRepository");
const { buildCreditNoteXml } = require("./ublCreditNoteXmlBuilder");
const {
    InvoiceXmlValidationError,
    insertAndSendArtaxError,
    getOutboundTransactions,
    getOutboundTransactionXml,
    getInvoiceOutDocument,
    getInvoiceOutDocumentAttachment,
    getInvoiceOutDocumentOptions,
    saveInvoiceOutDocument
} = require("./invoiceService");

const CREDIT_NOTE_DOC_TYPE = 1;
const CREDIT_NOTE_TYPE_CODE = "381";
const MISSING_PRECEDING_INVOICE_REF_ERROR =
    "Error is for the creditnote , preceding_invoice_ref is missing";

const isBlank = (value) =>
    value === null || value === undefined || String(value).trim() === "";

const invoiceNumberFromRow = (row = {}) =>
    String(row.invoice_no || row.InvoiceNumber || row.InvNumber || "").trim();

const isCreditNoteWithMissingPrecedingRef = (row = {}) =>
    String(row.invoice_type_code || "").trim() === CREDIT_NOTE_TYPE_CODE
    && isBlank(row.preceding_invoice_ref);

const validateCreditNoteRows = async (rows, { notifyArtaxError = false } = {}) => {
    const rowsWithErrors = rows.filter(isCreditNoteWithMissingPrecedingRef);
    const errorsByInvoice = new Map();

    rowsWithErrors.forEach((row) => {
        const invoiceNumber = invoiceNumberFromRow(row);
        if (!invoiceNumber || errorsByInvoice.has(invoiceNumber)) return;
        errorsByInvoice.set(invoiceNumber, {
            invoiceNumber,
            header: row,
            error: {
                invoiceNumber,
                docType: CREDIT_NOTE_DOC_TYPE,
                missingFields: ["preceding_invoice_ref"]
            }
        });
    });

    const invoiceNumbers = [...errorsByInvoice.keys()];

    if (!invoiceNumbers.length) return;

    for (const invoiceNumber of invoiceNumbers) {
        await queueRepository.markArtaxErrorByInvoiceNumber({
            invNumber: invoiceNumber,
            docType: CREDIT_NOTE_DOC_TYPE,
            errorMessage: MISSING_PRECEDING_INVOICE_REF_ERROR
        });

        if (notifyArtaxError) {
            try {
                const validation = errorsByInvoice.get(invoiceNumber);
                await insertAndSendArtaxError({
                    group: {
                        invoiceNumber,
                        header: validation.header
                    },
                    errors: [validation.error],
                    docType: CREDIT_NOTE_DOC_TYPE,
                    errorMessage: MISSING_PRECEDING_INVOICE_REF_ERROR
                });
            } catch (error) {
                console.error(
                    `Failed to log/send Artax validation error for ${invoiceNumber}:`,
                    error.message || error
                );
            }
        }
    }

    throw new InvoiceXmlValidationError(
        MISSING_PRECEDING_INVOICE_REF_ERROR,
        [...errorsByInvoice.values()].map((validation) => validation.error)
    );
};

const getCreditNotesXml = async (options = {}) => {
    const rows = await creditNoteRepository.getAllCreditNotes();
    await validateCreditNoteRows(rows, options);
    return buildCreditNoteXml(rows, "No credit notes found");
};

const getSelectedCreditNotesXml = async (invoiceNumbers, options = {}) => {
    const rows = await creditNoteRepository.getCreditNoteDetailsByNumbers(invoiceNumbers);
    await validateCreditNoteRows(rows, options);
    return buildCreditNoteXml(rows, "No credit notes found");
};

const getSingleCreditNoteXml = async (invoiceNumber, options = {}) => {
    const rows = await creditNoteRepository.getCreditNoteDetails(invoiceNumber);
    await validateCreditNoteRows(rows, options);
    return buildCreditNoteXml(rows, "No credit notes found");
};

const getDashboard = async (fromDate, toDate) =>
    creditNoteRepository.getDashboardCounts(fromDate, toDate);
const getCreditNotes = async (type, fromDate, toDate) =>
    creditNoteRepository.getCreditNotesByType(type, fromDate, toDate);
const getCreditNoteDetails = async (invNumber) =>
    creditNoteRepository.getCreditNoteDetails(invNumber);
const getCreditNoteOutDocument = async (invNumber) =>
    getInvoiceOutDocument(invNumber, CREDIT_NOTE_DOC_TYPE);
const getCreditNoteOutDocumentAttachment = async (invNumber) =>
    getInvoiceOutDocumentAttachment(invNumber, CREDIT_NOTE_DOC_TYPE);
const getCreditNoteOutDocumentOptions = async () =>
    getInvoiceOutDocumentOptions();
const saveCreditNoteOutDocument = async (invoiceNumber, body) =>
    saveInvoiceOutDocument(invoiceNumber, body, CREDIT_NOTE_DOC_TYPE);

module.exports = {
    getCreditNotesXml,
    getSelectedCreditNotesXml,
    getSingleCreditNoteXml,
    getDashboard,
    getCreditNotes,
    getCreditNoteDetails,
    getCreditNoteOutDocument,
    getCreditNoteOutDocumentAttachment,
    getCreditNoteOutDocumentOptions,
    saveCreditNoteOutDocument,
    getOutboundTransactions,
    getOutboundTransactionXml
};
