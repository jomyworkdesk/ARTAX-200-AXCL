const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const settingsAdminController = require("../controllers/settingsAdminController");

router.get("/:resource", auth, settingsAdminController.list);
router.get("/:resource/:key", auth, settingsAdminController.get);
router.post("/:resource", auth, settingsAdminController.create);
router.put("/:resource/:key", auth, settingsAdminController.update);

module.exports = router;
