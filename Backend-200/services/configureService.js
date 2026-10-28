const configureRepo = require('../repositories/configureRepository');

const joinLabelParts = (...parts) => parts
    .filter(part => part !== null && part !== undefined && `${part}`.trim() !== '')
    .join('-');

const splitLookupOptions = (lookupRows = []) => (lookupRows || [])
    .map((row) => row?.cLookupOptions || '')
    .join(';')
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean);

const getMasters = async () => {
    const stateMaster = await configureRepo.getMasterToggle('State Master');
    const countryMaster = await configureRepo.getMasterToggle('Country Master');
    const paymentMaster = await configureRepo.getMasterToggle('Payment Master');
    const generalLedgerMaster = await configureRepo.getMasterToggle('General Ledger Type Master');
    const accountReceivableMaster = await configureRepo.getMasterToggle('Account Receivable Type Master');
    const accountPayableMaster = await configureRepo.getMasterToggle('Account Payable Type Master');
    const otherInvoiceTypeMaster = await configureRepo.getMasterToggle('Other Invoice Type Master');
    const invoiceTransactionMaster = await configureRepo.getMasterToggle('Invoice Transaction Master');
    const currencyMaster = await configureRepo.getMasterToggle('Currency Master');
    const unitMaster = await configureRepo.getMasterToggle('Unit Master');
    const vatMaster = await configureRepo.getMasterToggle('Vat Master');
    const creditNoteReasonMaster = await configureRepo.getMasterToggle('Credit Note Reason Master');
    const electronicAddressSchemeMaster = await configureRepo.getMasterToggle('Electronic Address Scheme Master');
    const objectIdentifierMaster = await configureRepo.getMasterToggle('Object Identifier Master');
    const rcmTypeMaster = await configureRepo.getMasterToggle('Rcm Type Master');
    const exemptReasonMaster = await configureRepo.getMasterToggle('Exempt Reason Master');
    const chargesMaster = await configureRepo.getMasterToggle('Charges Master');
    const tddScopeMaster = await configureRepo.getMasterToggle('TDD Scope Master');

    return {
        stateMaster: stateMaster?.IsActive || false,
        countryMaster: countryMaster?.IsActive || false,
        paymentMaster: paymentMaster?.IsActive || false,
        generalLedgerMaster: generalLedgerMaster?.IsActive || false,
        accountReceivableMaster: accountReceivableMaster?.IsActive || false,
        accountPayableMaster: accountPayableMaster?.IsActive || false,
        otherInvoiceTypeMaster: otherInvoiceTypeMaster?.IsActive || false,
        invoiceTransactionMaster: invoiceTransactionMaster?.IsActive || false,
        currencyMaster: currencyMaster?.IsActive || false,
        unitMaster: unitMaster?.IsActive || false,
        vatMaster: vatMaster?.IsActive || false,
        creditNoteReasonMaster: creditNoteReasonMaster?.IsActive || false,
        electronicAddressSchemeMaster: electronicAddressSchemeMaster?.IsActive || false,
        objectIdentifierMaster: objectIdentifierMaster?.IsActive || false,
        rcmTypeMaster: rcmTypeMaster?.IsActive || false,
        exemptReasonMaster: exemptReasonMaster?.IsActive || false,
        chargesMaster: chargesMaster?.IsActive || false,
        tddScopeMaster: tddScopeMaster?.IsActive || false
    };
};

const updateMaster = async (type, isActive) => {
    return await configureRepo.updateMasterToggle(type, isActive);
};

const normalizeAutoSendValue = (value) => {
    const numericValue = Number(value);
    if (numericValue === 1 || numericValue === 2) return numericValue;

    if (value === true || String(value).toLowerCase() === 'true') return 1;
    if (value === false || String(value).toLowerCase() === 'false') return 2;

    throw new Error('Autosend must be 1 or 2');
};

const getAutoSend = async () => {
    const config = await configureRepo.getAutoSendConfig();
    const autosend = normalizeAutoSendValue(config?.autosend ?? 2);

    return {
        autosend,
        autoSendOn: autosend === 1
    };
};

const updateAutoSend = async (value) => {
    const autosend = normalizeAutoSendValue(value);
    const config = await configureRepo.updateAutoSendConfig(autosend);
    const savedValue = normalizeAutoSendValue(config?.autosend ?? autosend);

    return {
        autosend: savedValue,
        autoSendOn: savedValue === 1
    };
};

