const invoiceService = require("./invoiceService");
const taxillaService = require("./taxillaService");

const INVOICE_DOC_TYPE = 4;

const sendInvoice = async ({ invoiceNumber, createdBy }) =>
    taxillaService.sendGeneratedXml({
        generateXml: () => invoiceService.getSingleInvoiceXml(
            invoiceNumber,
            INVOICE_DOC_TYPE,
            { notifyArtaxError: true }
        ),
        createdBy,
        invNumber: invoiceNumber,
        docType: INVOICE_DOC_TYPE
    });


const sendInvoicesSequentially = async ({ invoiceNumbers, createdBy }) => {
    const results = [];

    for (const invoiceNumber of invoiceNumbers) {
        try {
            const result = await sendInvoice({ invoiceNumber, createdBy });

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
                message: error.message || "Failed to send invoice XML"
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
    INVOICE_DOC_TYPE,
    sendInvoice,
    sendInvoicesSequentially
};
