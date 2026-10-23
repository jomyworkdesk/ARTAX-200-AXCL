const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchaseController");
const auth = require("../middleware/auth");


router.get("/dashboard", purchaseController.getDashboard);
router.get("/getpurchases", purchaseController.getPurchases);
router.get("/recent-activity", purchaseController.getRecentActivity);
router.get("/export", purchaseController.exportPurchases);
router.get("/transactions/:instanceIdentifier", purchaseController.getPurchaseTransactions);
router.get("/transaction-xml/:transactionId", purchaseController.getPurchaseTransactionXml);
router.get("/details/:invNumber/in-document/attachment", purchaseController.getPurchaseInDocumentAttachment);
router.get("/details/:invNumber", purchaseController.getPurchaseDetails);


module.exports = router;