const sendValidationMessages = {
    A12: "ARTAX Subscription Expired – Please renew your subscription to continue using ARTAX.",
    D12: "ARTAX Document Limit Exceeded – Please upgrade your plan to continue."
};

const getSendValidationStatus = async () => {
    const config = await configureRepo.getSendValidationConfig();
    const ref = String(config?.Ref || "").trim().toUpperCase();

    if (ref === "J12") {
        return {
            canSend: true,
            message: "Allowed"
        };
    }

    return {
        canSend: false,
        message: sendValidationMessages[ref] || "Sending is not allowed"
    };
};

const ensureCanSend = async () => {
    const status = await getSendValidationStatus();
    if (!status.canSend) {
        const error = new Error(status.message);
        error.statusCode = 403;
        error.name = "SendValidationError";
        throw error;
    }

    return status;
};

const cleanText = (value) => value?.trim?.() || "";
const cleanNullableText = (value) => {
    const text = value?.trim?.() || "";
    return text || null;
};
const cleanNullableValue = (value) => {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    return value;
};

const legalRegistrationTypeValues = {
    TL: "Commercial/Trade license",
    EID: "Emirates ID",
    PAS: "Passport",
    CD: "Cabinet Decision"
};

const getLegalRegistrationTypeDisplayValue = (row = {}) => {
    const text = `${row.DisplayName || ""} ${row.Value || ""}`.toLowerCase();

    if (text.includes("trade") || text.includes("license") || text.includes("tl")) return "TL";
    if (text.includes("emirates") || text.includes("eid")) return "EID";
    if (text.includes("passport") || text.includes("pas")) return "PAS";
    if (text.includes("cabinet") || text.includes("decision") || text.includes("cd")) return "CD";

    return row.DisplayName || row.Value;
};

const mapLegalRegistrationTypeOptions = (rows = []) =>
    rows.map((row) => {
        const displayValue = getLegalRegistrationTypeDisplayValue(row);

        return {
            value: displayValue,
            label: legalRegistrationTypeValues[displayValue] || row.DisplayName || row.Value
        };
    });

const mapSellerOptions = (options = {}) =>
    Object.fromEntries(
        Object.entries(options).map(([key, rows]) => [
            key,
            key === "legalRegistrationTypes"
                ? mapLegalRegistrationTypeOptions(rows)
                : rows.map((row) => ({
                    value: row.Value,
                    label: row.DisplayName
                }))
        ])
    );

const mapSellerRow = (row, extra = {}) => ({
    orgId: row?.idEntities ?? extra?.idEntities ?? null,
    sellerName: row?.Name || "",
    tradingName: extra?.LEGALNAME || "",
    addressLine1: row?.PhAddress1 || "",
    addressLine2: row?.PhAddress2 || "",
    addressLine3: row?.PhAddress3 || "",
    city: extra?.CITY || "",
    postCode: row?.PhPostalCode || "",
    contactNumber: row?.Telephone1 || "",
    contactPoint: row?.ContactPerson || "",
    contactEmail: row?.StrSpare1 || "",
    vatIdentifier: extra?.TAXNBR || "",
    electronicAddress: extra?.ElectronicAddress || "",
    electronicSchemeIdentifier: extra?.ElectronicSchemeID ?? null,
    sellerIdentifier: extra?.SellerIdentifier || "",
    schemeIdentifier: extra?.SchemeID ?? null,
    legalRegistrationIdentifier: extra?.LegalRegistrationID || "",
    legalSchemeIdentifier: extra?.LegalSchemeID ?? null,
    vatSchemeCode: extra?.VATSchemeCode || "",
    countrySubdivision: extra?.CountrySubdivision ?? null,
    countryCode: extra?.CountryCode ?? null,
    legalRegistrationType: extra?.LegalRegistrationType ?? null,
    commercialTradeLicense: extra?.TradeLicense || "",
    emiratesId: extra?.EmiratesID || "",
    passport: extra?.PassportNo || "",
    cabinetDecision: extra?.CabinetDecision || "",
    authorityName: extra?.AuthorityName || "",
    passportIssuingCountryCode: extra?.PassportIssuingCountry ?? null
});

