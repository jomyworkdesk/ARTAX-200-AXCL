const creditNoteService = require("./creditNoteService");
const taxillaService = require("./taxillaService");

const CREDIT_NOTE_DOC_TYPE = 1;

const sendCreditNote = async ({ invoiceNumber, createdBy }) =>
    taxillaService.sendGeneratedXml({
        generateXml: () => creditNoteService.getSingleCreditNoteXml(
            invoiceNumber,
            { notifyArtaxError: true }
        ),
        createdBy,
        invNumber: invoiceNumber,
        docType: CREDIT_NOTE_DOC_TYPE
    });

const sendCreditNotesSequentially = async ({ invoiceNumbers, createdBy }) => {
    const results = [];

    for (const invoiceNumber of invoiceNumbers) {
        try {
            const result = await sendCreditNote({ invoiceNumber, createdBy });

            results.push({
                invoiceNumber,
                success: true,
                statusCode: result.statusCode,
                responseMessage: result.responseMessage,
                response: result.response
            });
        } catch (error) {
            results.push({
                invoiceNumber,
                success: false,
                message: error.message || "Failed to send credit note XML"
            });
        }
    }

    const sent = results.filter((result) => result.success);
    const failed = results.filter((result) => !result.success);

    return {
        success: failed.length === 0,
        total: invoiceNumbers.length,
        sentCount: sent.length,
        failedCount: failed.length,
        results
    };
};

module.exports = {
    CREDIT_NOTE_DOC_TYPE,
    sendCreditNote,
    sendCreditNotesSequentially
};
