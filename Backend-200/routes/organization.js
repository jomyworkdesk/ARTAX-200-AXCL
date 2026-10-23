const express = require("express");
const router = express.Router();
const organizationController = require("../controllers/organizationController");
const auth = require("../middleware/auth");

router.get("/", auth, organizationController.getOrganizations);
router.post("/", auth, organizationController.createOrganization);

module.exports = router;