const getSellerDetails = async () => {
    const seller = await configureRepo.getSellerDetails();
    const extra = seller
        ? await configureRepo.getSellerExtraDetailsByEntityId(seller.idEntities)
        : null;
    const options = await configureRepo.getSellerDropdownOptions();

    return {
        seller: seller ? mapSellerRow(seller, extra) : null,
        options: mapSellerOptions(options)
    };
};

const saveSellerDetails = async (payload) => {
    const requestedIdEntities = payload?.orgId ?? payload?.idEntities;

    const sellerEntity = await configureRepo.saveSellerEntityDetails({
        idEntities: requestedIdEntities,
        name: cleanText(payload?.sellerName || payload?.name),
        addressLine1: cleanText(payload?.addressLine1),
        addressLine2: cleanText(payload?.addressLine2),
        addressLine3: cleanText(payload?.addressLine3),
        postalCode: cleanText(payload?.postCode),
        telephone: cleanText(payload?.contactNumber || payload?.phone),
        contactPerson: cleanText(payload?.contactPoint),
        contactEmail: cleanNullableText(payload?.contactEmail)
    });
    const idEntities = sellerEntity?.idEntities ?? requestedIdEntities;

    const extra = await configureRepo.upsertSellerExtraDetails({
        idEntities,
        city: cleanText(payload?.city),
        taxNbr: cleanText(payload?.vatIdentifier || payload?.vatId),
        legalName: cleanText(payload?.tradingName),
        electronicAddress: cleanNullableText(payload?.electronicAddress),
        electronicSchemeIdentifier: cleanNullableValue(payload?.electronicSchemeIdentifier),
        sellerIdentifier: cleanNullableText(payload?.sellerIdentifier),
        schemeIdentifier: cleanNullableValue(payload?.schemeIdentifier),
        legalRegistrationIdentifier: cleanNullableText(payload?.legalRegistrationIdentifier || payload?.registrationId),
        legalSchemeIdentifier: cleanNullableValue(payload?.legalSchemeIdentifier),
        vatSchemeCode: cleanNullableText(payload?.vatSchemeCode),
        countrySubdivision: cleanNullableValue(payload?.countrySubdivision),
        countryCode: cleanNullableValue(payload?.countryCode),
        legalRegistrationType: cleanNullableValue(payload?.legalRegistrationType),
        commercialTradeLicense: cleanNullableText(payload?.commercialTradeLicense),
        emiratesId: cleanNullableText(payload?.emiratesId),
        passport: cleanNullableText(payload?.passport),
        cabinetDecision: cleanNullableText(payload?.cabinetDecision),
        authorityName: cleanNullableText(payload?.authorityName),
        passportIssuingCountryCode: cleanNullableValue(payload?.passportIssuingCountryCode)
    });
    const options = await configureRepo.getSellerDropdownOptions();

    return {
        seller: sellerEntity ? mapSellerRow(sellerEntity, extra) : null,
        options: mapSellerOptions(options)
    };
};

const getStateMapping = async () => {
    const lookupRows = await configureRepo.getCountrySubdivisionLookup();
    const emStates = await configureRepo.getEMStates();
    const states = splitLookupOptions(lookupRows);

    const tableData = states.map((state, index) => {
        const mapping = emStates.find(em => em.Mapping == state);
        return {
            slNo: index + 1,
            id: state,
            description: state,
            status: mapping ? true : false,
            mappedTo: mapping ? mapping.AutoIndex : null,
            mappedDisplayName: mapping ? mapping.DisplayName : null
        };
    });

    const unmappedDropdownOptions = emStates
        .filter(em => (!em.Mapping || em.Mapping === '') && em.AutoIndex !== 0)
        .map(em => ({
            AutoIndex: em.AutoIndex,
            DisplayName: em.DisplayName
        }));

    return {
        tableData,
        dropdownOptions: unmappedDropdownOptions,
        allEMStates: emStates
    };
};

const updateStateMapping = async (mappings) => {
    return await configureRepo.updateEMStateMapping(mappings);
};

const getUnitMapping = async () => {
    const units = await configureRepo.getUnits();
    const emUnits = await configureRepo.getEMUnits();

    const tableData = units.map(unit => {
        const mapping = emUnits.find(em => em.Mapped === unit.idUnits);
        return {
            slNo: unit.idUnits,
            id: unit.idUnits,
            description: unit.cUnitDescription,
            status: mapping ? true : false,
            mappedTo: mapping ? mapping.AutoIndex : null,
            mappedDisplayName: mapping ? mapping.DisplayName : null
        };
    });

    const unmappedDropdownOptions = emUnits
        .filter(em => (!em.Mapped || em.Mapped === 0) && em.AutoIndex !== 0)
        .map(em => ({
            AutoIndex: em.AutoIndex,
            DisplayName: em.DisplayName
        }));

    return {
        tableData,
        dropdownOptions: unmappedDropdownOptions,
        allEMUnits: emUnits
    };
};

