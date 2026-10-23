const db = require("../db");
const {
    getUnqualifiedIdentifier,
    resolveIdentifier
} = require("../config/databaseSchema");

const getMasterMetadata = (type) => {
    const displayNameMap = {
        "State Master": "StateMaster",
        "Country Master": "CountryMaster",
        "Payment Master": "PaymentMaster",
        "General Ledger Type Master": "GeneralLedgerTypeMaster",
        "Account Receivable Type Master": "AccountReceivableTypeMaster",
        "Account Payable Type Master": "AccountPayableTypeMaster",
        "Other Invoice Type Master": "OtherInvoiceTypeMaster",
        "Invoice Transaction Master": "InvoiceTransactionMaster",
        "Currency Master": "CurrencyMaster",
        "Unit Master": "UnitMaster",
        "Vat Master": "VatMaster",
        "Credit Note Reason Master": "CreditNoteReasonMaster",
        "Electronic Address Scheme Master": "ElectronicAddressSchemeMaster",
        "Object Identifier Master": "ObjectIdentifierMaster",
        "Rcm Type Master": "RcmTypeMaster",
        "Exempt Reason Master": "ExemptReasonMaster",
        "Charges Master": "ChargesMaster",
        "TDD Scope Master": "TDDScopeMaster"

    };

    return {
        displayName: displayNameMap[type] || type?.replace(/\s+/g, "")
    };
};

const runInTransaction = async (callback) => db.withTransaction(callback);

const getMasterToggle = async (value) => {
    const metadata = getMasterMetadata(value);
    const rows = await db.query`
        SELECT TOP (1) [AutoIndex], [DisplayName], [IsActive]
        FROM [EM_Masters]
        WHERE [DisplayName] = ${metadata.displayName}
        ORDER BY [AutoIndex]
    `;

    return rows[0] || null;
};

const updateMasterToggle = async (value, isActive) => {
    const metadata = getMasterMetadata(value);
    const bitValue = isActive ? 1 : 0;
    const existing = await getMasterToggle(value);

    if (existing) {
        await db.execute`
            UPDATE [EM_Masters]
            SET [DisplayName] = ${metadata.displayName},
                [IsActive] = ${bitValue}
            WHERE [AutoIndex] = ${existing.AutoIndex}
        `;
    } else {
        await db.execute`
            INSERT INTO [EM_Masters] ([DisplayName], [IsActive])
            VALUES (${metadata.displayName}, ${bitValue})
        `;
    }

    return getMasterToggle(value);
};

const getAutoSendConfig = async () => {
    const rows = await db.query`
        SELECT TOP (1) [autosend]
        FROM [E_config]
    `;

    return rows[0] || null;
};

const getSendValidationConfig = async () => {
    const rows = await db.query`
        SELECT TOP (1) [Ref]
        FROM [E_config]
        ORDER BY [id]
    `;

    return rows[0] || null;
};

const updateAutoSendConfig = async (autosend) => {
    await db.execute`
        UPDATE [E_config]
        SET [autosend] = ${autosend}
    `;

    return getAutoSendConfig();
};

const getSellerDetails = async () => {
    const rows = await db.query`
        SELECT TOP (1)
            [idEntities],
            [Name],
            [PhAddress1],
            [PhAddress2],
            [PhAddress3],
            [PhPostalCode],
            [Telephone1],
            [ContactPerson],
            [StrSpare1]
        FROM [dbo].[Entities]
        ORDER BY [idEntities]
    `;

    return rows[0] || null;
};

const getSellerDetailsByEntityId = async (idEntities) => {
    const rows = await db.query`
        SELECT TOP (1)
            [idEntities],
            [Name],
            [PhAddress1],
            [PhAddress2],
            [PhAddress3],
            [PhPostalCode],
            [Telephone1],
            [ContactPerson],
            [StrSpare1]
        FROM [dbo].[Entities]
        WHERE [idEntities] = ${idEntities}
    `;

    return rows[0] || null;
};

const getSellerExtraDetailsByEntityId = async (idEntities) => {
    const rows = await db.query`
        SELECT TOP (1)
            [idEntities],
            [CITY],
            [TAXNBR],
            [LEGALNAME],
            [ElectronicAddress],
            [ElectronicSchemeID],
            [SellerIdentifier],
            [SchemeID],
            [LegalRegistrationID],
            [LegalSchemeID],
            [VATSchemeCode],
            [CountrySubdivision],
            [CountryCode],
            [LegalRegistrationType],
            [TradeLicense],
            [EmiratesID],
            [PassportNo],
            [CabinetDecision],
            [AuthorityName],
            [PassportIssuingCountry]
        FROM [dbo].[E_Seller]
        WHERE [idEntities] = ${idEntities}
    `;

    return rows[0] || null;
};

const sellerMasterTables = {
    countrySubdivisions: "EM_State",
    countryCodes: "EM_CountryCode",
    legalRegistrationTypes: "EM_SellerLegalRegType",
    passportIssuingCountryCodes: "EM_CountryCode"
};

const getSellerMasterOptions = async (tableName) =>
    db.queryUnsafe(`
        SELECT [Value], [DisplayName]
        FROM [dbo].[${tableName}]
        WHERE [Value] IS NOT NULL
        ORDER BY [DisplayName]
    `);

const getSellerDropdownOptions = async () => {
    const entries = await Promise.all(
        Object.entries(sellerMasterTables).map(async ([key, tableName]) => [
            key,
            await getSellerMasterOptions(tableName)
        ])
    );

    const schemeIdentifierOptions = await getSchemeIdentifierOptions();

    return {
        ...Object.fromEntries(entries),
        electronicSchemeIdentifiers: schemeIdentifierOptions,
        schemeIdentifiers: schemeIdentifierOptions,
        legalSchemeIdentifiers: schemeIdentifierOptions
    };
};

