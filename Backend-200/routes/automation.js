const express = require("express");
const router = express.Router();
const automationController = require("../controllers/automationController");

router.get("/cron-settings", automationController.getCronSettings);
router.get("/cron-settings/:id", automationController.getCronSetting);
router.post("/cron-settings", automationController.createCronSetting);
router.put("/cron-settings/:id", automationController.updateCronSetting);
router.post("/cron-settings/:id/run", automationController.runManualCronSetting);

module.exports = router;