const updateUnitMapping = async (mappings) => {
    return await configureRepo.updateEMUnitMapping(mappings);
};

const getCurrencyMapping = async () => {
    const currencies = await configureRepo.getCurrencies();
    const emCurrencies = await configureRepo.getEMCurrencyCodes();

    const tableData = currencies.map(currency => {
        const mapping = emCurrencies.find(em => em.Mapped === currency.CurrencyLink);
        return {
            slNo: currency.CurrencyLink,
            id: currency.CurrencyLink,
            description: currency.Description,
            status: mapping ? true : false,
            mappedTo: mapping ? mapping.AutoIndex : null,
            mappedDisplayName: mapping ? mapping.DisplayName : null
        };
    });

    const unmappedDropdownOptions = emCurrencies
        .filter(em => (!em.Mapped || em.Mapped === 0) && em.AutoIndex !== 0)
        .map(em => ({
            AutoIndex: em.AutoIndex,
            DisplayName: em.DisplayName
        }));

    return {
        tableData,
        dropdownOptions: unmappedDropdownOptions,
        allEMCurrencies: emCurrencies
    };
};

const updateCurrencyMapping = async (mappings) => {
    return await configureRepo.updateEMCurrencyMapping(mappings);
};

const getCountryMapping = async () => {
    const lookupRows = await configureRepo.getCountryCodeLookup();
    const emCountries = await configureRepo.getEMCountryCodes();
    const countries = splitLookupOptions(lookupRows);

    const tableData = countries.map((country, index) => {
        const mapping = emCountries.find(em => em.Mapped == country);
        return {
            slNo: index + 1,
            id: country,
            description: country,
            status: mapping ? true : false,
            mappedTo: mapping ? mapping.AutoIndex : null,
            mappedDisplayName: mapping ? mapping.DisplayName : null
        };
    });

    const unmappedDropdownOptions = emCountries
        .filter(em => (!em.Mapped || em.Mapped === '') && em.AutoIndex !== 0)
        .map(em => ({
            AutoIndex: em.AutoIndex,
            DisplayName: em.DisplayName
        }));

    return {
        tableData,
        dropdownOptions: unmappedDropdownOptions,
        allEMCountries: emCountries
    };
};

const updateCountryMapping = async (mappings) => {
    return await configureRepo.updateEMCountryMapping(mappings);
};

const getPaymentMapping = async () => {
    const lookupRows = await configureRepo.getPaymentTypes();
    const emPaymentTypes = await configureRepo.getEMPaymentTypeCodes();
    const paymentTypes = splitLookupOptions(lookupRows);

    const tableData = paymentTypes.map((payment, index) => {
        const mapping = emPaymentTypes.find(em => em.Mapped === payment);
        return {
            slNo: index + 1,
            id: payment,
            description: payment,
            status: mapping ? true : false,
            mappedTo: mapping ? mapping.AutoIndex : null,
            mappedDisplayName: mapping ? mapping.DisplayName : null
        };
    });

    const unmappedDropdownOptions = emPaymentTypes
        .filter(em => (!em.Mapped || em.Mapped === '') && em.AutoIndex !== 0)
        .map(em => ({
            AutoIndex: em.AutoIndex,
            DisplayName: em.DisplayName
        }));

    return {
        tableData,
        dropdownOptions: unmappedDropdownOptions,
        allEMPaymentTypes: emPaymentTypes
    };
};

const updatePaymentMapping = async (mappings) => {
    return await configureRepo.updateEMPaymentMapping(mappings);
};