const getUserDictLookupOptions = async (fieldDescription) => {
    const rows = await db.query`
        SELECT TOP (1) [cLookupOptions]
        FROM [_rtblUserDict]
        WHERE [cFieldDescription] = ${fieldDescription}
    `;

    return (rows[0]?.cLookupOptions || '')
        .split(';')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => ({
            Value: value,
            DisplayName: value
        }));
};

const getSchemeIdentifierOptions = async () => getUserDictLookupOptions("SchemeIdentifier");

const getBuyerDropdownOptions = async () => {
    const options = await getSellerDropdownOptions();

    return {
        ...options,
        countrySubdivisions: await getUserDictLookupOptions("CountrySubdivision"),
        countryCodes: await getUserDictLookupOptions("CountryCode")
    };
};

const updateSellerEntityDetails = async ({
    idEntities,
    name,
    addressLine1,
    addressLine2,
    addressLine3,
    postalCode,
    telephone,
    contactPerson,
    contactEmail
}) => {
    await db.execute`
        UPDATE [dbo].[Entities]
        SET [Name] = ${name},
            [PhAddress1] = ${addressLine1},
            [PhAddress2] = ${addressLine2},
            [PhAddress3] = ${addressLine3},
            [PhPostalCode] = ${postalCode},
            [Telephone1] = ${telephone},
            [ContactPerson] = ${contactPerson},
            [StrSpare1] = ${contactEmail}
        WHERE [idEntities] = ${idEntities}
    `;

    return getSellerDetailsByEntityId(idEntities);
};

const insertSellerEntityDetails = async ({
    name,
    addressLine1,
    addressLine2,
    addressLine3,
    postalCode,
    telephone,
    contactPerson,
    contactEmail
}) => {
    const rows = await db.query`
        INSERT INTO [dbo].[Entities] (
            [Name],
            [PhAddress1],
            [PhAddress2],
            [PhAddress3],
            [PhPostalCode],
            [Telephone1],
            [ContactPerson],
            [StrSpare1]
        )
        OUTPUT INSERTED.[idEntities],
            INSERTED.[Name],
            INSERTED.[PhAddress1],
            INSERTED.[PhAddress2],
            INSERTED.[PhAddress3],
            INSERTED.[PhPostalCode],
            INSERTED.[Telephone1],
            INSERTED.[ContactPerson],
            INSERTED.[StrSpare1]
        VALUES (
            ${name},
            ${addressLine1},
            ${addressLine2},
            ${addressLine3},
            ${postalCode},
            ${telephone},
            ${contactPerson},
            ${contactEmail}
        )
    `;

    return rows[0] || null;
};

const saveSellerEntityDetails = async ({
    idEntities,
    name,
    addressLine1,
    addressLine2,
    addressLine3,
    postalCode,
    telephone,
    contactPerson,
    contactEmail
}) => {
    if (idEntities !== undefined && idEntities !== null && idEntities !== "") {
        const seller = await updateSellerEntityDetails({
            idEntities,
            name,
            addressLine1,
            addressLine2,
            addressLine3,
            postalCode,
            telephone,
            contactPerson,
            contactEmail
        });

        if (seller) return seller;
    }

    return insertSellerEntityDetails({
        name,
        addressLine1,
        addressLine2,
        addressLine3,
        postalCode,
        telephone,
        contactPerson,
        contactEmail
    });
};

const upsertSellerExtraDetails = async ({
    idEntities,
    city,
    taxNbr,
    legalName,
    electronicAddress,
    electronicSchemeIdentifier,
    sellerIdentifier,
    schemeIdentifier,
    legalRegistrationIdentifier,
    legalSchemeIdentifier,
    vatSchemeCode,
    countrySubdivision,
    countryCode,
    legalRegistrationType,
    commercialTradeLicense,
    emiratesId,
    passport,
    cabinetDecision,
    authorityName,
    passportIssuingCountryCode
}) => {
    const existing = await getSellerExtraDetailsByEntityId(idEntities);

    if (existing) {
        await db.execute`
            UPDATE [dbo].[E_Seller]
            SET [CITY] = ${city},
                [TAXNBR] = ${taxNbr},
                [LEGALNAME] = ${legalName},
                [ElectronicAddress] = ${electronicAddress},
                [ElectronicSchemeID] = ${electronicSchemeIdentifier},
                [SellerIdentifier] = ${sellerIdentifier},
                [SchemeID] = ${schemeIdentifier},
                [LegalRegistrationID] = ${legalRegistrationIdentifier},
                [LegalSchemeID] = ${legalSchemeIdentifier},
                [VATSchemeCode] = ${vatSchemeCode},
                [CountrySubdivision] = ${countrySubdivision},
                [CountryCode] = ${countryCode},
                [LegalRegistrationType] = ${legalRegistrationType},
                [TradeLicense] = ${commercialTradeLicense},
                [EmiratesID] = ${emiratesId},
                [PassportNo] = ${passport},
                [CabinetDecision] = ${cabinetDecision},
                [AuthorityName] = ${authorityName},
                [PassportIssuingCountry] = ${passportIssuingCountryCode}
            WHERE [idEntities] = ${idEntities}
        `;
    } else {
        await db.execute`
            INSERT INTO [dbo].[E_Seller] (
                [idEntities],
                [CITY],
                [TAXNBR],
                [LEGALNAME],
                [ElectronicAddress],
                [ElectronicSchemeID],
                [SellerIdentifier],
                [SchemeID],
                [LegalRegistrationID],
                [LegalSchemeID],
                [VATSchemeCode],
                [CountrySubdivision],
                [CountryCode],
                [LegalRegistrationType],
                [TradeLicense],
                [EmiratesID],
                [PassportNo],
                [CabinetDecision],
                [AuthorityName],
                [PassportIssuingCountry]
            )
            VALUES (
                ${idEntities},
                ${city},
                ${taxNbr},
                ${legalName},
                ${electronicAddress},
                ${electronicSchemeIdentifier},
                ${sellerIdentifier},
                ${schemeIdentifier},
                ${legalRegistrationIdentifier},
                ${legalSchemeIdentifier},
                ${vatSchemeCode},
                ${countrySubdivision},
                ${countryCode},
                ${legalRegistrationType},
                ${commercialTradeLicense},
                ${emiratesId},
                ${passport},
                ${cabinetDecision},
                ${authorityName},
                ${passportIssuingCountryCode}
            )
        `;
    }

    return getSellerExtraDetailsByEntityId(idEntities);
};

