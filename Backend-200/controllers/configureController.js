const configureService = require('../services/configureService');
const { asyncHandler } = require('../middleware/errorHandler');

const getMasters = asyncHandler(async (req, res) => {
    const data = await configureService.getMasters();
    res.json({ success: true, data });
});

const updateMaster = asyncHandler(async (req, res) => {
    const { type, isActive } = req.body;
    if (!type) {
        return res.status(400).json({ success: false, message: 'Type is required' });
    }
    const data = await configureService.updateMaster(type, isActive);
    res.json({ success: true, data });
});

const getAutoSend = asyncHandler(async (req, res) => {
    const data = await configureService.getAutoSend();
    res.json({ success: true, data });
});

const updateAutoSend = asyncHandler(async (req, res) => {
    const autosend = req.body?.autosend ?? req.body?.autoSendOn;
    if (autosend === undefined || autosend === null || autosend === '') {
        return res.status(400).json({ success: false, message: 'autosend is required' });
    }
    const normalized = Number(autosend);
    const isBooleanValue = autosend === true || autosend === false || String(autosend).toLowerCase() === 'true' || String(autosend).toLowerCase() === 'false';
    if (!isBooleanValue && normalized !== 1 && normalized !== 2) {
        return res.status(400).json({ success: false, message: 'autosend must be 1 or 2' });
    }

    const data = await configureService.updateAutoSend(autosend);
    res.json({ success: true, data });
});

const getSendValidation = asyncHandler(async (req, res) => {
    const data = await configureService.getSendValidationStatus();
    return res.status(data.canSend ? 200 : 403).json({
        success: data.canSend,
        message: data.message,
        data
    });
});

const getSellerDetails = asyncHandler(async (req, res) => {
    const data = await configureService.getSellerDetails();
    res.json({ success: true, data });
});

const saveSellerDetails = asyncHandler(async (req, res) => {
    const name = req.body?.sellerName || req.body?.name;

    if (!name || !String(name).trim()) {
        return res.status(400).json({ success: false, message: 'Seller name is required' });
    }

    const data = await configureService.saveSellerDetails(req.body);
    res.json({ success: true, data });
});

const getStateMapping = asyncHandler(async (req, res) => {
    const data = await configureService.getStateMapping();
    res.json({ success: true, data });
});

const updateStateMapping = asyncHandler(async (req, res) => {
    const { mappings } = req.body;
    if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ success: false, message: 'Mappings array is required' });
    }
    const data = await configureService.updateStateMapping(mappings);
    res.json({ success: true, data });
});

const getCountryMapping = asyncHandler(async (req, res) => {
    const data = await configureService.getCountryMapping();
    res.json({ success: true, data });
});

const updateCountryMapping = asyncHandler(async (req, res) => {
    const { mappings } = req.body;
    if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ success: false, message: 'Mappings array is required' });
    }
    const data = await configureService.updateCountryMapping(mappings);
    res.json({ success: true, data });
});

const getPaymentMapping = asyncHandler(async (req, res) => {
    const data = await configureService.getPaymentMapping();
    res.json({ success: true, data });
});

const updatePaymentMapping = asyncHandler(async (req, res) => {
    const { mappings } = req.body;
    if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ success: false, message: 'Mappings array is required' });
    }
    const data = await configureService.updatePaymentMapping(mappings);
    res.json({ success: true, data });
});

const getInvoiceTypeMapping = asyncHandler(async (req, res) => {
    const data = await configureService.getInvoiceTypeMapping();
    res.json({ success: true, data });
});

const updateInvoiceTypeMapping = asyncHandler(async (req, res) => {
    const { mappings } = req.body;
    await configureService.updateInvoiceTypeMapping(mappings);
    res.json({ success: true, message: 'Invoice Type mappings updated' });
});

const getElectronicAddressSchemeMapping = asyncHandler(async (req, res) => {
    const data = await configureService.getElectronicAddressSchemeMapping();
    res.json({ success: true, data });
});

const updateElectronicAddressSchemeMapping = asyncHandler(async (req, res) => {
    const { mappings } = req.body;
    if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ success: false, message: 'Mappings array is required' });
    }
    const data = await configureService.updateElectronicAddressSchemeMapping(mappings);
    res.json({ success: true, data });
});

const getObjectIdentifierMapping = asyncHandler(async (req, res) => {
    const data = await configureService.getObjectIdentifierMapping();
    res.json({ success: true, data });
});

const updateObjectIdentifierMapping = asyncHandler(async (req, res) => {
    const { mappings } = req.body;
    if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ success: false, message: 'Mappings array is required' });
    }
    const data = await configureService.updateObjectIdentifierMapping(mappings);
    res.json({ success: true, data });
});

const getInvoiceTransactionMapping = asyncHandler(async (req, res) => {
    const data = await configureService.getInvoiceTransactionMapping();
    res.json({ success: true, data });
});

const updateInvoiceTransactionMapping = asyncHandler(async (req, res) => {
    const { mappings } = req.body;
    if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ success: false, message: 'Mappings array is required' });
    }
    const data = await configureService.updateInvoiceTransactionMapping(mappings);
    res.json({ success: true, data });
});

const getCreditNoteReasonMapping = asyncHandler(async (req, res) => {
    const data = await configureService.getCreditNoteReasonMapping();
    res.json({ success: true, data });
});