const getInvoiceTypeMapping = async () => {
    const lookupRows = await configureRepo.getInvoiceTypeLookup();
    const emInvoiceTypes = await configureRepo.getEMInvoiceTypeCodes();

    const lookupOptions = (lookupRows || [])
        .map((row) => row?.cLookupOptions || '')
        .join(';');

    const invoiceTypes = lookupOptions
        .split(';')
        .map((value) => value.trim())
        .filter(Boolean);


    const tableData = invoiceTypes.map((invoiceType, index) => {
        const mapping = emInvoiceTypes.find((em) => em.Mapping == invoiceType);
        return {
            slNo: index + 1,
            id: invoiceType,
            description: invoiceType,
            iModule: null,
            status: mapping ? true : false,
            mappedTo: mapping ? mapping.AutoIndex : null,
            mappedDisplayName: mapping ? mapping.DisplayName : null
        };
    });

    const unmappedDropdownOptions = emInvoiceTypes
        .filter((em) => !em.Mapping && em.AutoIndex !== 0)
        .map((em) => ({
            AutoIndex: em.AutoIndex,
            DisplayName: em.DisplayName
        }));

    return {
        tableData,
        dropdownOptions: unmappedDropdownOptions,
        allEMInvoiceTypes: emInvoiceTypes
    };
};


const updateInvoiceTypeMapping = async (mappings) => {
    return await configureRepo.updateEMInvoiceTypeMapping(mappings);
};

const getElectronicAddressSchemeMapping = async () => {
    const lookupRows = await configureRepo.getSchemeIdentifierLookup();
    const emElectronicAddressSchemes = await configureRepo.getEMElectronicAddressSchemes();
    const lookupOptions = lookupRows[0]?.cLookupOptions || '';
    const schemeIdentifiers = lookupOptions
        .split(';')
        .map(value => value.trim())
        .filter(Boolean);

    const tableData = schemeIdentifiers.map((schemeIdentifier, index) => {
        const mapping = emElectronicAddressSchemes.find(em => em.Mapped == schemeIdentifier);
        return {
            slNo: index + 1,
            id: schemeIdentifier,
            description: schemeIdentifier,
            status: mapping ? true : false,
            mappedTo: mapping ? mapping.AutoIndex : null,
            mappedDisplayName: mapping ? mapping.DisplayName : null
        };
    });

    const unmappedDropdownOptions = emElectronicAddressSchemes
        .filter(em => (!em.Mapped || em.Mapped === '') && em.AutoIndex !== 0)
        .map(em => ({
            AutoIndex: em.AutoIndex,
            DisplayName: em.DisplayName
        }));

    return {
        tableData,
        dropdownOptions: unmappedDropdownOptions,
        allEMElectronicAddressSchemes: emElectronicAddressSchemes
    };
};

const updateElectronicAddressSchemeMapping = async (mappings) => {
    return await configureRepo.updateEMElectronicAddressSchemeMapping(mappings);
};

const getObjectIdentifierMapping = async () => {
    const lookupRows = await configureRepo.getStandardSchemeLookup();
    const emObjectIdentifiers = await configureRepo.getEMObjectIdentifiers();
    const lookupOptions = lookupRows[0]?.cLookupOptions || '';
    const standardSchemes = lookupOptions
        .split(';')
        .map(value => value.trim())
        .filter(Boolean);

    const tableData = standardSchemes.map((standardScheme, index) => {
        const mapping = emObjectIdentifiers.find(em => em.Mapped == standardScheme);
        return {
            slNo: index + 1,
            id: standardScheme,
            description: standardScheme,
            status: mapping ? true : false,
            mappedTo: mapping ? mapping.AutoIndex : null,
            mappedDisplayName: mapping ? mapping.DisplayName : null
        };
    });

    const unmappedDropdownOptions = emObjectIdentifiers
        .filter(em => (!em.Mapped || em.Mapped === '') && em.AutoIndex !== 0)
        .map(em => ({
            AutoIndex: em.AutoIndex,
            DisplayName: em.DisplayName
        }));

    return {
        tableData,
        dropdownOptions: unmappedDropdownOptions,
        allEMObjectIdentifiers: emObjectIdentifiers
    };
};

const updateObjectIdentifierMapping = async (mappings) => {
    return await configureRepo.updateEMObjectIdentifierMapping(mappings);
};