const getCountrySubdivisionLookup = async () =>
    db.query`
        SELECT TOP (1) [cLookupOptions]
        FROM [_rtblUserDict]
        WHERE [cFieldDescription] = 'CountrySubdivision'
    `;

const getEMStates = async () =>
    db.query`
        SELECT [AutoIndex], [DisplayName], [Mapping], [ModifiedDate]
        FROM [EM_State]
    `;

const updateEMStateMapping = async (mappings) =>
    runInTransaction(async (tx) => {
        for (const mapping of mappings) {
            await tx.execute`
                UPDATE [EM_State]
                SET [Mapping] = '',
                    [ModifiedDate] = GETDATE()
                WHERE [Mapping] = ${mapping.Mapping}
            `;
        }

        for (const mapping of mappings.filter((item) => item.AutoIndex !== 0)) {
            await tx.execute`
                UPDATE [EM_State]
                SET [Mapping] = ${mapping.Mapping},
                    [ModifiedDate] = GETDATE()
                WHERE [AutoIndex] = ${mapping.AutoIndex}
            `;
        }

        return true;
    });

const getUnits = async () =>
    db.query`
        SELECT [idUnits], [cUnitDescription]
        FROM [_etblUnits]
    `;

const getEMUnits = async () =>
    db.query`
        SELECT [AutoIndex], [Mapped], [Value], [DisplayName], [IsActive], [CreatedDate]
        FROM [EM_UnitOfMeasure_UNECE]
    `;

const updateEMUnitMapping = async (mappings) => {
    const validMappings = mappings.filter((mapping) =>
        Number.isInteger(mapping.Mapped)
    );

    return runInTransaction(async (tx) => {
        for (const mapping of validMappings) {
            await tx.execute`
                UPDATE [EM_UnitOfMeasure_UNECE]
                SET [Mapped] = 0
                WHERE [Mapped] = ${mapping.Mapped}
            `;
        }

        for (const mapping of validMappings.filter((item) => item.AutoIndex !== 0)) {
            await tx.execute`
                UPDATE [EM_UnitOfMeasure_UNECE]
                SET [Mapped] = ${mapping.Mapped}
                WHERE [AutoIndex] = ${mapping.AutoIndex}
            `;
        }

        return true;
    });
};

const getCurrencies = async () =>
    db.query`
        SELECT [CurrencyLink], [Description]
        FROM [Currency]
    `;

const getEMCurrencyCodes = async () =>
    db.query`
        SELECT [AutoIndex], [Mapped], [DisplayName], [ModifiedDate]
        FROM [EM_CurrencyCode_ISO4217]
    `;

const updateEMCurrencyMapping = async (mappings) =>
    runInTransaction(async (tx) => {
        for (const mapping of mappings) {
            await tx.execute`
                UPDATE [EM_CurrencyCode_ISO4217]
                SET [Mapped] = 0,
                    [ModifiedDate] = GETDATE()
                WHERE [Mapped] = ${mapping.Mapped}
            `;
        }

        for (const mapping of mappings.filter((item) => item.AutoIndex !== 0)) {
            await tx.execute`
                UPDATE [EM_CurrencyCode_ISO4217]
                SET [Mapped] = ${mapping.Mapped},
                    [ModifiedDate] = GETDATE()
                WHERE [AutoIndex] = ${mapping.AutoIndex}
            `;
        }

        return true;
    });

const getCountryCodeLookup = async () =>
    db.query`
        SELECT TOP (1) [cLookupOptions]
        FROM [_rtblUserDict]
        WHERE [cFieldDescription] = 'CountryCode'
    `;

const getEMCountryCodes = async () =>
    db.query`
        SELECT [AutoIndex], [Mapped], [DisplayName], [IsActive], [ModifiedDate]
        FROM [EM_CountryCode]
    `;

const updateEMCountryMapping = async (mappings) =>
    runInTransaction(async (tx) => {
        for (const mapping of mappings) {
            await tx.execute`
                UPDATE [EM_CountryCode]
                SET [Mapped] = '',
                    [ModifiedDate] = GETDATE()
                WHERE [Mapped] = ${mapping.Mapping}
            `;
        }

        for (const mapping of mappings.filter((item) => item.AutoIndex !== 0)) {
            await tx.execute`
                UPDATE [EM_CountryCode]
                SET [Mapped] = ${mapping.Mapping},
                    [ModifiedDate] = GETDATE()
                WHERE [AutoIndex] = ${mapping.AutoIndex}
            `;
        }

        return true;
    });

const getPaymentTypes = async () =>
    db.query`
        SELECT DISTINCT ulIDSOrdPaymentmode as ExistingMaster
        FROM InvNum
        WHERE ulIDSOrdPaymentmode IS NOT NULL AND ulIDSOrdPaymentmode != ''
    `;