const updateCreditNoteReasonMapping = asyncHandler(async (req, res) => {
    const { mappings } = req.body;
    if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ success: false, message: 'Mappings array is required' });
    }
    const data = await configureService.updateCreditNoteReasonMapping(mappings);
    res.json({ success: true, data });
});

const getChargesMapping = asyncHandler(async (req, res) => {
    const data = await configureService.getChargesMapping();
    res.json({ success: true, data });
});

const updateChargesMapping = asyncHandler(async (req, res) => {
    const { mappings } = req.body;
    if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ success: false, message: 'Mappings array is required' });
    }
    const data = await configureService.updateChargesMapping(mappings);
    res.json({ success: true, data });
});

const getTddScopeMapping = asyncHandler(async (req, res) => {
    const data = await configureService.getTddScopeMapping();
    res.json({ success: true, data });
});

const updateTddScopeMapping = asyncHandler(async (req, res) => {
    const { mappings } = req.body;
    if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ success: false, message: 'Mappings array is required' });
    }
    const data = await configureService.updateTddScopeMapping(mappings);
    res.json({ success: true, data });
});

const getRcmTypeMapping = asyncHandler(async (req, res) => {
    const data = await configureService.getRcmTypeMapping();
    res.json({ success: true, data });
});

const updateRcmTypeMapping = asyncHandler(async (req, res) => {
    const { mappings } = req.body;
    if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ success: false, message: 'Mappings array is required' });
    }
    const data = await configureService.updateRcmTypeMapping(mappings);
    res.json({ success: true, data });
});

const getExemptReasonMapping = asyncHandler(async (req, res) => {
    const data = await configureService.getExemptReasonMapping();
    res.json({ success: true, data });
});

const updateExemptReasonMapping = asyncHandler(async (req, res) => {
    const { mappings } = req.body;
    if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ success: false, message: 'Mappings array is required' });
    }
    const data = await configureService.updateExemptReasonMapping(mappings);
    res.json({ success: true, data });
});

const getUnitMapping = asyncHandler(async (req, res) => {
    const data = await configureService.getUnitMapping();
    res.json({ success: true, data });
});

const updateUnitMapping = asyncHandler(async (req, res) => {
    const { mappings } = req.body;
    if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ success: false, message: 'Mappings array is required' });
    }
    const data = await configureService.updateUnitMapping(mappings);
    res.json({ success: true, data });
});

const getCurrencyMapping = asyncHandler(async (req, res) => {
    const data = await configureService.getCurrencyMapping();
    res.json({ success: true, data });
});

const updateCurrencyMapping = asyncHandler(async (req, res) => {
    const { mappings } = req.body;
    if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ success: false, message: 'Mappings array is required' });
    }
    const data = await configureService.updateCurrencyMapping(mappings);
    res.json({ success: true, data });
});

const getVatMapping = asyncHandler(async (req, res) => {
    const data = await configureService.getVatMapping();
    res.json({ success: true, data });
});

const updateVatMapping = asyncHandler(async (req, res) => {
    const { mappings } = req.body;
    if (!mappings || !Array.isArray(mappings)) {
        return res.status(400).json({ success: false, message: 'Mappings array is required' });
    }
    const data = await configureService.updateVatMapping(mappings);
    res.json({ success: true, data });
});

const createSeller = saveSellerDetails;

const createBuyer = asyncHandler(async (req, res) => {
    const name = req.body?.buyerName || req.body?.name;
    if (!name || !String(name).trim()) {
        return res.status(400).json({ success: false, message: 'Buyer name is required' });
    }

    const data = await configureService.createBuyer(req.body);
    res.json({ success: true, data });
});

const getBuyers = asyncHandler(async (req, res) => {
    const data = await configureService.getBuyers();
    res.json({ success: true, data });
});

const getBuyer = asyncHandler(async (req, res) => {
    const data = await configureService.getBuyer(req.params.idCust);
    if (!data.buyer) {
        return res.status(404).json({ success: false, message: 'Buyer not found' });
    }
    res.json({ success: true, data });
});

module.exports = {
    getMasters,
    updateMaster,
    getAutoSend,
    updateAutoSend,
    getSendValidation,
    getSellerDetails,
    saveSellerDetails,
    getStateMapping,
    updateStateMapping,
    getCountryMapping,
    updateCountryMapping,
    getPaymentMapping,
    updatePaymentMapping,
    getInvoiceTypeMapping,
    updateInvoiceTypeMapping,
    getElectronicAddressSchemeMapping,
    updateElectronicAddressSchemeMapping,
    getObjectIdentifierMapping,
    updateObjectIdentifierMapping,
    getInvoiceTransactionMapping,
    updateInvoiceTransactionMapping,
    getCreditNoteReasonMapping,
    updateCreditNoteReasonMapping,
    getChargesMapping,
    updateChargesMapping,
    getTddScopeMapping,
    updateTddScopeMapping,
    getRcmTypeMapping,
    updateRcmTypeMapping,
    getExemptReasonMapping,
    updateExemptReasonMapping,
    getUnitMapping,
    updateUnitMapping,
    getVatMapping,
    updateVatMapping,
    getCurrencyMapping,
    updateCurrencyMapping,
    createSeller,
    createBuyer,
    getBuyers,
    getBuyer
};