const getInvoiceTransactionMapping = async () => {
    const lookupRows = await configureRepo.getInvoiceTransactionTypeLookup();
    const emInvoiceTransactionTypes = await configureRepo.getEMInvoiceTransactionTypeCodes();
    const lookupOptions = lookupRows[0]?.cLookupOptions || '';
    const invoiceTransactionTypes = lookupOptions
        .split(';')
        .map(value => value.trim())
        .filter(Boolean);

    const tableData = invoiceTransactionTypes.map((transaction, index) => {
        const mapping = emInvoiceTransactionTypes.find(em => em.Mapped === transaction);
        return {
            slNo: index + 1,
            id: transaction,
            description: transaction,
            status: mapping ? true : false,
            mappedTo: mapping ? mapping.AutoIndex : null,
            mappedDisplayName: mapping ? mapping.DisplayName : null
        };
    });

    const unmappedDropdownOptions = emInvoiceTransactionTypes
        .filter(em => (!em.Mapped || em.Mapped === '') && em.AutoIndex !== 0)
        .map(em => ({
            AutoIndex: em.AutoIndex,
            DisplayName: em.DisplayName
        }));

    return {
        tableData,
        dropdownOptions: unmappedDropdownOptions,
        allEMInvoiceTransactionTypes: emInvoiceTransactionTypes
    };
};

const updateInvoiceTransactionMapping = async (mappings) => {
    return await configureRepo.updateEMInvoiceTransactionMapping(mappings);
};

const getCreditNoteReasonMapping = async () => {
    const lookupRows = await configureRepo.getCreditNoteReasonLookup();
    const emCreditNoteReasons = await configureRepo.getEMCreditNoteReasons();
    const lookupOptions = lookupRows[0]?.cLookupOptions || '';
    const creditNoteReasons = lookupOptions
        .split(';')
        .map(value => value.trim())
        .filter(Boolean);

    const tableData = creditNoteReasons.map((reason, index) => {
        const mapping = emCreditNoteReasons.find(em => em.Mapped === reason);
        return {
            slNo: index + 1,
            id: reason,
            description: reason,
            status: mapping ? true : false,
            mappedTo: mapping ? mapping.AutoIndex : null,
            mappedDisplayName: mapping ? mapping.DisplayName : null
        };
    });

    const unmappedDropdownOptions = emCreditNoteReasons
        .filter(em => (!em.Mapped || em.Mapped === '') && em.AutoIndex !== 0)
        .map(em => ({
            AutoIndex: em.AutoIndex,
            DisplayName: em.DisplayName
        }));

    return {
        tableData,
        dropdownOptions: unmappedDropdownOptions,
        allEMCreditNoteReasons: emCreditNoteReasons
    };
};

const updateCreditNoteReasonMapping = async (mappings) => {
    return await configureRepo.updateEMCreditNoteReasonMapping(mappings);
};

const getChargesMapping = async () => {
    const lookupRows = await configureRepo.getChargesReasonLookup();
    const emChargeCodes = await configureRepo.getEMChargeCodes();
    const chargeReasons = splitLookupOptions(lookupRows);

    const tableData = chargeReasons.map((reason, index) => {
        const mapping = emChargeCodes.find(em => em.Mapped === reason);
        return {
            slNo: index + 1,
            id: reason,
            description: reason,
            status: mapping ? true : false,
            mappedTo: mapping ? mapping.AutoIndex : null,
            mappedDisplayName: mapping ? mapping.DisplayName : null
        };
    });

    const unmappedDropdownOptions = emChargeCodes
        .filter(em => (!em.Mapped || em.Mapped === '') && em.AutoIndex !== 0)
        .map(em => ({
            AutoIndex: em.AutoIndex,
            DisplayName: em.DisplayName
        }));

    return {
        tableData,
        dropdownOptions: unmappedDropdownOptions,
        allEMChargeCodes: emChargeCodes
    };
};

const updateChargesMapping = async (mappings) => {
    return await configureRepo.updateEMChargeCodeMapping(mappings);
};

const getTddScopeMapping = async () => {
    const lookupRows = await configureRepo.getTddScopeLookup();
    const emTddScopes = await configureRepo.getEMTddScopes();
    const tddScopes = splitLookupOptions(lookupRows);

    const tableData = tddScopes.map((scope, index) => {
        const mapping = emTddScopes.find(em => em.Mapped === scope);
        return {
            slNo: index + 1,
            id: scope,
            description: scope,
            status: mapping ? true : false,
            mappedTo: mapping ? mapping.AutoIndex : null,
            mappedDisplayName: mapping ? mapping.DisplayName : null
        };
    });

    const unmappedDropdownOptions = emTddScopes
        .filter(em => (!em.Mapped || em.Mapped === '') && em.AutoIndex !== 0)
        .map(em => ({
            AutoIndex: em.AutoIndex,
            DisplayName: em.DisplayName
        }));

    return {
        tableData,
        dropdownOptions: unmappedDropdownOptions,
        allEMTddScopes: emTddScopes
    };
};