const getEMPaymentTypeCodes = async () =>
    db.query`
        SELECT [AutoIndex], [Mapped], [DisplayName], [IsActive], [ModifiedDate]
        FROM [EM_PaymentTypeCode]
    `;

const updateEMPaymentMapping = async (mappings) =>
    runInTransaction(async (tx) => {
        for (const mapping of mappings) {
            await tx.execute`
                UPDATE [EM_PaymentTypeCode]
                SET [Mapped] = '',
                    [ModifiedDate] = GETDATE()
                WHERE [Mapped] = ${mapping.Mapping}
            `;
        }

        for (const mapping of mappings.filter((item) => item.AutoIndex !== 0)) {
            await tx.execute`
                UPDATE [EM_PaymentTypeCode]
                SET [Mapped] = ${mapping.Mapping},
                    [ModifiedDate] = GETDATE()
                WHERE [AutoIndex] = ${mapping.AutoIndex}
            `;
        }

        return true;
    });

const getInvoiceTypeLookup = async () =>
    db.query`
        SELECT [cLookupOptions]
        FROM [_rtblUserDict]
        WHERE [cFieldDescription] = 'InvoiceType'
    `;

const getSchemeIdentifierLookup = async () =>
    db.query`
        SELECT TOP (1) [cLookupOptions]
        FROM [_rtblUserDict]
        WHERE [cFieldDescription] = 'SchemeIdentifier'
    `;

const getStandardSchemeLookup = async () =>
    db.query`
        SELECT TOP (1) [cLookupOptions]
        FROM [_rtblUserDict]
        WHERE [cFieldDescription] = 'StandardScheme'
    `;

const getEMElectronicAddressSchemes = async () =>
    db.query`
        SELECT [AutoIndex], [Mapped], [DisplayName], [ModifiedDate]
        FROM [EM_ElectronicAddressScheme_Ces]
    `;

const getEMObjectIdentifiers = async () =>
    db.query`
        SELECT [AutoIndex], [Mapped], [Value], [DisplayName], [ModifiedDate]
        FROM [EM_ObjectIdentifier]
    `;

const updateEMElectronicAddressSchemeMapping = async (mappings) =>
    runInTransaction(async (tx) => {
        for (const mapping of mappings) {
            await tx.execute`
                UPDATE [EM_ElectronicAddressScheme_Ces]
                SET [Mapped] = '',
                    [ModifiedDate] = GETDATE()
                WHERE [Mapped] = ${mapping.Mapping}
            `;
        }

        for (const mapping of mappings.filter((item) => item.AutoIndex !== 0)) {
            await tx.execute`
                UPDATE [EM_ElectronicAddressScheme_Ces]
                SET [Mapped] = ${mapping.Mapping},
                    [ModifiedDate] = GETDATE()
                WHERE [AutoIndex] = ${mapping.AutoIndex}
            `;
        }

        return true;
    });

const updateEMObjectIdentifierMapping = async (mappings) =>
    runInTransaction(async (tx) => {
        for (const mapping of mappings) {
            await tx.execute`
                UPDATE [EM_ObjectIdentifier]
                SET [Mapped] = '',
                    [ModifiedDate] = GETDATE()
                WHERE [Mapped] = ${mapping.Mapping}
            `;
        }

        for (const mapping of mappings.filter((item) => item.AutoIndex !== 0)) {
            await tx.execute`
                UPDATE [EM_ObjectIdentifier]
                SET [Mapped] = ${mapping.Mapping},
                    [ModifiedDate] = GETDATE()
                WHERE [AutoIndex] = ${mapping.AutoIndex}
            `;
        }

        return true;
    });


const getInvoiceTransactionTypeLookup = async () =>
    db.query`
        SELECT TOP (1) [cLookupOptions]
        FROM [_rtblUserDict]
        WHERE [cFieldDescription] = 'InvoiceTransactionType'
    `;


const getEMInvoiceTransactionTypeCodes = async () =>
    db.query`
        SELECT [AutoIndex], [Mapped], [DisplayName], [IsActive], [ModifiedDate]
        FROM [EM_InvoiceTransactionType]
    `;

const updateEMInvoiceTransactionMapping = async (mappings) =>
    runInTransaction(async (tx) => {
        for (const mapping of mappings) {
            await tx.execute`
                UPDATE [EM_InvoiceTransactionType]
                SET [Mapped] = '',
                    [ModifiedDate] = GETDATE()
                WHERE [Mapped] = ${mapping.Mapping}
            `;
        }

        for (const mapping of mappings.filter((item) => item.AutoIndex !== 0)) {
            await tx.execute`
                UPDATE [EM_InvoiceTransactionType]
                SET [Mapped] = ${mapping.Mapping},
                    [ModifiedDate] = GETDATE()
                WHERE [AutoIndex] = ${mapping.AutoIndex}
            `;
        }

        return true;
    });

const getCreditNoteReasonLookup = async () =>
    db.query`
        SELECT TOP (1) [cLookupOptions]
        FROM [_rtblUserDict]
        WHERE [cFieldDescription] = 'CreditNoteReason'
    `;

const getRcmTypeLookup = async () =>
    db.query`
        SELECT TOP (1) [cLookupOptions]
        FROM [_rtblUserDict]
        WHERE [cFieldDescription] = 'RcmType'
    `;

    const getExemptReasonLookup = async () =>
    db.query`
        SELECT TOP (1) [cLookupOptions]
        FROM [_rtblUserDict]
        WHERE [cFieldDescription] = 'ExemptReason'
    `;

const getChargesReasonLookup = async () =>
    db.query`
        SELECT TOP (1) [cLookupOptions]
        FROM [_rtblUserDict]
        WHERE [cFieldDescription] = 'ChargesReason'
    `;

