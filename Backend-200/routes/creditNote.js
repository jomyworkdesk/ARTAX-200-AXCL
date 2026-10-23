const express = require("express");
const router = express.Router();
const creditNoteController = require("../controllers/creditNoteController");
const auth = require("../middleware/auth");

router.get("/xml", creditNoteController.getCreditNotesXml);
router.post("/xml/selected", creditNoteController.getSelectedCreditNotesXml);
router.get("/xml/:invNumber", creditNoteController.getSingleCreditNoteXml);
router.post("/send/selected", auth, creditNoteController.sendSelectedCreditNotes);
router.get("/dashboard", creditNoteController.getDashboard);
router.get("/getcreditnotes", creditNoteController.getCreditNotes);
router.get("/details/out-document/options", creditNoteController.getCreditNoteOutDocumentOptions);
router.get("/details/:invNumber/out-document/attachment", creditNoteController.getCreditNoteOutDocumentAttachment);
router.get("/details/:invNumber/out-document", creditNoteController.getCreditNoteOutDocument);
router.post("/details/:invNumber/out-document", creditNoteController.saveCreditNoteOutDocument);
router.get("/details/:invNumber", creditNoteController.getCreditNoteDetails);
router.get("/transactions/:instanceIdentifier", creditNoteController.getOutboundTransactions);
router.get("/transaction-xml/:transactionId", creditNoteController.getOutboundTransactionXml);
router.get("/details/:invNumber/xml", creditNoteController.getSingleCreditNoteXml);
router.post("/details/:invNumber/send", auth, creditNoteController.sendSingleCreditNote);

module.exports = router;
