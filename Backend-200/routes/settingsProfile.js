const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const settingsProfileController = require("../controllers/settingsProfileController");

router.get("/", auth, settingsProfileController.getProfile);
router.put("/password", auth, settingsProfileController.changePassword);
router.put("/mail", auth, settingsProfileController.updateMail);

module.exports = router;