const getTddScopeLookup = async () =>
    db.query`
        SELECT TOP (1) [cLookupOptions]
        FROM [_rtblUserDict]
        WHERE [cFieldDescription] = 'TDDScope'
    `;

const getEMCreditNoteReasons = async () =>
    db.query`
        SELECT [AutoIndex], [Mapped], [Value], [DisplayName], [Modifieddate]
        FROM [EM_CreditNoteReason]
    `;

const getEMChargeCodes = async () =>
    db.query`
        SELECT [AutoIndex], [Mapped], [Value], [DisplayName], [ModifiedDate]
        FROM [EM_ChargeCode]
    `;

const getEMTddScopes = async () =>
    db.query`
        SELECT [AutoIndex], [Mapped], [Value], [DisplayName], [ModifiedDate]
        FROM [EM_TddScope]
    `;

const updateEMCreditNoteReasonMapping = async (mappings) =>
    runInTransaction(async (tx) => {
        for (const mapping of mappings) {
            await tx.execute`
                UPDATE [EM_CreditNoteReason]
                SET [Mapped] = '',
                    [Modifieddate] = GETDATE()
                WHERE [Mapped] = ${mapping.Mapping}
            `;
        }

        for (const mapping of mappings.filter((item) => item.AutoIndex !== 0)) {
            await tx.execute`
                UPDATE [EM_CreditNoteReason]
                SET [Mapped] = ${mapping.Mapping},
                    [Modifieddate] = GETDATE()
                WHERE [AutoIndex] = ${mapping.AutoIndex}
            `;
        }

        return true;
    });

const updateEMChargeCodeMapping = async (mappings) =>
    runInTransaction(async (tx) => {
        for (const mapping of mappings) {
            await tx.execute`
                UPDATE [EM_ChargeCode]
                SET [Mapped] = '',
                    [ModifiedDate] = GETDATE()
                WHERE [Mapped] = ${mapping.Mapping}
            `;
        }

        for (const mapping of mappings.filter((item) => item.AutoIndex !== 0)) {
            await tx.execute`
                UPDATE [EM_ChargeCode]
                SET [Mapped] = ${mapping.Mapping},
                    [ModifiedDate] = GETDATE()
                WHERE [AutoIndex] = ${mapping.AutoIndex}
            `;
        }

        return true;
    });

const updateEMTddScopeMapping = async (mappings) =>
    runInTransaction(async (tx) => {
        for (const mapping of mappings) {
            await tx.execute`
                UPDATE [EM_TddScope]
                SET [Mapped] = '',
                    [ModifiedDate] = GETDATE()
                WHERE [Mapped] = ${mapping.Mapping}
            `;
        }

        for (const mapping of mappings.filter((item) => item.AutoIndex !== 0)) {
            await tx.execute`
                UPDATE [EM_TddScope]
                SET [Mapped] = ${mapping.Mapping},
                    [ModifiedDate] = GETDATE()
                WHERE [AutoIndex] = ${mapping.AutoIndex}
            `;
        }

        return true;
    });

const getEMGoodsServiceTypes = async () =>
    db.query`
        SELECT [AutoIndex], [Mapped], [DisplayName], [ModifiedDate]
        FROM [EM_GoodsServiceType]
    `;

const updateEMGoodsServiceTypeMapping = async (mappings) =>
    runInTransaction(async (tx) => {
        for (const mapping of mappings) {
            await tx.execute`
                UPDATE [EM_GoodsServiceType]
                SET [Mapped] = '',
                    [ModifiedDate] = GETDATE()
                WHERE [Mapped] = ${mapping.Mapping}
            `;
        }

        for (const mapping of mappings.filter((item) => item.AutoIndex !== 0)) {
            await tx.execute`
                UPDATE [EM_GoodsServiceType]
                SET [Mapped] = ${mapping.Mapping},
                    [ModifiedDate] = GETDATE()
                WHERE [AutoIndex] = ${mapping.AutoIndex}
            `;
        }

        return true;
    });

    const getEMVATExemptionReasons = async () =>
    db.query`
        SELECT [AutoIndex], [Mapped], [DisplayName], [ModifiedDate]
        FROM [EM_VATExemptionReason]
    `;

const updateEMVATExemptionReasonMapping = async (mappings) =>
    runInTransaction(async (tx) => {
        for (const mapping of mappings) {
            await tx.execute`
                UPDATE [EM_VATExemptionReason]
                SET [Mapped] = '',
                    [ModifiedDate] = GETDATE()
                WHERE [Mapped] = ${mapping.Mapping}
            `;
        }

        for (const mapping of mappings.filter((item) => item.AutoIndex !== 0)) {
            await tx.execute`
                UPDATE [EM_VATExemptionReason]
                SET [Mapped] = ${mapping.Mapping},
                    [ModifiedDate] = GETDATE()
                WHERE [AutoIndex] = ${mapping.AutoIndex}
            `;
        }

        return true;
    });

const getTrCodes = async () =>
    db.query`
        SELECT [idTrCodes], [Description], [iModule]
        FROM [TrCodes]
    `;

const getEMInvoiceTypeCodes = async () =>
    db.query`
        SELECT [AutoIndex], [Mapping], [DisplayName], [IsActive], [ModifiedDate]
        FROM [EM_InvoiceTypeCode]
        where IsActive = 1
    `;

