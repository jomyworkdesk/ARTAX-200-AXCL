const creditNoteService = require("../services/creditNoteService");
const taxillaService = require("../services/taxillaService");
const creditNoteSendService = require("../services/creditNoteSendService");
const configureService = require("../services/configureService");

const getCreditNotesXml = async (req, res) => {
    try {
        const xml = await creditNoteService.getCreditNotesXml();
        res.set("Content-Type", "application/xml");
        res.set("Content-Disposition", 'attachment; filename="credit-notes.xml"');
        return res.send(xml);
    } catch (error) {
        console.error(error);
        return res.status(error.name === "InvoiceXmlValidationError" ? 400 : 500).send(error.message);
    }
};

const getSelectedCreditNotesXml = async (req, res) => {
    try {
        const invoiceNumbers = Array.isArray(req.body?.invoiceNumbers)
            ? req.body.invoiceNumbers
            : [];

        if (invoiceNumbers.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one invoice number is required"
            });
        }

        const xml = await creditNoteService.getSelectedCreditNotesXml(invoiceNumbers);
        res.set("Content-Type", "application/xml");
        res.set("Content-Disposition", 'attachment; filename="selected-credit-notes.xml"');
        return res.send(xml);
    } catch (error) {
        return res.status(error.name === "InvoiceXmlValidationError" ? 400 : 500).send(error.message);
    }
};

const getSingleCreditNoteXml = async (req, res) => {
    try {
        const invoiceNumber = req.params.invNumber;
        const xml = await creditNoteService.getSingleCreditNoteXml(invoiceNumber);
        res.set("Content-Type", "application/xml");
        res.set(
            "Content-Disposition",
            `attachment; filename="credit-note-${encodeURIComponent(invoiceNumber)}.xml"`
        );
        return res.send(xml);
    } catch (error) {
        return res.status(error.name === "InvoiceXmlValidationError" ? 400 : 500).send(error.message);
    }
};

const sendSelectedCreditNotes = async (req, res) => {
    try {
        const invoiceNumbers = Array.isArray(req.body?.invoiceNumbers)
            ? req.body.invoiceNumbers
            : [];

        if (invoiceNumbers.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one credit note number is required"
            });
        }

        await configureService.ensureCanSend();

        const result = await creditNoteSendService.sendCreditNotesSequentially({
            invoiceNumbers,
            createdBy: taxillaService.getCreatedBy(req.session, req.user)
        });

        const statusCode =
            result.failedCount === 0 ? 200 : result.sentCount > 0 ? 207 : 500;

        return res.status(statusCode).json({
            ...result,
            message: result.failedCount === 0
                ? `${result.sentCount} credit note(s) sent to Taxilla successfully`
                : `${result.sentCount} credit note(s) sent, ${result.failedCount} failed`
        });
    } catch (error) {
        const statusCode = error.statusCode || (error.name === "InvoiceXmlValidationError" ? 400 : 500);
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to send credit note XML"
        });
    }
};

const sendSingleCreditNote = async (req, res) => {
    try {
        const invoiceNumber = req.params.invNumber;
        await configureService.ensureCanSend();

        const result = await creditNoteSendService.sendCreditNote({
            invoiceNumber,
            createdBy: taxillaService.getCreatedBy(req.session, req.user),
        });

        return res.json({
            ...result,
            message:
                result.responseMessage ||
                `Credit note ${invoiceNumber} sent to Taxilla successfully`
        });
    } catch (error) {
        const statusCode = error.statusCode || (error.name === "InvoiceXmlValidationError" ? 400 : 500);
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to send credit note XML"
        });
    }
};

const getDashboard = async (req, res) => {
    try {
        const dashboard = await creditNoteService.getDashboard(
            req.query.fromDate,
            req.query.toDate
        );
        return res.json(dashboard);
    } catch (error) {
        return res.status(500).send(error.message);
    }
};

const getCreditNotes = async (req, res) => {
    try {
        const creditNotes = await creditNoteService.getCreditNotes(
            req.query.type,
            req.query.fromDate,
            req.query.toDate
        );
        return res.json(creditNotes);
    } catch (error) {
        return res.status(500).send(error.message);
    }
};

const getCreditNoteDetails = async (req, res) => {
    try {
        const creditNoteDetails = await creditNoteService.getCreditNoteDetails(
            req.params.invNumber
        );
        return res.json(creditNoteDetails);
    } catch (error) {
        return res.status(500).send(error.message);
    }
};

const getCreditNoteOutDocument = async (req, res) => {
    try {
        const outDocument = await creditNoteService.getCreditNoteOutDocument(
            req.params.invNumber
        );
        return res.json(outDocument || {});
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to load credit note supporting document"
        });
    }
};

const getCreditNoteOutDocumentAttachment = async (req, res) => {
    try {
        const attachment = await creditNoteService.getCreditNoteOutDocumentAttachment(
            req.params.invNumber
        );

        if (!attachment) {
            return res.status(404).json({
                success: false,
                message: "Attached document was not found"
            });
        }

        const safeFilename = String(attachment.filename || "attachment")
            .replace(/[\r\n"]/g, "");
        const disposition = req.query?.disposition === "attachment"
            ? "attachment"
            : "inline";

        res.set("Content-Type", attachment.mimeCode || "application/octet-stream");
        res.set("Content-Disposition", `${disposition}; filename="${safeFilename}"`);
        return res.send(attachment.content);
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to load credit note attachment"
        });
    }
};

const getCreditNoteOutDocumentOptions = async (req, res) => {
    try {
        const options = await creditNoteService.getCreditNoteOutDocumentOptions();
        return res.json({
            success: true,
            data: options
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to load credit note supporting document options"
        });
    }
};

const saveCreditNoteOutDocument = async (req, res) => {
    try {
        const outDocument = await creditNoteService.saveCreditNoteOutDocument(
            req.params.invNumber,
            req.body || {}
        );

        return res.json({
            success: true,
            message: "Supporting document saved successfully",
            data: outDocument
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to save credit note supporting document"
        });
    }
};

const getOutboundTransactions = async (req, res) => {
    try {
        const transactions = await creditNoteService.getOutboundTransactions(
            req.params.instanceIdentifier
        );
        return res.json(transactions);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const getOutboundTransactionXml = async (req, res) => {
    try {
        const xml = await creditNoteService.getOutboundTransactionXml(
            req.params.transactionId,
            taxillaService.getCreatedBy(req.session, req.user)
        );
        return res.json({ xml });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getCreditNotesXml,
    getSelectedCreditNotesXml,
    getSingleCreditNoteXml,
    sendSelectedCreditNotes,
    sendSingleCreditNote,
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