const updateTddScopeMapping = async (mappings) => {
    return await configureRepo.updateEMTddScopeMapping(mappings);
};

const getRcmTypeMapping = async () => {
    const lookupRows = await configureRepo.getRcmTypeLookup();
    const emGoodsServiceTypes = await configureRepo.getEMGoodsServiceTypes();
    const rcmTypes = splitLookupOptions(lookupRows);

    const tableData = rcmTypes.map((rcmType, index) => {
        const mapping = emGoodsServiceTypes.find(em => em.Mapped === rcmType);
        return {
            slNo: index + 1,
            id: rcmType,
            description: rcmType,
            status: mapping ? true : false,
            mappedTo: mapping ? mapping.AutoIndex : null,
            mappedDisplayName: mapping ? mapping.DisplayName : null
        };
    });

    const unmappedDropdownOptions = emGoodsServiceTypes
        .filter(em => (!em.Mapped || em.Mapped === '') && em.AutoIndex !== 0)
        .map(em => ({
            AutoIndex: em.AutoIndex,
            DisplayName: em.DisplayName
        }));

    return {
        tableData,
        dropdownOptions: unmappedDropdownOptions,
        allEMGoodsServiceTypes: emGoodsServiceTypes
    };
};

const updateRcmTypeMapping = async (mappings) => {
    return await configureRepo.updateEMGoodsServiceTypeMapping(mappings);
};

// --------------

const getExemptReasonMapping = async () => {
    const lookupRows = await configureRepo.getExemptReasonLookup();
    const emVATExemptionReasons = await configureRepo.getEMVATExemptionReasons();
    const exemptReasons = splitLookupOptions(lookupRows);

    const tableData = exemptReasons.map((exemptReason, index) => {
        const mapping = emVATExemptionReasons.find(em => em.Mapped === exemptReason);
        return {
            slNo: index + 1,
            id: exemptReason,
            description: exemptReason,
            status: mapping ? true : false,
            mappedTo: mapping ? mapping.AutoIndex : null,
            mappedDisplayName: mapping ? mapping.DisplayName : null
        };
    });

    const unmappedDropdownOptions = emVATExemptionReasons
        .filter(em => (!em.Mapped || em.Mapped === '') && em.AutoIndex !== 0)
        .map(em => ({
            AutoIndex: em.AutoIndex,
            DisplayName: em.DisplayName
        }));

    return {
        tableData,
        dropdownOptions: unmappedDropdownOptions,
        allEMVATExemptionReasons: emVATExemptionReasons
    };
};

const updateExemptReasonMapping = async (mappings) => {
    return await configureRepo.updateEMVATExemptionReasonMapping(mappings);
};


const getVatMapping = async () => {
    const vat = await configureRepo.getVat();
    const emVat = await configureRepo.getEMVat();

    const tableData = vat.map(v => {
        const mapping = emVat.find(em => em.Mapped === v.idTaxRate);
        return {
            slNo: v.idTaxRate,
            id: v.idTaxRate,
            description: joinLabelParts(v.Description, v.TaxRate),
            status: mapping ? true : false,
            mappedTo: mapping ? mapping.AutoIndex : null,
            mappedDisplayName: mapping ? joinLabelParts(mapping.DisplayName, mapping.Description) : null
        };
    });

    const unmappedDropdownOptions = emVat
        .filter(em => (!em.Mapped || em.Mapped === 0) && em.AutoIndex !== 0)
        .map(em => ({
            AutoIndex: em.AutoIndex,
            DisplayName: joinLabelParts(em.DisplayName, em.Description)
        }));

    return {
        tableData,
        dropdownOptions: unmappedDropdownOptions,
        allEMVat: emVat.map(em => ({
            ...em,
            DisplayName: joinLabelParts(em.DisplayName, em.Description)
        }))
    };
};

const updateVatMapping = async (mappings) => {
    return await configureRepo.updateEMVatMapping(mappings);
};