const updateEMInvoiceTypeMapping = async (mappings) =>
    runInTransaction(async (tx) => {
        for (const mapping of mappings) {
            await tx.execute`
                UPDATE [EM_InvoiceTypeCode]
                SET [Mapping] = '',
                    [ModifiedDate] = GETDATE()
                WHERE [Mapping] = ${mapping.Mapping}
            `;
        }

        for (const mapping of mappings.filter((item) => item.AutoIndex !== 0)) {
            await tx.execute`
                UPDATE [EM_InvoiceTypeCode]
                SET [Mapping] = ${mapping.Mapping},
                    [ModifiedDate] = GETDATE()
                WHERE [AutoIndex] = ${mapping.AutoIndex}
            `;
        }

        return true;
    });

const getVat = async () =>
    db.query`
        SELECT [idTaxRate], [Description], [TaxRate]
        FROM [TaxRate]
    `;

const getEMVat = async () =>
    db.query`
        SELECT [AutoIndex], [Mapped], [DisplayName], [Description], [ModifiedDate]
        FROM [EM_VATCategoryCode]
    `;

const updateEMVatMapping = async (mappings) => {
    const validMappings = mappings.filter((mapping) =>
        Number.isInteger(mapping.Mapped)
    );

    return runInTransaction(async (tx) => {
        for (const mapping of validMappings) {
            await tx.execute`
                UPDATE [EM_VATCategoryCode]
                SET [Mapped] = 0
                WHERE [Mapped] = ${mapping.Mapped}
            `;
        }

        for (const mapping of validMappings.filter((item) => item.AutoIndex !== 0)) {
            await tx.execute`
                UPDATE [EM_VATCategoryCode]
                SET [Mapped] = ${mapping.Mapped}
                WHERE [AutoIndex] = ${mapping.AutoIndex}
            `;
        }

        return true;
    });
};

const partyFieldColumnCandidates = {
    idCust: ["idCust", "DCLink", "CustomerId", "BuyerId", "id", "AutoIndex"],
    account: ["Account", "Account"],
    buyerName: ["buyerName", "BuyerName", "Name", "Name", "Name", "buyer_name"],
    sellerName: ["sellerName", "SellerName", "Name", "seller_name"],
    tradingName: ["tradingName", "TradingName"],
    name: ["Name", "DisplayName", "BuyerName", "SellerName", "Name", "buyer_name", "seller_name"],
    addressLine1: ["AddressLine1", "AddrLine1", "Address1", "Physical1", "Physical1", "BuyerAddressline1", "SellerAddressline1", "buyer_addr_line1", "seller_addr_line1"],
    addressLine2: ["AddressLine2", "AddrLine2", "Address2", "Physical2", "Physical2", "buyer_addr_line2", "seller_addr_line2"],
    addressLine3: ["AddressLine3", "AddrLine3", "Address3", "Physical3", "Physical3", "buyer_addr_line3", "seller_addr_line3"],
    city: ["City", "BuyerCity", "SellerCity", "Physical4", "Physical4", "Physical4", "buyer_city", "seller_city"],
    postCode: ["PostCode", "PostalCode", "ZipCode", "PhysicalPC", "PhysicalPC"],
    countrySubdivision: ["CountrySubdivision", "State", "ulARCountrySubdivision", "BuyerCountrySubdivision", "SellerCountrySubdivision", "buyer_country_subdivision", "seller_country_subdivision"],
    countryCode: ["CountryCode", "ulARCountryCode", "BuyerCountry", "SellerCountryCode", "buyer_country_code", "seller_country_code"],
    vatIdentifier: ["vatIdentifier", "VatIdentifier", "VatId", "VATId", "VatNumber", "TaxIdentifier", "ucARVATIdentifier", "buyer_vat_id", "seller_vat_id"],
    vatId: ["VatId", "VATId", "VatNumber", "TaxIdentifier", "buyer_vat_id", "seller_vat_id"],
    buyerIdentifier: ["buyerIdentifier", "BuyerIdentifier", "BuyerId", "ucARBuyerIdentifier"],
    schemeIdentifier: ["schemeIdentifier", "SchemeIdentifier"],
    electronicSchemeIdentifier: ["electronicSchemeIdentifier", "ElectronicSchemeIdentifier", "EndpointSchemeId"],
    registrationId: ["RegistrationId", "LegalRegistrationId", "LegalRegId", "buyer_legal_reg_id", "seller_legal_reg_id"],
    legalRegistrationIdentifier: ["legalRegistrationIdentifier", "LegalRegistrationIdentifier", "LegalRegistrationId", "LegalRegId", "ucARLegalRegistrationID", "buyer_legal_reg_id", "seller_legal_reg_id"],
    legalSchemeIdentifier: ["legalSchemeIdentifier", "LegalSchemeIdentifier", "ulARSchemeIdentifier"],
    legalRegistrationType: ["legalRegistrationType", "LegalRegistrationType", "ucARLegalRegistrationType"],
    electronicAddress: ["ElectronicAddress", "EndpointId", "ucARElectronicAddress", "buyer_endpoint_id", "seller_endpoint_id"],
    phone: ["Phone", "Telephone", "Mobile", "Telephone"],
    email: ["Email", "EmailAddress", "EMail"],
    contactPoint: ["contactPoint", "ContactPoint", "Contact_Person", "Contact_Person"],
    contactNumber: ["contactNumber", "ContactNumber", "Telephone", "Telephone", "Phone", "Telephone"],
    contactEmail: ["contactEmail", "ContactEmail", "EMail", "Email"],
    commercialTradeLicense: ["commercialTradeLicense", "CommercialTradeLicense", "ucARTradeLicense"],
    authorityName: ["authorityName", "AuthorityName", "ucARAuthorityName"],
    emiratesId: ["emiratesId", "EmiratesId", "ucAREmiratesID"],
    passport: ["passport", "Passport", "ucARPassportNo"],
    passportIssuingCountryCode: ["passportIssuingCountryCode", "PassportIssuingCountryCode", "ulARPassportIssuingCountry"],
    cabinetDecision: ["cabinetDecision", "CabinetDecision", "ucARCabinetDecision"]
};

