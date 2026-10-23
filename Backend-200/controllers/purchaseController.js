const purchaseService = require("../services/purchaseService");
const { getCreatedBy } = require("../services/taxillaService");

const getDashboard = async (req, res) => {
    try {
        const dashboard = await purchaseService.getDashboard(
            req.query.fromDate,
            req.query.toDate,
            req.query.invoiceTypeCode
        );
        return res.json(dashboard);
    } catch (error) {
        return res.status(500).send(error.message);
    }
};

const getPurchases = async (req, res) => {
    try {
        const purchases = await purchaseService.getPurchases(
            req.query.type,
            req.query.fromDate,
            req.query.toDate,
            req.query.invoiceTypeCode
        );
        return res.json(purchases);
    } catch (error) {
        return res.status(500).send(error.message);
    }
};

const getRecentActivity = async (req, res) => {
    try {
        const activity = await purchaseService.getRecentActivity(
            req.query.fromDate,
            req.query.toDate
        );
        return res.json(activity);
    } catch (error) {
        return res.status(500).send(error.message);
    }
};

const getPurchaseDetails = async (req, res) => {
    try {
        const purchaseDetails = await purchaseService.getPurchaseDetails(
            req.params.invNumber,
            req.query.invoiceTypeCode
        );
        return res.json(purchaseDetails);
    } catch (error) {
        return res.status(500).send(error.message);
    }
};

const getPurchaseTransactions = async (req, res) => {
    try {
        const transactions = await purchaseService.getPurchaseTransactions(
            req.params.instanceIdentifier
        );
        return res.json(transactions);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const getPurchaseInDocumentAttachment = async (req, res) => {
    try {
        const attachment = await purchaseService.getPurchaseInDocumentAttachment(
            req.params.invNumber,
            req.query.invoiceTypeCode
        );

        if (!attachment) {
            return res.status(404).json({
                success: false,
                message: "Attached document was not found"
            });
        }

        if (!attachment.filename) {
            return res.status(404).json({
                success: false,
                message: "Attached document filename was not found"
            });
        }

        const safeFilename = String(attachment.filename)
            .replace(/[\r\n"]/g, "");
        const disposition = req.query?.disposition === "inline"
            ? "inline"
            : "attachment";

        res.set("Content-Type", attachment.mimeCode || "application/octet-stream");
        res.set("Content-Disposition", `${disposition}; filename="${safeFilename}"`);
        return res.send(attachment.content);
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || "Failed to load purchase attachment"
        });
    }
};

const getPurchaseTransactionXml = async (req, res) => {
    try {
        const xml = await purchaseService.getPurchaseTransactionXml(
            req.params.transactionId,
            getCreatedBy(req.session, req.user)
        );
        return res.json({ xml });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const exportPurchases = async (req, res) => {
    try {
        const excel = await purchaseService.exportPurchases(
            req.query.fromDate,
            req.query.toDate,
            req.query.search,
            req.query.invoiceTypeCode
        );

        const today = new Date().toISOString().slice(0, 10);
        res.set(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.set(
            "Content-Disposition",
            `attachment; filename="purchases-${today}.xlsx"`
        );
        return res.send(excel);
    } catch (error) {
        return res.status(500).send(error.message);
    }
};

module.exports = {
    getDashboard,
    getPurchases,
    getRecentActivity,
    getPurchaseDetails,
    getPurchaseTransactions,
    getPurchaseInDocumentAttachment,
    getPurchaseTransactionXml,
    exportPurchases
};