const normalizePartyPayload = (payload = {}) => ({
    idCust: payload.idCust,
    buyerName: payload.buyerName,
    sellerName: payload.sellerName,
    tradingName: payload.tradingName,
    name: payload.name,
    addressLine1: payload.addressLine1,
    addressLine2: payload.addressLine2,
    addressLine3: payload.addressLine3,
    city: payload.city,
    postCode: payload.postCode,
    countrySubdivision: payload.countrySubdivision,
    countryCode: payload.countryCode,
    vatIdentifier: payload.vatIdentifier,
    vatId: payload.vatId,
    buyerIdentifier: payload.buyerIdentifier,
    schemeIdentifier: payload.schemeIdentifier,
    registrationId: payload.registrationId,
    legalRegistrationIdentifier: payload.legalRegistrationIdentifier,
    legalSchemeIdentifier: payload.legalSchemeIdentifier,
    legalRegistrationType: payload.legalRegistrationType,
    electronicAddress: payload.electronicAddress,
    electronicSchemeIdentifier: payload.electronicSchemeIdentifier,
    phone: payload.phone,
    email: payload.email,
    contactPoint: payload.contactPoint,
    contactNumber: payload.contactNumber,
    contactEmail: payload.contactEmail,
    commercialTradeLicense: payload.commercialTradeLicense,
    authorityName: payload.authorityName,
    emiratesId: payload.emiratesId,
    passport: payload.passport,
    passportIssuingCountryCode: payload.passportIssuingCountryCode,
    cabinetDecision: payload.cabinetDecision
});

const emptyPartyOptions = {
    electronicSchemeIdentifiers: [],
    schemeIdentifiers: [],
    legalSchemeIdentifiers: [],
    countrySubdivisions: [],
    countryCodes: [],
    legalRegistrationTypes: [],
    passportIssuingCountryCodes: []
};

const createSeller = async (payload) => saveSellerDetails(payload);

const createBuyer = async (payload) => {
    const buyerPayload = normalizePartyPayload({
        ...payload,
        buyerName: cleanText(payload?.buyerName || payload?.name),
        tradingName: cleanText(payload?.tradingName || payload?.buyerName || payload?.name),
        addressLine1: cleanText(payload?.addressLine1),
        addressLine2: cleanText(payload?.addressLine2),
        addressLine3: cleanText(payload?.addressLine3),
        city: cleanText(payload?.city),
        postCode: cleanText(payload?.postCode),
        contactPoint: cleanText(payload?.contactPoint),
        contactNumber: cleanText(payload?.contactNumber || payload?.phone),
        contactEmail: cleanNullableText(payload?.contactEmail || payload?.email),
        electronicAddress: cleanNullableText(payload?.electronicAddress),
        buyerIdentifier: cleanNullableText(payload?.buyerIdentifier),
        legalRegistrationIdentifier: cleanNullableText(payload?.legalRegistrationIdentifier || payload?.registrationId),
        vatIdentifier: cleanNullableText(payload?.vatIdentifier || payload?.vatId),
        countrySubdivision: cleanNullableValue(payload?.countrySubdivision),
        countryCode: cleanNullableValue(payload?.countryCode),
        legalRegistrationType: cleanNullableValue(payload?.legalRegistrationType),
        commercialTradeLicense: cleanNullableText(payload?.commercialTradeLicense),
        authorityName: cleanNullableText(payload?.authorityName),
        emiratesId: cleanNullableText(payload?.emiratesId),
        passport: cleanNullableText(payload?.passport),
        passportIssuingCountryCode: cleanNullableValue(payload?.passportIssuingCountryCode),
        cabinetDecision: cleanNullableText(payload?.cabinetDecision)
    });
    const buyer = await configureRepo.updateConfigureBuyer(buyerPayload);
    const options = await configureRepo.getBuyerDropdownOptions();
    return { buyer: buyer || buyerPayload, options: mapSellerOptions(options) };
};

const getBuyers = async () => {
    return configureRepo.getConfigureBuyers();
};

const getBuyer = async (idCust) => {
    const options = await configureRepo.getBuyerDropdownOptions();
    return {
        buyer: await configureRepo.getConfigureBuyerById(idCust),
        options: mapSellerOptions(options)
    };
};

module.exports = {
    getMasters,
    updateMaster,
    getAutoSend,
    updateAutoSend,
    getSendValidationStatus,
    ensureCanSend,
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
    getCurrencyMapping,
    updateCurrencyMapping,
    getVatMapping,
    updateVatMapping,
    createSeller,
    createBuyer,
    getBuyers,
    getBuyer
};