const tableColumnCache = new Map();

const getTableColumns = async (tableName) => {
    const physicalTableName = getUnqualifiedIdentifier(resolveIdentifier(tableName));

    if (tableColumnCache.has(physicalTableName)) {
        return tableColumnCache.get(physicalTableName);
    }

    const columns = await db.query`
        SELECT [COLUMN_NAME]
        FROM [INFORMATION_SCHEMA].[COLUMNS]
        WHERE [TABLE_NAME] = ${physicalTableName}
        ORDER BY [ORDINAL_POSITION]
    `;
    const columnNames = columns.map((column) => column.COLUMN_NAME);
    tableColumnCache.set(physicalTableName, columnNames);
    return columnNames;
};

const resolveColumnName = (availableColumns, fieldName) => {
    const candidates = [fieldName, ...(partyFieldColumnCandidates[fieldName] || [])];
    return candidates.find((candidate) =>
        availableColumns.some((column) => column.toLowerCase() === candidate.toLowerCase())
    );
};

const quoteIdentifier = (identifier) => `[${String(identifier).replace(/]/g, "]]")}]`;

const getResolvedColumn = async (tableName, fieldName) => {
    const availableColumns = await getTableColumns(tableName);
    return resolveColumnName(availableColumns, fieldName);
};

const readColumnValue = (row, fieldName) => {
    const candidates = [fieldName, ...(partyFieldColumnCandidates[fieldName] || [])];
    const key = candidates.find((candidate) =>
        Object.keys(row || {}).some((column) => column.toLowerCase() === candidate.toLowerCase())
    );
    if (!key) return "";
    const actualKey = Object.keys(row).find((column) => column.toLowerCase() === key.toLowerCase());
    return row[actualKey] ?? "";
};

const normalizeBuyerRow = (row) => {
    const id = readColumnValue(row, "idCust") || readColumnValue(row, "name");
    return {
        id,
        idCust: id,
        account: readColumnValue(row, "account"),
        Name: readColumnValue(row, "buyerName") || readColumnValue(row, "name"),
        Physical1: readColumnValue(row, "addressLine1"),
        Physical2: readColumnValue(row, "addressLine2"),
        Physical3: readColumnValue(row, "addressLine3"),
        Physical4: readColumnValue(row, "city"),
        Contact_Person: readColumnValue(row, "contactPoint"),
        Telephone: readColumnValue(row, "contactNumber"),
        buyerName: readColumnValue(row, "buyerName") || readColumnValue(row, "name"),
        tradingName: readColumnValue(row, "tradingName"),
        addressLine1: readColumnValue(row, "addressLine1"),
        addressLine2: readColumnValue(row, "addressLine2"),
        addressLine3: readColumnValue(row, "addressLine3"),
        city: readColumnValue(row, "city"),
        postCode: readColumnValue(row, "postCode"),
        countrySubdivision: readColumnValue(row, "countrySubdivision"),
        countryCode: readColumnValue(row, "countryCode"),
        electronicAddress: readColumnValue(row, "electronicAddress"),
        electronicSchemeIdentifier: readColumnValue(row, "electronicSchemeIdentifier"),
        buyerIdentifier: readColumnValue(row, "buyerIdentifier"),
        schemeIdentifier: readColumnValue(row, "schemeIdentifier"),
        legalRegistrationIdentifier: readColumnValue(row, "legalRegistrationIdentifier"),
        legalSchemeIdentifier: readColumnValue(row, "legalSchemeIdentifier"),
        legalRegistrationType: readColumnValue(row, "legalRegistrationType"),
        vatIdentifier: readColumnValue(row, "vatIdentifier"),
        commercialTradeLicense: readColumnValue(row, "commercialTradeLicense"),
        authorityName: readColumnValue(row, "authorityName"),
        emiratesId: readColumnValue(row, "emiratesId"),
        passport: readColumnValue(row, "passport"),
        passportIssuingCountryCode: readColumnValue(row, "passportIssuingCountryCode"),
        cabinetDecision: readColumnValue(row, "cabinetDecision"),
        contactPoint: readColumnValue(row, "contactPoint"),
        contactNumber: readColumnValue(row, "contactNumber"),
        contactEmail: readColumnValue(row, "contactEmail")
    };
};

const getConfigureBuyers = async () => {
    const rows = await db.queryUnsafe(`
        SELECT TOP (500)
            [DCLink],
            [Account],
            [Name],
            [Physical1],
            [Physical2],
            [Physical3],
            [Physical4],
            [PhysicalPC],
            [Contact_Person],
            [Telephone],
            [EMail],
            [ucARElectronicAddress],
            [ucARBuyerIdentifier],
            [ucARLegalRegistrationID],
            [ulARSchemeIdentifier],
            [ucARVATIdentifier],
            [ulARCountrySubdivision],
            [ulARCountryCode],
            [ucARLegalRegistrationType],
            [ucARTradeLicense],
            [ucAREmiratesID],
            [ucARPassportNo],
            [ucARCabinetDecision],
            [ucARAuthorityName],
            [ulARPassportIssuingCountry]
        FROM [Client]
        ORDER BY [Name]
    `);
    return rows.map(normalizeBuyerRow);
};

const getConfigureBuyerById = async (idCust) => {
    const idColumn = await getResolvedColumn("Client", "idCust");
    if (!idColumn) return null;

    const rows = await db.queryStatement(
        `SELECT TOP (1) * FROM [Client] WHERE ${quoteIdentifier(idColumn)} = @p0`,
        [idCust]
    );

    return rows[0] ? normalizeBuyerRow(rows[0]) : null;
};

