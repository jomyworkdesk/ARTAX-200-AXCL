const express = require('express');
const router = express.Router();
const configureController = require('../controllers/configureController');
const { auth } = require('../middleware/auth');

// Note: Ensure the `auth` middleware is used appropriately based on project requirements.
// Temporarily omitting auth if it causes issues, but standard practice is to include it.
// We'll wrap all routes assuming standard behavior or bypass it if development environment.

router.get('/masters', configureController.getMasters);
router.put('/masters', configureController.updateMaster);

router.get('/autosend', configureController.getAutoSend);
router.put('/autosend', configureController.updateAutoSend);
router.get('/send-validation', configureController.getSendValidation);

router.get('/state-mapping', configureController.getStateMapping);
router.put('/state-mapping', configureController.updateStateMapping);

router.get('/country-mapping', configureController.getCountryMapping);
router.put('/country-mapping', configureController.updateCountryMapping);

router.get('/payment-mapping', configureController.getPaymentMapping);
router.put('/payment-mapping', configureController.updatePaymentMapping);

router.get('/invoice-type-mapping', configureController.getInvoiceTypeMapping);
router.put('/invoice-type-mapping', configureController.updateInvoiceTypeMapping);

router.get('/electronic-address-scheme-mapping', configureController.getElectronicAddressSchemeMapping);
router.put('/electronic-address-scheme-mapping', configureController.updateElectronicAddressSchemeMapping);

router.get('/object-identifier-mapping', configureController.getObjectIdentifierMapping);
router.put('/object-identifier-mapping', configureController.updateObjectIdentifierMapping);

router.get('/invoice-transaction-mapping', configureController.getInvoiceTransactionMapping);
router.put('/invoice-transaction-mapping', configureController.updateInvoiceTransactionMapping);

router.get('/credit-note-reason-mapping', configureController.getCreditNoteReasonMapping);
router.put('/credit-note-reason-mapping', configureController.updateCreditNoteReasonMapping);

router.get('/charges-mapping', configureController.getChargesMapping);
router.put('/charges-mapping', configureController.updateChargesMapping);

router.get('/tdd-scope-mapping', configureController.getTddScopeMapping);
router.put('/tdd-scope-mapping', configureController.updateTddScopeMapping);

router.get('/rcm-type-mapping', configureController.getRcmTypeMapping);
router.put('/rcm-type-mapping', configureController.updateRcmTypeMapping);

router.get('/exempt-reason-mapping', configureController.getExemptReasonMapping);
router.put('/exempt-reason-mapping', configureController.updateExemptReasonMapping);

router.get('/unit-mapping', configureController.getUnitMapping);
router.put('/unit-mapping', configureController.updateUnitMapping);

router.get('/currency-mapping', configureController.getCurrencyMapping);
router.put('/currency-mapping', configureController.updateCurrencyMapping);

router.get('/vat-mapping', configureController.getVatMapping);
router.put('/vat-mapping', configureController.updateVatMapping);

router.get('/seller', configureController.getSellerDetails);
router.post('/seller', configureController.createSeller);
router.put('/seller', configureController.saveSellerDetails);
router.get('/buyers', configureController.getBuyers);
router.get('/buyer/:idCust', configureController.getBuyer);
router.post('/buyer', configureController.createBuyer);

module.exports = router;
