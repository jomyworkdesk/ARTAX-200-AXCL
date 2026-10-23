const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoiceController");
const auth = require("../middleware/auth");

router.get("/invoices/xml", invoiceController.getInvoicesXml);
router.post("/invoices/xml/download", invoiceController.getSelectedInvoicesXml);
router.post("/invoices/send", auth, invoiceController.sendSelectedInvoices);
router.get("/dashboard", invoiceController.getDashboard);
router.get("/getinvoices", invoiceController.getInvoices);
router.get("/failed", invoiceController.getFailedInvoiceErrors);
router.get("/errors", invoiceController.getArtaxInvoiceErrors);

router.get("/failed/:invNumber/response-log", invoiceController.getInvoiceResponseLogs);
router.get("/errors/:invNumber/response-log", invoiceController.getArtaxErrorsResponse);

router.get("/invoice-details/out-document/options", invoiceController.getInvoiceOutDocumentOptions);
router.get("/invoice-details/:invNumber/out-document/attachment", invoiceController.getInvoiceOutDocumentAttachment);
router.get("/invoice-details/:invNumber/out-document", invoiceController.getInvoiceOutDocument);
router.post("/invoice-details/:invNumber/out-document", invoiceController.saveInvoiceOutDocument);
router.get("/invoice-details/:invNumber", invoiceController.getInvoiceDetails);
router.get("/transactions/:instanceIdentifier", invoiceController.getOutboundTransactions);
router.get("/transaction-xml/:transactionId", invoiceController.getOutboundTransactionXml);
router.get("/invoice-details/:invNumber/xml", invoiceController.getSingleInvoiceXml);
router.post("/invoice-details/:invNumber/send", auth, invoiceController.sendSingleInvoice);
router.post("/sync", invoiceController.syncTransactions);
router.post("/update", invoiceController.updateInvoices);


module.exports = router;
