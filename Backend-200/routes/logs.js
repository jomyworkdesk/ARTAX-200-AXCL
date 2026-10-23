const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const logController = require("../controllers/logController");

router.get("/responses", auth, logController.getResponseLogs);
router.get("/tokens", auth, logController.getTokenLogs);
router.get("/app", auth, logController.getAppLogs);
router.get("/app/:sessionId", auth, logController.getAppLogDetails);

module.exports = router;
