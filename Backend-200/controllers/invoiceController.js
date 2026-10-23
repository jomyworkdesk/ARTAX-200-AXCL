const invoiceService = require("../services/invoiceService");
const taxillaService = require("../services/taxillaService");
const invoiceSendService = require("../services/invoiceSendService");
const { syncInvoices, syncSelectedInvoices } = require("../services/invoiceSyncService");
const configureService = require("../services/configureService");

const getInvoicesXml = async (req, res) => {
    try {
        const xml = await invoiceService.getInvoicesXml();
        res.set("Content-Type", "application/xml");
        res.set("Content-Disposition", 'attachment; filename="invoices.xml"');
        return res.send(xml);
    } catch (error) {
        console.error(error);
        return res.status(error.name === "InvoiceXmlValidationError" ? 400 : 500).send(error.message);
    }
};

const getSelectedInvoicesXml = async (req, res) => {
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

        const xml = await invoiceService.getSelectedInvoicesXml(invoiceNumbers);
        res.set("Content-Type", "application/xml");
        res.set("Content-Disposition", 'attachment; filename="selected-invoices.xml"');
        return res.send(xml);
    } catch (error) {
        return res.status(error.name === "InvoiceXmlValidationError" ? 400 : 500).send(error.message);
    }
};

const getSingleInvoiceXml = async (req, res) => {
    try {
        const invoiceNumber = req.params.invNumber;
        const xml = await invoiceService.getSingleInvoiceXml(invoiceNumber);
        res.set("Content-Type", "application/xml");
        res.set(
            "Content-Disposition",
            `attachment; filename="invoice-${encodeURIComponent(invoiceNumber)}.xml"`
        );
        return res.send(xml);
    } catch (error) {
        return res.status(error.name === "InvoiceXmlValidationError" ? 400 : 500).send(error.message);
    }
};

const sendSelectedInvoices = async (req, res) => {
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

        await configureService.ensureCanSend();

        const result = await invoiceSendService.sendInvoicesSequentially({
            invoiceNumbers,
            createdBy: taxillaService.getCreatedBy(req.session, req.user)
        });

        const statusCode =
            result.failedCount === 0 ? 200 : result.sentCount > 0 ? 207 : 500;

        return res.status(statusCode).json({
            ...result,
            message: result.failedCount === 0
                ? `${result.sentCount} invoice(s) sent to Taxilla successfully`
                : `${result.sentCount} invoice(s) sent, ${result.failedCount} failed`
        });
    } catch (error) {
        const statusCode = error.statusCode || (error.name === "InvoiceXmlValidationError" ? 400 : 500);
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Failed to send invoice XML"
        });
    }
};

const sendSingleInvoice = async (req, res) => {
    try {
        const invoiceNumber = req.params.invNumber;
        await configureService.ensureCanSend();

        const result = await invoiceSendService.sendInvoice({
            invoiceNumber,
            createdBy: taxillaService.getCreatedBy(req.session, req.user),
        });

        return res.json({
            ...result,
            message:
                result.responseMessage ||
                `Invoice ${invoiceNumber} sent to Taxilla successfully`
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to send invoice XML"
        });
    }
};

const getDashboard = async (req, res) => {
    try {
        const dashboard = await invoiceService.getDashboard(
            req.query.fromDate,
            req.query.toDate
        );
        return res.json(dashboard);
    } catch (error) {
        return res.status(500).send(error.message);
    }
};

const getInvoices = async (req, res) => {
    try {
        const invoices = await invoiceService.getInvoices(
            req.query.type,
            req.query.fromDate,
            req.query.toDate
        );
        return res.json(invoices);
    } catch (error) {
        return res.status(500).send(error.message);
    }
};

const getFailedInvoiceErrors = async (req, res) => {
    try {
        const invoices = await invoiceService.getFailedInvoiceErrors(
            req.query.fromDate,
            req.query.toDate
        );
        return res.json(invoices);
    } catch (error) {
        return res.status(500).send(error.message);
    }
};

const getArtaxInvoiceErrors = async (req, res) => {
    try {
        const invoices = await invoiceService.getArtaxInvoiceErrors(
            req.query.fromDate,
            req.query.toDate
        );
        return res.json(invoices);
    } catch (error) {
        return res.status(500).send(error.message);
    }
};

const getInvoiceResponseLogs = async (req, res) => {
    try {
        const logs = await invoiceService.getInvoiceResponseLogs(req.params.invNumber);
        return res.json(logs);
    } catch (error) {
        return res.status(500).send(error.message);
    }
};

const getArtaxErrorsResponse = async (req, res) => {
    try {
        const logs = await invoiceService.getArtaxErrorsResponse(req.params.invNumber);
        return res.json(logs);
    } catch (error) {
        return res.status(500).send(error.message);
    }
};

const getInvoiceDetails = async (req, res) => {
    try {
        const invoiceDetails = await invoiceService.getInvoiceDetails(
            req.params.invNumber
        );
        return res.json(invoiceDetails);
    } catch (error) {
        return res.status(500).send(error.message);
    }
};

const getInvoiceOutDocument = async (req, res) => {
    try {
        const outDocument = await invoiceService.getInvoiceOutDocument(
            req.params.invNumber
        );
        return res.json(outDocument || {});
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to load invoice supporting document"
        });
    }
};

const getInvoiceOutDocumentAttachment = async (req, res) => {
    try {
        const attachment = await invoiceService.getInvoiceOutDocumentAttachment(
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
            message: error.message || "Failed to load invoice attachment"
        });
    }
};

const getInvoiceOutDocumentOptions = async (req, res) => {
    try {
        const options = await invoiceService.getInvoiceOutDocumentOptions();
        return res.json({
            success: true,
            data: options
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to load invoice supporting document options"
        });
    }
};

const saveInvoiceOutDocument = async (req, res) => {
    try {
        const outDocument = await invoiceService.saveInvoiceOutDocument(
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
            message: error.message || "Failed to save invoice supporting document"
        });
    }
};

const getOutboundTransactions = async (req, res) => {
    try {
        const transactions = await invoiceService.getOutboundTransactions(
            req.params.instanceIdentifier
        );
        return res.json(transactions);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const getOutboundTransactionXml = async (req, res) => {
    try {
        const xml = await invoiceService.getOutboundTransactionXml(
            req.params.transactionId,
            taxillaService.getCreatedBy(req.session, req.user)
        );
        return res.json({ xml });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const updateInvoices = async (req, res) => {
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

        const docType = req.body?.docType ?? req.query?.docType ?? null;
        const result = await syncSelectedInvoices(invoiceNumbers, docType);

        return res.json({
            success: true,
            message: `${result.processed} selected document(s) synced successfully`,
            ...result
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to sync selected invoices"
        });
    }
};

const syncTransactions = async (req, res) => {
    try {
        const result = await syncInvoices();

        return res.json({
            success: true,
            message: result?.skipped
                ? result.message
                : result?.message || "Sage Transaction Sync completed successfully",
            ...result
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to run Sage Transaction Sync"
        });
    }
};

module.exports = {
    getInvoicesXml,
    getSelectedInvoicesXml,
    getSingleInvoiceXml,
    sendSelectedInvoices,
    sendSingleInvoice,
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
    getOutboundTransactionXml,
    updateInvoices,
    syncTransactions
};