const updateConfigureBuyer = async (payload) => {
    if (!payload?.idCust) {
        throw new Error("Buyer customer id is required");
    }

    await db.execute`
        UPDATE [Client]
        SET [Name] = ${payload.tradingName || payload.buyerName},
            [Physical1] = ${payload.addressLine1},
            [Physical2] = ${payload.addressLine2},
            [Physical3] = ${payload.addressLine3},
            [Physical4] = ${payload.city},
            [PhysicalPC] = ${payload.postCode},
            [Contact_Person] = ${payload.contactPoint},
            [Telephone] = ${payload.contactNumber},
            [EMail] = ${payload.contactEmail},
            [ucARElectronicAddress] = ${payload.electronicAddress},
            [ucARBuyerIdentifier] = ${payload.buyerIdentifier},
            [ucARLegalRegistrationID] = ${payload.legalRegistrationIdentifier},
            [ulARSchemeIdentifier] = ${payload.legalSchemeIdentifier},
            [ucARVATIdentifier] = ${payload.vatIdentifier},
            [ulARCountrySubdivision] = ${payload.countrySubdivision},
            [ulARCountryCode] = ${payload.countryCode},
            [ucARLegalRegistrationType] = ${payload.legalRegistrationType},
            [ucARTradeLicense] = ${payload.commercialTradeLicense},
            [ucAREmiratesID] = ${payload.emiratesId},
            [ucARPassportNo] = ${payload.passport},
            [ucARCabinetDecision] = ${payload.cabinetDecision},
            [ucARAuthorityName] = ${payload.authorityName},
            [ulARPassportIssuingCountry] = ${payload.passportIssuingCountryCode}
        WHERE [DCLink] = ${payload.idCust}
    `;

    return getConfigureBuyerById(payload.idCust);
};

const insertConfigureParty = async (tableName, payload) => {
    const allowedTables = new Set(["E_Buyer", "E_Seller"]);
    if (!allowedTables.has(tableName)) {
        throw new Error("Invalid configure party table");
    }

    const availableColumns = await getTableColumns(tableName);
    const valuesByColumn = {};

    for (const [fieldName, value] of Object.entries(payload || {})) {
        const columnName = resolveColumnName(availableColumns, fieldName);
        if (columnName && value !== undefined) {
            valuesByColumn[columnName] = value === "" ? null : value;
        }
    }

    const createdDateColumn = availableColumns.find((column) =>
        ["CreatedDate", "CreatedAt", "createdAt"].some((candidate) => candidate.toLowerCase() === column.toLowerCase())
    );

    if (createdDateColumn && !Object.prototype.hasOwnProperty.call(valuesByColumn, createdDateColumn)) {
        valuesByColumn[createdDateColumn] = new Date();
    }

    const insertColumns = Object.keys(valuesByColumn);
    if (insertColumns.length === 0) {
        throw new Error(`No matching columns found for ${tableName}`);
    }

    const columnSql = insertColumns.map(quoteIdentifier).join(", ");
    const valueSql = insertColumns.map((_, index) => `@p${index}`).join(", ");
    const values = insertColumns.map((column) => valuesByColumn[column]);

    await db.executeStatement(
        `INSERT INTO ${quoteIdentifier(tableName)} (${columnSql}) VALUES (${valueSql})`,
        values
    );

    return valuesByColumn;
};

module.exports = {
    getMasterToggle,
    updateMasterToggle,
    getAutoSendConfig,
    getSendValidationConfig,
    updateAutoSendConfig,
    getSellerDetails,
    getSellerDetailsByEntityId,
    getSellerExtraDetailsByEntityId,
    getSellerDropdownOptions,
    getBuyerDropdownOptions,
    updateSellerEntityDetails,
    insertSellerEntityDetails,
    saveSellerEntityDetails,
    upsertSellerExtraDetails,
    getCountrySubdivisionLookup,
    getEMStates,
    updateEMStateMapping,
    getVat,
    getEMVat,
    updateEMVatMapping,
    getUnits,
    getEMUnits,
    updateEMUnitMapping,
    getCurrencies,
    getEMCurrencyCodes,
    updateEMCurrencyMapping,
    getCountryCodeLookup,
    getEMCountryCodes,
    updateEMCountryMapping,
    getPaymentTypes,
    getEMPaymentTypeCodes,
    updateEMPaymentMapping,
    getInvoiceTypeLookup,
    getSchemeIdentifierLookup,
    getStandardSchemeLookup,
    getEMElectronicAddressSchemes,
    updateEMElectronicAddressSchemeMapping,
    getEMObjectIdentifiers,
    updateEMObjectIdentifierMapping,
    getInvoiceTransactionTypeLookup,
    getEMInvoiceTransactionTypeCodes,
    updateEMInvoiceTransactionMapping,
    getCreditNoteReasonLookup,
    getEMCreditNoteReasons,
    updateEMCreditNoteReasonMapping,
    getChargesReasonLookup,
    getEMChargeCodes,
    updateEMChargeCodeMapping,
    getTddScopeLookup,
    getEMTddScopes,
    updateEMTddScopeMapping,
    getExemptReasonLookup,
    updateEMVATExemptionReasonMapping,
    getEMVATExemptionReasons,
    getRcmTypeLookup,
    getEMGoodsServiceTypes,
    updateEMGoodsServiceTypeMapping,
    getTrCodes,
    getEMInvoiceTypeCodes,
    updateEMInvoiceTypeMapping,
    insertConfigureParty,
    getConfigureBuyers,
    getConfigureBuyerById,
    updateConfigureBuyer
};
