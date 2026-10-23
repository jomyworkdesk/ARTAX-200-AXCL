const db = require("../db");
const SYNC_BATCH_SIZE = 2;
const SPEC_IDENTIFIER = "urn:peppol:pint:billing-1@ae-1";
const BUSINESS_PROCESS_TYPE = "urn:peppol:bis:billing";
const VAT_TAX_SCHEME_CODE = "VAT";

const buildSqlStringList = (values) =>
    values
        .filter((value) => value !== null && value !== undefined && value !== "")
        .map((value) => `'${String(value).replace(/'/g, "''")}'`)
        .join(",");

const normalizeAutoIndex = (value) => {
    const autoIndex = Number(value);
    return Number.isFinite(autoIndex) ? autoIndex : null;
};

const buildDocFilter = (documents) =>
    documents
        .filter((doc) => {
            const autoIndex = normalizeAutoIndex(doc?.AutoIndex);
            return autoIndex !== null
                || (doc?.InvNumber !== null && doc?.InvNumber !== undefined && doc?.InvNumber !== "");
        })
        .map((doc) => {
            const autoIndex = normalizeAutoIndex(doc.AutoIndex);
            const invNumber = String(doc.InvNumber).replace(/'/g, "''");
            const docType = Number(doc.DocType);

            if (autoIndex !== null) {
                return `(I.AutoIndex = ${autoIndex})`;
            }

            if (!Number.isFinite(docType)) {
                return `(I.InvNumber = '${invNumber}')`;
            }

            return `(I.InvNumber = '${invNumber}' AND I.DocType = ${docType})`;
        })
        .join(" OR ");

const toDecimal = (value, fallback = 0) => {
    if (value === null || value === undefined || value === "") return fallback;
    const normalized = typeof value === "string"
        ? value.replace(/,/g, "").match(/-?\d+(\.\d+)?/)?.[0]
        : value;
    const decimal = Number(normalized);
    return Number.isFinite(decimal) ? decimal : fallback;
};

const toDbString = (value) => {
    if (value === null || value === undefined || value === "") return null;
    return String(value).trim();
};

const calculatePercent = (amount, baseAmount) => {
    const base = toDecimal(baseAmount);
    if (base === 0) return null;
    return (toDecimal(amount) / base) * 100;
};

const getInvoiceTypeCode = (docType) => Number(docType) === 1 ? "381" : "380";

const buildDecimalValues = (row) => {
    const applyDocumentChargeToVatBreakdown = Number(row.ApplyDocumentChargeToVatBreakdown) === 1;
    const vatCatDocChargeAmount = applyDocumentChargeToVatBreakdown
        ? toDecimal(row.DocChargeAmount)
        : 0;
    const vatCatDocChargeTaxAmount = applyDocumentChargeToVatBreakdown
        ? toDecimal(row.DocChargeTaxAmount)
        : 0;

    return {
        contract_value: toDecimal(row.ContractValue),
        doc_allow_percent: toDecimal(row.DocAllowPercent),
        doc_allow_amount: toDecimal(row.DocAllowAmount),
        doc_allow_base_amount: toDecimal(row.DocAllowBaseAmount),
        doc_allow_vat_rate: toDecimal(row.DocAllowVatRate),
        doc_charge_percent: toDecimal(row.DocChargePercent),
        doc_charge_amount: toDecimal(row.DocChargeAmount),
        doc_charge_base_amount: toDecimal(row.DocChargeBaseAmount),
        doc_charge_vat_rate: toDecimal(row.DocChargeVatRate),
        calculation_rate: toDecimal(row.CalculationRate),
        invoice_total_tax_amt: toDecimal(row.InvTotTax),
        vat_cat_taxable_amt: toDecimal(row.LineExtensionAmount) + vatCatDocChargeAmount,
        vat_cat_tax_amt: toDecimal(row.LineTax) + vatCatDocChargeTaxAmount,
        vat_cat_rate: toDecimal(row.ItemVatPrice),
        invoice_total_vat_tax_currency: toDecimal(row.InvTotTaxCurrency, toDecimal(row.InvTotTax)),
        invoice_line_net_total: toDecimal(row.VatCatTaxableAmtTotal, toDecimal(row.InvTotExclDEx)),
        invoice_total_without_tax: toDecimal(row.InvTotExcl),
        invoice_total_with_tax: toDecimal(row.InvTotIncl),
        total_doc_allowances: toDecimal(row.TotalDocAllowances),
        total_doc_charges: toDecimal(row.TotalDocCharges),
        paid_amount: toDecimal(row.PaidAmount),
        rounding_amount: toDecimal(row.RoundingAmount),
        amount_due: toDecimal(row.InvTotIncl),
        invoiced_qty: toDecimal(row.InvoicedQuantity),
        invoice_line_net_amt: toDecimal(row.LineExtensionAmount),
        line_allow_percent: toDecimal(row.LineAllowPercent),
        line_allow_amount: toDecimal(row.LineAllowAmount),
        line_allow_base_amount: toDecimal(row.LineAllowBaseAmount),
        line_charge_percent: toDecimal(row.LineChargePercent),
        line_charge_amount: toDecimal(row.LineChargeAmount),
        line_charge_base_amount: toDecimal(row.LineChargeBaseAmount),
        item_vat_rate: toDecimal(row.ItemVatPrice),
        item_price_base_qty: toDecimal(row.ItemPriceBaseQty, 1),
        item_price_discount: toDecimal(row.ItemPriceDiscount),
        item_gross_price: toDecimal(row.PriceExcl),
        invoice_line_amt_aed: toDecimal(row.LineTotal),
        vat_line_amt_aed: toDecimal(row.LineTax)
    };
};

const lockPendingQueue = async (client = db) => {
    const result = await client.query`
        ;WITH next_queue AS (
            SELECT TOP (${SYNC_BATCH_SIZE}) QueueID
            FROM E_InvoiceQueue q
            WHERE ISNULL(q.IsInvoiced, 0) = 0
              AND ISNULL(q.IsProcessing, 0) = 0
              AND EXISTS (
                  SELECT 1
                  FROM InvNum I
                  WHERE I.AutoIndex = q.AutoIndex
                    AND I.DocType = q.DocType
                    AND I.DocState = 4
              )
            ORDER BY QueueID ASC
        )
        UPDATE E_InvoiceQueue
        SET IsProcessing = 1,
            Status = '0'
        OUTPUT inserted.QueueID, inserted.AutoIndex, inserted.InvNumber, inserted.DocType
        WHERE QueueID IN (SELECT QueueID FROM next_queue)
    `;
    return result;
};

const fetchInvoiceSourceRows = async (client = db, documents) => {
    if (!documents.length) return [];

    const normalizedDocuments = documents.map((doc) =>
        typeof doc === "object"
            ? doc
            : {
                InvNumber: doc,
                AutoIndex: null,
                DocType: null
            }
    );

    const invNumbers = normalizedDocuments.map((doc) => doc.InvNumber);
    const inClause = buildSqlStringList(invNumbers);
    const docFilter = buildDocFilter(normalizedDocuments);

    if (!inClause || !docFilter) return [];

    const sellerRows = await client.queryUnsafe(`
        SELECT TOP (1)
            S.[ElectronicAddress] AS SellerElectronicAddress,
            EAS.VALUE AS SellerElectronicSchemeId,
            S.[SellerIdentifier] AS SellerId,
            EAS.VALUE AS SellerSchemeId,
            S.[LEGALNAME] AS SellerTradeName,
            E.Name AS SellerName,
            E.[PhAddress1] AS SellerAddressline1,
            E.[PhAddress2] AS SellerAddressline2,
            E.[PhAddress3] AS SellerAddressline3,
            S.city AS SellerCity,
            E.PhPostalCode AS SellerPostCode,
            S.[CountrySubdivision] AS SellerCountrySubdivision,
            S.[CountryCode] AS SellerCountryCode,
            S.[TAXNBR] AS SellerVatId,
            S.[VATSchemeCode] AS SellerTaxSchemeCode,
            S.[LegalRegistrationID] AS SellerLegalRegistrationId,
            EAS.VALUE AS SellerLegalSchemeId,
            S.[AuthorityName] AS SellerAuthorityName,
            S.[PassportIssuingCountry] AS SellerPassportCountryCode,
            S.[LegalRegistrationType] AS SellerLegalRegistrationType,
            E.[ContactPerson] AS SellerContactPoint,
            E.[StrSpare1] AS SellerContactEmail,
            E.[Telephone1] AS SellerContactPhone
        FROM Entities E
        LEFT JOIN E_SELLER S ON E.[idEntities] = S.[idEntities]
        LEFT JOIN [EM_ElectronicAddressScheme_Ces] EAS ON S.[ElectronicSchemeID] = EAS.[Mapped]
        ORDER BY E.idEntities DESC
    `);

    const headerRows = await client.queryUnsafe(`
        SELECT
            YEAR(P.dPeriodDate) AS FinancialYear,
            CONVERT(varchar(10), DATEFROMPARTS(YEAR(P.dPeriodDate), MONTH(P.dPeriodDate), 1), 23) AS InvoicePeriodStart,
            CONVERT(varchar(10), P.dPeriodDate, 23) AS InvoicePeriodEnd,
            I.AutoIndex AS ReferenceNumber,
            I.InvDate AS InvoiceIssueDate,
            CONVERT(varchar(8), I.CreatedTime, 108) AS InvoiceIssueTime,
            I.InvNumber AS InvoiceNumber,
            I.DeliveryDate AS ActualDeliveryDate,
            I.[Address1] AS DeliverToAddrLine1,
            I.[Address2] AS DeliverToAddrLine2,
            I.[Address3] AS DeliverToAddrLine3,
            I.[Address4] AS DeliverToCity,
            I.[Address5] AS DeliverToPostCode,
            DEA.[Value] AS DeliverToSchemeId,
            I.[ucIDSOrdLocationIdentifier] AS DeliverToLocationId,
            DCO.[Value] AS DeliverToCountryCode,
            I.[ucIDSOrdDeliveryState] AS DeliverToCountrySubdivision,
            I.[ucIDSOrdDeliveryParty] AS DeliverToPartyName,
            I.[ucIDSOrdDeliveryPartyId] AS DeliverToPartyId,
            I.DueDate AS InvoicePaymentDueDate,
            CASE
                WHEN I.ForeignCurrencyID = 0 THEN 'AED'
                ELSE CUR.VALUE
            END AS InvoiceCurrencyCode,
            CASE WHEN I.ForeignCurrencyID <> 0 THEN 'AED' ELSE NULL END AS TaxAccountCurrency,
            CASE WHEN I.ForeignCurrencyID <> 0 THEN 'AED' ELSE NULL END AS InvoiceObjIdentifier,
            CASE WHEN I.ForeignCurrencyID <> 0 THEN 'aedtotal-incl-vat' ELSE NULL END AS InvoiceDocTypeCode,
            CASE WHEN I.ForeignCurrencyID <> 0 THEN CONCAT('AED', I.InvTotIncl) ELSE NULL END AS InvocieDocDescription,
            CASE WHEN I.ForeignCurrencyID <> 0 THEN CUR.VALUE ELSE NULL END AS SourceCurrencyCode,
            CASE WHEN I.ForeignCurrencyID <> 0 THEN 'AED' ELSE NULL END AS TargetCurrencyCode,
            CASE WHEN I.ForeignCurrencyID <> 0 THEN I.fExchangeRate ELSE NULL END AS CalculationRate,
            CASE WHEN I.DocType = 1 THEN '00000000' ELSE ITT.Value END AS TransactionCode,
            TDD.Value AS TddScope,
            CASE WHEN I.DocType = 1 THEN NULLIF(CRR.Value, '') ELSE NULL END AS CreditNoteReasonCode,
            COALESCE(
                NULLIF(LTRIM(RTRIM(AllocatedPostAR.Reference)), ''),
                NULLIF(LTRIM(RTRIM(LinkedInv.InvNumber)), ''),
                NULLIF(LTRIM(RTRIM(OrigInv.InvNumber)), '')
            ) AS PrecedingInvoiceRef,
            COALESCE(AllocatedInv.InvDate, LinkedInv.InvDate, OrigInv.InvDate) AS PrecedingInvoiceDate,

            CASE WHEN I.ForeignCurrencyID <> 0 THEN I.fInvTotExclForeign ELSE I.InvTotExcl END AS InvTotExcl,
            CASE WHEN I.ForeignCurrencyID <> 0 THEN I.fInvTotExclDExForeign ELSE I.InvTotExclDEx END AS InvTotExclDEx,

            CASE WHEN I.ForeignCurrencyID <> 0 THEN I.fInvTotTaxForeign ELSE I.InvTotTax END AS InvTotTax,
            CASE WHEN I.ForeignCurrencyID <> 0 THEN I.fInvTotInclForeign ELSE I.InvTotIncl END AS InvTotIncl,
            I.InvTotTax AS InvTotTaxCurrency,
            I.InvDisc AS DocAllowPercent,
            CASE WHEN I.ForeignCurrencyID <> 0 THEN I.fInvDiscAmntExForeign ELSE I.InvDiscAmntEx END AS DocAllowAmount,
            CASE WHEN I.ForeignCurrencyID <> 0 THEN I.fInvDiscAmntExForeign ELSE I.InvDiscAmntEx END AS TotalDocAllowances,
            CASE WHEN I.ForeignCurrencyID <> 0 THEN I.fInvTotExclDExForeign ELSE I.InvTotExclDEx END AS DocAllowBaseAmount,
            CASE WHEN I.DocType = 1 THEN I.ucIDCrnDiscountReason ELSE I.ucIDSOrdDiscountReason END AS DocAllowReason,
            CASE WHEN I.DocType = 1 THEN I.ulIDCrnDiscountVat ELSE I.ulIDSOrdDiscountVat END AS DocAllowVatRate,
            VER.Value AS DocAllowVatExemptCode,
            CASE WHEN I.DocType = 1 THEN I.[ucIDCrnZerorateReason] ELSE I.[ucIDSOrdZerorateReason] END AS DocAllowVatExemptText,

            C.[ucARElectronicAddress] AS BuyerElectronicAddress,
            EEA.Value AS BuyerElectronicSchemeId,
            C.[ucARBuyerIdentifier] AS BuyerId,
            EEA.Value AS BuyerSchemeId,
            C.Name AS BuyerTradeName,
            C.Physical1 AS BuyerAddressline1,
            C.Physical2 AS BuyerAddressline2,
            C.Physical3 AS BuyerAddressline3,
            C.Physical4 AS BuyerCity,
            C.PhysicalPC AS BuyerPostCode,
            ST.Value AS BuyerCountrySubdivision,
            CC.Value AS BuyerCountry,
            C.[ucARVATIdentifier] AS BuyerVatId,
            'VAT' AS BuyerTaxSchemeCode,
            C.Name AS BuyerName,
            C.ucARLegalRegistrationID AS BuyerLegalRegistrationId,
            EEA.Value AS BuyerLegalSchemeId,
            C.ucARAuthorityName AS BuyerAuthorityName,
            C.[ulARPassportIssuingCountry] AS BuyerPassportCountryCode,
            C.ucARLegalRegistrationType AS BuyerLegalRegistrationType,
            C.Contact_Person AS BuyerContactPoint,
            C.Telephone AS BuyerContactPhone,
            C.EMail AS BuyerContactEmail,

            I.ucIDSOrdPayeeId AS PayeeId,
            I.ucIDSOrdPayeeSchemeid AS PayeeSchemeId,
            I.ucIDSOrdPayeename AS PayeeName,
            I.ucIDSOrdPayeeReg AS PayeeLegalRegId,
            I.ucIDSOrdPayeeSchemeid AS PayeeLegalSchemeId,
            I.ucIDSOrdPrincipleId AS PrincipleId,
            C.ucARBeneficiaryId AS BeneficiaryId,

            PT.Value AS PaymentType,
            GST.Value AS GoodsServiceType,
            VER.Value AS VatExemptReasonCode,
            CASE WHEN I.DocType = 1 THEN I.[ucIDCrnZerorateReason] ELSE I.[ucIDSOrdZerorateReason] END AS VatExemptReasonText,
            VC.Value AS VatCategory,
            I.DocType AS DocType,
            I.Description AS EInvoiceType

        FROM [InvNum] I
        LEFT JOIN (
            SELECT Reference, MAX(Period) AS Period
            FROM PostGL
            WHERE Reference IN (${inClause})
            GROUP BY Reference
        ) PGL ON I.InvNumber = PGL.Reference
        LEFT JOIN [_etblPeriod] P ON PGL.Period = P.idPeriod
        LEFT JOIN EM_CurrencyCode_ISO4217 CUR ON CUR.MAPPED = I.ForeignCurrencyID
        LEFT JOIN Client C ON C.DCLink = I.AccountID
        LEFT JOIN EM_TddScope TDD ON C.ulARTDDScope = TDD.Mapped
        LEFT JOIN EM_ElectronicAddressScheme_Ces EEA ON C.ulARSchemeIdentifier = EEA.Mapped
        LEFT JOIN EM_State ST ON C.[ulARCountrySubdivision] = ST.Mapping
        LEFT JOIN EM_CountryCode CC ON C.ulARCountryCode = CC.Mapped
        LEFT JOIN EM_PaymentTypeCode PT ON I.ulIDSOrdPaymentmode = PT.Mapped
        LEFT JOIN [EM_GoodsServiceType] GST ON GST.Mapped = CASE WHEN I.DocType = 1 THEN I.[ulIDCrnRcmType] ELSE I.[ulIDSOrdRcmType] END
        LEFT JOIN [EM_VATExemptionReason] VER ON VER.Mapped = CASE WHEN I.DocType = 1 THEN I.[ulIDCrnExemptReason] ELSE I.[ulIDSOrdExemptReason] END
        LEFT JOIN EM_VATCategoryCode VC ON I.bTaxPerLine = VC.Mapped
        LEFT JOIN EM_InvoiceTransactionType ITT ON I.ulIDSOrdInvoiceTransactionType = ITT.Mapped
        LEFT JOIN EM_CreditNoteReason CRR ON I.ulIDCrnCreditNoteReason = CRR.Mapped
        LEFT JOIN [EM_CountryCode] DCO ON I.ulIDSOrdDeliveryCountry = DCO.Mapped
        LEFT JOIN [EM_ElectronicAddressScheme_Ces] DEA ON I.ulIDSOrdLocationSchemeID = DEA.Mapped
        OUTER APPLY (
            SELECT TOP (1) CONVERT(varchar(max), PA.cAllocs) AS cAllocs
            FROM PostAR PA
            WHERE PA.Reference = I.InvNumber
              AND I.DocType = 1
              AND PA.cAllocs IS NOT NULL
              AND CHARINDEX('I=', CONVERT(varchar(max), PA.cAllocs)) > 0
            ORDER BY PA.AutoIdx DESC
        ) CreditPostAR
        OUTER APPLY (
            SELECT TRY_CONVERT(
                int,
                SUBSTRING(
                    CreditPostAR.cAllocs,
                    CHARINDEX('I=', CreditPostAR.cAllocs) + 2,
                    CHARINDEX(';', CreditPostAR.cAllocs + ';', CHARINDEX('I=', CreditPostAR.cAllocs))
                        - CHARINDEX('I=', CreditPostAR.cAllocs) - 2
                )
            ) AS AllocatedPostARAutoIdx
        ) CreditAllocation
        LEFT JOIN PostAR AllocatedPostAR ON AllocatedPostAR.AutoIdx = CreditAllocation.AllocatedPostARAutoIdx
        LEFT JOIN InvNum AllocatedInv ON AllocatedInv.InvNumber = AllocatedPostAR.Reference
        LEFT JOIN InvNum LinkedInv ON LinkedInv.AutoIndex = I.iLinkedDocID
        LEFT JOIN InvNum OrigInv ON OrigInv.AutoIndex = I.OrigDocID

        WHERE (${docFilter})
        AND I.DocState = 4
    `);

    const lineRows = await client.queryUnsafe(`
        SELECT
            I.InvNumber AS InvoiceNumber,
            I.AutoIndex AS ReferenceNumber,
            I.DocType AS DocType,
            IL.idInvoiceLines AS InvoiceLineIdentifier,
            IL.fQtyProcessed AS InvoicedQuantity,
            CASE WHEN I.ForeignCurrencyID <> 0 THEN IL.fQtyProcessedLineTotExclForeign ELSE IL.fQtyProcessedLineTotExcl END AS LineExtensionAmount,
            IL.cDescription AS ItemName,
            IL.cDescription AS ItemDescription,
            IL.cLineNotes AS InvoiceLineNote,
            stk.ucIIStandardIdentifier AS ItemStandardId,
            obj.Value AS ItemSchemeId,
            VIC.Value AS ItemVatCategory,
            VIC.Description AS ItemVatPrice,
            UOF.Value AS UOMCode,
            IL.fQtyProcessed AS ProcessedQuantity,
            CASE WHEN I.ForeignCurrencyID <> 0 THEN IL.fUnitPriceExclForeign ELSE IL.fUnitPriceExcl END AS PriceExcl,
            CASE WHEN I.ForeignCurrencyID <> 0 THEN IL.fQtyProcessedLineTotExclForeign ELSE IL.fQtyProcessedLineTotExcl END AS LineNet,
            CASE WHEN I.ForeignCurrencyID <> 0 THEN IL.fQtyProcessedLineTaxAmountForeign ELSE IL.fQtyProcessedLineTaxAmount END AS LineTax,
            CASE WHEN I.ForeignCurrencyID <> 0 THEN IL.fQtyProcessedLineTotInclForeign ELSE IL.fQtyProcessedLineTotIncl END AS LineTotal,
            CASE WHEN I.DocType = 1 THEN I.ucIDCrnDiscountReason ELSE I.ucIDSOrdDiscountReason END AS LineAllowReason,
            IL.fLineDiscount AS LineAllowPercent,
            CASE WHEN I.ForeignCurrencyID <> 0 THEN IL.fQtyProcessedLineTotExclNoDiscForeign ELSE IL.fQtyProcessedLineTotExclNoDisc END AS LineAllowBaseAmount,
            CASE WHEN I.ForeignCurrencyID <> 0 THEN (IL.fQtyProcessedLineTotExclNoDiscForeign - IL.fQtyProcessedLineTotExclForeign) ELSE (IL.fQtyProcessedLineTotExclNoDisc - IL.fQtyProcessedLineTotExcl) END AS LineAllowAmount
        FROM [InvNum] I
        INNER JOIN _btblInvoiceLines IL ON IL.iInvoiceID = I.AutoIndex
        LEFT JOIN [StkItem] stk ON IL.iStockCodeID = stk.StockLink
        LEFT JOIN [EM_ElectronicAddressScheme_Ces] obj ON stk.ulIIStandardScheme = obj.Mapped
        LEFT JOIN EM_VATCategoryCode VIC ON IL.iTaxTypeID = VIC.Mapped
        LEFT JOIN EM_UnitOfMeasure_UNECE UOF ON IL.iUnitsOfMeasureID = UOF.Mapped
        WHERE (${docFilter})
        AND I.DocState = 4
        AND CASE WHEN I.DocType = 1 THEN IL.ubIDCrnTxCMCharges ELSE IL.ubIDSOrdTxCMCharges END = 0
    `);

    const chargeRows = await client.queryUnsafe(`
        SELECT
            I.AutoIndex AS ReferenceNumber,
            1 AS HasDocumentCharges,
            MAX(ch.Value) AS DocChargeReasonCode,
            MAX(ch.DisplayName) AS DocChargeReason,
            SUM(CASE WHEN I.ForeignCurrencyID <> 0 THEN IL.fQtyProcessedLineTotExclForeign ELSE IL.fQtyProcessedLineTotExcl END) AS DocChargeAmount,
            SUM(CASE WHEN I.ForeignCurrencyID <> 0 THEN IL.fQtyProcessedLineTaxAmountForeign ELSE IL.fQtyProcessedLineTaxAmount END) AS DocChargeTaxAmount,
            SUM(CASE WHEN I.ForeignCurrencyID <> 0 THEN IL.fQtyProcessedLineTotInclForeign ELSE IL.fQtyProcessedLineTotIncl END) AS DocChargeTotalAmount,
            SUM(IL.fQtyProcessedLineTaxAmount) AS DocChargeTaxAmountCurrency,
            MAX(VIC.Value) AS DocChargeVatCategory,
            MAX(VIC.Description) AS DocChargeVatRate
        FROM [InvNum] I
        INNER JOIN _btblInvoiceLines IL ON IL.iInvoiceID = I.AutoIndex
        LEFT JOIN EM_ChargeCode ch ON CASE WHEN I.DocType = 1 THEN I.ulIDCrnChargesReason ELSE I.ulIDSOrdChargesReason END = ch.Mapped
        LEFT JOIN EM_VATCategoryCode VIC ON IL.iTaxTypeID = VIC.Mapped
        WHERE (${docFilter})
        AND I.DocState = 4
        AND CASE WHEN I.DocType = 1 THEN IL.ubIDCrnTxCMCharges ELSE IL.ubIDSOrdTxCMCharges END = 1
        GROUP BY I.AutoIndex
    `);

    const seller = sellerRows[0] || {};
    const headerMap = new Map(
        headerRows.map((row) => [row.ReferenceNumber, row])
    );
    const chargeMap = new Map(
        chargeRows.map((row) => [row.ReferenceNumber, row])
    );
    const chargeVatLineMap = new Map();
    lineRows.forEach((line) => {
        const charge = chargeMap.get(line.ReferenceNumber);
        if (!charge || chargeVatLineMap.has(line.ReferenceNumber)) return;

        const chargeCategory = toDbString(charge.DocChargeVatCategory);
        const lineCategory = toDbString(line.ItemVatCategory);
        const chargeRate = toDecimal(charge.DocChargeVatRate, null);
        const lineRate = toDecimal(line.ItemVatPrice, null);
        const categoryMatches = !chargeCategory || !lineCategory || chargeCategory === lineCategory;
        const rateMatches = chargeRate === null || lineRate === null || chargeRate === lineRate;

        if (categoryMatches && rateMatches) {
            chargeVatLineMap.set(line.ReferenceNumber, line.InvoiceLineIdentifier);
        }
    });
    lineRows.forEach((line) => {
        if (!chargeMap.has(line.ReferenceNumber) || chargeVatLineMap.has(line.ReferenceNumber)) return;
        chargeVatLineMap.set(line.ReferenceNumber, line.InvoiceLineIdentifier);
    });

    return lineRows
        .map((line) => {
            const header = headerMap.get(line.ReferenceNumber);
            if (!header) return null;

            const charge = chargeMap.get(line.ReferenceNumber);
            const hasDocumentCharges = Boolean(charge);
            const applyDocumentChargeToVatBreakdown = hasDocumentCharges
                && chargeVatLineMap.get(line.ReferenceNumber) === line.InvoiceLineIdentifier;
            const vatCatTaxableAmtTotal = hasDocumentCharges
                ? toDecimal(header.InvTotExclDEx) - toDecimal(charge.DocChargeAmount)
                : toDecimal(header.InvTotExclDEx);
            const docChargeBaseAmount = hasDocumentCharges
                ? toDecimal(header.InvTotExcl) - toDecimal(charge.DocChargeAmount)
                : null;
            const docChargePercent = hasDocumentCharges
                ? calculatePercent(charge.DocChargeAmount, docChargeBaseAmount)
                : null;

            return {
                ...header,
                ...line,
                ...seller,
                ...(hasDocumentCharges ? {
                    HasDocumentCharges: charge.HasDocumentCharges,
                    DocChargeReasonCode: charge.DocChargeReasonCode,
                    DocChargeReason: charge.DocChargeReason,
                    DocChargePercent: docChargePercent,
                    DocChargeAmount: charge.DocChargeAmount,
                    DocChargeTaxAmount: charge.DocChargeTaxAmount,
                    DocChargeBaseAmount: docChargeBaseAmount,
                    DocChargeVatCategory: charge.DocChargeVatCategory || line.ItemVatCategory,
                    DocChargeVatRate: charge.DocChargeVatRate || line.ItemVatPrice,
                    TotalDocCharges: charge.DocChargeAmount
                } : {}),
                ApplyDocumentChargeToVatBreakdown: applyDocumentChargeToVatBreakdown ? 1 : 0,
                VatCatTaxableAmtTotal: vatCatTaxableAmtTotal
            };
        })
        .filter(Boolean);
};

const upsertInvoiceRow = async (client = db, row) => {
    const decimals = buildDecimalValues(row);
    const beneficiaryId = toDbString(row.BeneficiaryId);
    const hasDocumentAllowance = decimals.doc_allow_percent > 0;
    const docAllowPercent = hasDocumentAllowance ? decimals.doc_allow_percent : null;
    const docAllowAmount = hasDocumentAllowance ? decimals.doc_allow_amount : null;
    const docAllowBaseAmount = hasDocumentAllowance ? decimals.doc_allow_base_amount : null;
    const docAllowVatRate = hasDocumentAllowance ? decimals.doc_allow_vat_rate : null;
    const docAllowReason = hasDocumentAllowance ? row.DocAllowReason : null;
    const docAllowVatCatCode = hasDocumentAllowance
        ? decimals.doc_allow_vat_rate === 5 ? "S" : "Z"
        : null;
    const docAllowVatExemptCode = hasDocumentAllowance ? row.DocAllowVatExemptCode : null;
    const docAllowVatExemptText = hasDocumentAllowance ? row.DocAllowVatExemptText : null;
    const docAllowTaxSchemeCode = hasDocumentAllowance ? VAT_TAX_SCHEME_CODE : null;
    const hasDocumentCharges = Number(row.HasDocumentCharges) === 1
        || decimals.doc_charge_amount > 0
        || decimals.total_doc_charges > 0;
    const docChargeVatCatCode = row.DocChargeVatCategory || row.ItemVatCategory;
    const syntaxBindingQualifier = decimals.doc_allow_percent > 0 ? "false" : null;
    const docChargeIndicator = decimals.doc_charge_percent > 0 ? "true" : null;
    const hasLineAllowance = decimals.line_allow_percent > 0;
    const lineChargeIndicator = hasLineAllowance ? false : null;
    const lineAllowReason = hasLineAllowance ? row.LineAllowReason : null;

    await client.execute`
        IF EXISTS (
            SELECT 1 FROM E_Invoicing WITH (UPDLOCK, HOLDLOCK)
            WHERE InvoiceLineid = ${row.InvoiceLineIdentifier}
               OR invoice_line_id = ${row.InvoiceLineIdentifier}
        )
        BEGIN
            UPDATE E_Invoicing
            SET invoice_issue_date = ${row.InvoiceIssueDate},
                vat_tax_point_date = ${row.InvoiceIssueDate},
                actual_delivery_date = ${row.ActualDeliveryDate},
                deliver_to_addr_line1 = ${row.DeliverToAddrLine1},
                deliver_to_addr_line2 = ${row.DeliverToAddrLine2},
                deliver_to_addr_line3 = ${row.DeliverToAddrLine3},
                deliver_to_city = ${row.DeliverToCity},
                deliver_to_post_code = ${row.DeliverToPostCode},
                deliver_to_scheme_id = ${row.DeliverToSchemeId},
                deliver_to_location_id = ${row.DeliverToLocationId},
                deliver_to_country_code = ${row.DeliverToCountryCode},
                deliver_to_country_subdivision = ${row.DeliverToCountrySubdivision},
                deliver_to_party_name = ${row.DeliverToPartyName},
                deliver_to_party_id = ${row.DeliverToPartyId},
                invoice_issue_time = ${row.InvoiceIssueTime},
                invoice_period_start = ${row.InvoicePeriodStart},
                invoice_period_end = ${row.InvoicePeriodEnd},
                invoice_no = ${row.InvoiceNumber},
                payment_due_date = ${row.InvoicePaymentDueDate},
                spec_identifier = ${SPEC_IDENTIFIER},
                business_process_type = ${BUSINESS_PROCESS_TYPE},
                invoice_type_code = ${getInvoiceTypeCode(row.DocType)},
                invoice_currency_code = ${row.InvoiceCurrencyCode},
                tax_account_currency = ${row.TaxAccountCurrency},
                invoice_obj_identifier = ${row.InvoiceObjIdentifier},
                invoice_doc_type_code = ${row.InvoiceDocTypeCode},
                invocie_doc_description = ${row.InvocieDocDescription},
                source_currency_code = ${row.SourceCurrencyCode},
                target_currency_code = ${row.TargetCurrencyCode},
                syntax_binding_qualifier = ${syntaxBindingQualifier},
                invoice_txn_type_code = ${row.TransactionCode},
                TddScope = ${row.TddScope},
                credit_note_reason_code = ${row.CreditNoteReasonCode},
                preceding_invoice_ref = ${row.PrecedingInvoiceRef},
                preceding_invoice_date = ${row.PrecedingInvoiceDate},
                buyer_elec_address = ${row.BuyerElectronicAddress},
                buyer_elec_scheme_id = ${row.BuyerElectronicSchemeId},
                buyer_id = ${row.BuyerId},
                buyer_scheme_id = ${row.BuyerSchemeId},
                buyer_trade_name = ${row.BuyerTradeName},
                buyer_name = ${row.BuyerName},
                buyer_addr_line1 = ${row.BuyerAddressline1},
                buyer_addr_line2 = ${row.BuyerAddressline2},
                buyer_addr_line3 = ${row.BuyerAddressline3},
                buyer_city = ${row.BuyerCity},
                buyer_post_code = ${row.BuyerPostCode},
                buyer_country_subdivision = ${row.BuyerCountrySubdivision},
                buyer_country_code = ${row.BuyerCountry},
                buyer_vat_id = ${row.BuyerVatId},
                buyer_tax_scheme_code = ${row.BuyerTaxSchemeCode},
                buyer_legal_reg_id = ${row.BuyerLegalRegistrationId},
                buyer_legal_scheme_id = ${row.BuyerLegalSchemeId},
                buyer_authority_name = ${row.BuyerAuthorityName},
                buyer_passport_country_code = ${row.BuyerPassportCountryCode},
                buyer_legal_reg_type = ${row.BuyerLegalRegistrationType},
                buyer_contact_point = ${row.BuyerContactPoint},
                buyer_contact_phone = ${row.BuyerContactPhone},
                buyer_contact_email = ${row.BuyerContactEmail},
                payee_id = ${row.PayeeId},
                payee_scheme_id = ${row.PayeeSchemeId},
                payee_name = ${row.PayeeName},
                payee_legal_reg_id = ${row.PayeeLegalRegId},
                payee_legal_scheme_id = ${row.PayeeLegalSchemeId},
                principle_id = ${row.PrincipleId},
                beneficiary_id = ${beneficiaryId},
                payment_means_type_code = ${row.PaymentType},
                goods_service_type = ${row.GoodsServiceType},
                vat_exempt_reason_code = ${row.VatExemptReasonCode},
                vat_exempt_reason_text = ${row.VatExemptReasonText},
                vat_cat_code = ${row.ItemVatCategory},
                vat_cat_tax_scheme_code = ${VAT_TAX_SCHEME_CODE},
                contract_value = ${decimals.contract_value},
                doc_allow_reason = ${docAllowReason},
                doc_allow_percent = ${docAllowPercent},
                doc_allow_amount = ${docAllowAmount},
                doc_allow_base_amount = ${docAllowBaseAmount},
                doc_allow_vat_cat_code = ${docAllowVatCatCode},
                doc_allow_vat_rate = ${docAllowVatRate},
                doc_allow_vat_exempt_code = ${docAllowVatExemptCode},
                doc_allow_vat_exempt_text = ${docAllowVatExemptText},
                doc_allow_tax_scheme_code = ${docAllowTaxSchemeCode},
                doc_charge_indicator = ${docChargeIndicator},
                doc_charge_percent = ${decimals.doc_charge_percent},
                doc_charge_amount = ${decimals.doc_charge_amount},
                doc_charge_base_amount = ${decimals.doc_charge_base_amount},
                doc_charge_vat_rate = ${decimals.doc_charge_vat_rate},
                doc_charge_reason_code = ${row.DocChargeReasonCode},
                doc_charge_reason = ${row.DocChargeReason},
                doc_charge_vat_cat_code = ${docChargeVatCatCode},
                calculation_rate = ${decimals.calculation_rate},
                total_doc_allowances = ${decimals.total_doc_allowances},
                total_doc_charges = ${decimals.total_doc_charges},
                paid_amount = ${decimals.paid_amount},
                rounding_amount = ${decimals.rounding_amount},
                InvoiceLineid = ${row.InvoiceLineIdentifier},
                invoice_line_id = ${row.InvoiceLineIdentifier},
                invoice_line_note = ${row.InvoiceLineNote},
                invoiced_qty = ${decimals.invoiced_qty},
                invoice_line_net_amt = ${decimals.invoice_line_net_amt},
                charge_indicator = ${lineChargeIndicator},
                line_allow_percent = ${decimals.line_allow_percent},
                line_allow_amount = ${decimals.line_allow_amount},
                line_allow_base_amount = ${decimals.line_allow_base_amount},
                line_allow_reason = ${lineAllowReason},
                line_charge_percent = ${decimals.line_charge_percent},
                line_charge_amount = ${decimals.line_charge_amount},
                line_charge_base_amount = ${decimals.line_charge_base_amount},
                item_name = ${row.ItemName},
                item_description = ${row.ItemDescription},
                item_standard_id = ${row.ItemStandardId},
                item_scheme_id = ${row.ItemSchemeId},
                item_vat_cat_code = ${row.ItemVatCategory},
                item_vat_rate = ${decimals.item_vat_rate},
                item_tax_scheme = ${VAT_TAX_SCHEME_CODE},
                invoiced_qty_uom_code = ${row.UOMCode},
                item_net_price = ${toDecimal(row.PriceExcl)},
                item_price_base_qty = ${decimals.item_price_base_qty},
                item_price_discount = ${decimals.item_price_discount},
                item_gross_price = ${decimals.item_gross_price},
                seller_elec_address = ${row.SellerElectronicAddress},
                seller_elec_scheme_id = ${row.SellerElectronicSchemeId},
                seller_id = ${row.SellerId},
                seller_scheme_id = ${row.SellerSchemeId},
                seller_trade_name = ${row.SellerTradeName},
                seller_name = ${row.SellerName},
                seller_addr_line1 = ${row.SellerAddressline1},
                seller_addr_line2 = ${row.SellerAddressline2},
                seller_addr_line3 = ${row.SellerAddressline3},
                seller_city = ${row.SellerCity},
                seller_post_code = ${row.SellerPostCode},
                seller_country_subdivision = ${row.SellerCountrySubdivision},
                seller_country_code = ${row.SellerCountryCode},
                seller_vat_id = ${row.SellerVatId},
                seller_tax_scheme_code = ${row.SellerTaxSchemeCode},
                seller_legal_reg_id = ${row.SellerLegalRegistrationId},
                seller_legal_scheme_id = ${row.SellerLegalSchemeId},
                seller_authority_name = ${row.SellerAuthorityName},
                seller_passport_country_code = ${row.SellerPassportCountryCode},
                seller_legal_reg_type = ${row.SellerLegalRegistrationType},
                seller_contact_point = ${row.SellerContactPoint},
                seller_contact_email = ${row.SellerContactEmail},
                seller_contact_phone = ${row.SellerContactPhone},
                invoice_line_net_total = ${decimals.invoice_line_net_total},
                invoice_total_without_tax = ${decimals.invoice_total_without_tax},
                invoice_total_tax_amt = ${decimals.invoice_total_tax_amt},
                invoice_total_with_tax = ${decimals.invoice_total_with_tax},
                invoice_total_vat_tax_currency = ${decimals.invoice_total_vat_tax_currency},
                invoice_line_amt_aed = ${decimals.invoice_line_amt_aed},
                vat_line_amt_aed = ${decimals.vat_line_amt_aed},
                amount_due = ${decimals.amount_due},
                vat_cat_taxable_amt = ${decimals.vat_cat_taxable_amt},
                vat_cat_tax_amt = ${decimals.vat_cat_tax_amt},
                vat_cat_rate = ${decimals.vat_cat_rate},
                DocType = ${row.DocType},
                EInvoiceType = ${row.EInvoiceType},
                updated_at = GETDATE()
            WHERE InvoiceLineid = ${row.InvoiceLineIdentifier}
               OR invoice_line_id = ${row.InvoiceLineIdentifier}
        END
        ELSE
        BEGIN
            INSERT INTO E_Invoicing (
                unique_identifier_no,
                invoice_issue_date,
                vat_tax_point_date,
                actual_delivery_date,
                invoice_issue_time,
                invoice_period_start,
                invoice_period_end,
                invoice_no,
                payment_due_date,
                spec_identifier,
                business_process_type,
                invoice_type_code,
                deliver_to_addr_line1,
                deliver_to_addr_line2,
                deliver_to_addr_line3,
                deliver_to_city,
                deliver_to_post_code,
                deliver_to_scheme_id,
                deliver_to_location_id,
                deliver_to_country_code,
                deliver_to_country_subdivision,
                deliver_to_party_name,
                deliver_to_party_id,
                invoice_currency_code,
                tax_account_currency,
                invoice_obj_identifier,
                invoice_doc_type_code,
                invocie_doc_description,
                source_currency_code,
                target_currency_code,
                syntax_binding_qualifier,
                invoice_txn_type_code,
                TddScope,
                credit_note_reason_code,
                preceding_invoice_ref,
                preceding_invoice_date,
                buyer_elec_address,
                buyer_elec_scheme_id,
                buyer_id,
                buyer_scheme_id,
                buyer_trade_name,
                buyer_name,
                buyer_addr_line1,
                buyer_addr_line2,
                buyer_addr_line3,
                buyer_city,
                buyer_post_code,
                buyer_country_subdivision,
                buyer_country_code,
                buyer_vat_id,
                buyer_tax_scheme_code,
                buyer_legal_reg_id,
                buyer_legal_scheme_id,
                buyer_authority_name,
                buyer_passport_country_code,
                buyer_legal_reg_type,
                buyer_contact_point,
                buyer_contact_phone,
                buyer_contact_email,
                payee_id,
                payee_scheme_id,
                payee_name,
                payee_legal_reg_id,
                payee_legal_scheme_id,
                principle_id,
                beneficiary_id,
                payment_means_type_code,
                goods_service_type,
                vat_exempt_reason_code,
                vat_exempt_reason_text,
                vat_cat_code,
                vat_cat_tax_scheme_code,
                contract_value,
                doc_allow_reason,
                doc_allow_percent,
                doc_allow_amount,
                doc_allow_base_amount,
                doc_allow_vat_cat_code,
                doc_allow_vat_rate,
                doc_allow_vat_exempt_code,
                doc_allow_vat_exempt_text,
                doc_allow_tax_scheme_code,
                doc_charge_indicator,
                doc_charge_percent,
                doc_charge_amount,
                doc_charge_base_amount,
                doc_charge_vat_rate,
                doc_charge_reason_code,
                doc_charge_reason,
                doc_charge_vat_cat_code,
                calculation_rate,
                total_doc_allowances,
                total_doc_charges,
                paid_amount,
                rounding_amount,
                InvoiceLineid,
                invoice_line_id,
                invoice_line_note,
                invoiced_qty,
                invoice_line_net_amt,
                charge_indicator,
                line_allow_percent,
                line_allow_amount,
                line_allow_base_amount,
                line_allow_reason,
                line_charge_percent,
                line_charge_amount,
                line_charge_base_amount,
                item_name,
                item_description,
                item_standard_id,
                item_scheme_id,
                item_vat_cat_code,
                item_vat_rate,
                item_tax_scheme,
                invoiced_qty_uom_code,
                item_net_price,
                item_price_base_qty,
                item_price_discount,
                item_gross_price,
                seller_elec_address,
                seller_elec_scheme_id,
                seller_id,
                seller_scheme_id,
                seller_trade_name,
                seller_name,
                seller_addr_line1,
                seller_addr_line2,
                seller_addr_line3,
                seller_city,
                seller_post_code,
                seller_country_subdivision,
                seller_country_code,
                seller_vat_id,
                seller_tax_scheme_code,
                seller_legal_reg_id,
                seller_legal_scheme_id,
                seller_authority_name,
                seller_passport_country_code,
                seller_legal_reg_type,
                seller_contact_point,
                seller_contact_email,
                seller_contact_phone,
                invoice_line_net_total,
                invoice_total_without_tax,
                invoice_total_tax_amt,
                invoice_total_with_tax,
                invoice_total_vat_tax_currency,
                invoice_line_amt_aed,
                vat_line_amt_aed,
                amount_due,
                vat_cat_taxable_amt,
                vat_cat_tax_amt,
                vat_cat_rate,
                DocType,
                EInvoiceType,
                created_at,
                updated_at
            )
            VALUES (
                ${row.ReferenceNumber},
                ${row.InvoiceIssueDate},
                ${row.InvoiceIssueDate},
                ${row.ActualDeliveryDate},
                ${row.InvoiceIssueTime},
                ${row.InvoicePeriodStart},
                ${row.InvoicePeriodEnd},
                ${row.InvoiceNumber},
                ${row.InvoicePaymentDueDate},
                ${SPEC_IDENTIFIER},
                ${BUSINESS_PROCESS_TYPE},
                ${getInvoiceTypeCode(row.DocType)},
                ${row.DeliverToAddrLine1},
                ${row.DeliverToAddrLine2},
                ${row.DeliverToAddrLine3},
                ${row.DeliverToCity},
                ${row.DeliverToPostCode},
                ${row.DeliverToSchemeId},
                ${row.DeliverToLocationId},
                ${row.DeliverToCountryCode},
                ${row.DeliverToCountrySubdivision},
                ${row.DeliverToPartyName},
                ${row.DeliverToPartyId},
                ${row.InvoiceCurrencyCode},
                ${row.TaxAccountCurrency},
                ${row.InvoiceObjIdentifier},
                ${row.InvoiceDocTypeCode},
                ${row.InvocieDocDescription},
                ${row.SourceCurrencyCode},
                ${row.TargetCurrencyCode},
                ${syntaxBindingQualifier},
                ${row.TransactionCode},
                ${row.TddScope},
                ${row.CreditNoteReasonCode},
                ${row.PrecedingInvoiceRef},
                ${row.PrecedingInvoiceDate},
                ${row.BuyerElectronicAddress},
                ${row.BuyerElectronicSchemeId},
                ${row.BuyerId},
                ${row.BuyerSchemeId},
                ${row.BuyerTradeName},
                ${row.BuyerName},
                ${row.BuyerAddressline1},
                ${row.BuyerAddressline2},
                ${row.BuyerAddressline3},
                ${row.BuyerCity},
                ${row.BuyerPostCode},
                ${row.BuyerCountrySubdivision},
                ${row.BuyerCountry},
                ${row.BuyerVatId},
                ${row.BuyerTaxSchemeCode},
                ${row.BuyerLegalRegistrationId},
                ${row.BuyerLegalSchemeId},
                ${row.BuyerAuthorityName},
                ${row.BuyerPassportCountryCode},
                ${row.BuyerLegalRegistrationType},
                ${row.BuyerContactPoint},
                ${row.BuyerContactPhone},
                ${row.BuyerContactEmail},
                ${row.PayeeId},
                ${row.PayeeSchemeId},
                ${row.PayeeName},
                ${row.PayeeLegalRegId},
                ${row.PayeeLegalSchemeId},
                ${row.PrincipleId},
                ${beneficiaryId},
                ${row.PaymentType},
                ${row.GoodsServiceType},
                ${row.VatExemptReasonCode},
                ${row.VatExemptReasonText},
                ${row.ItemVatCategory},
                ${VAT_TAX_SCHEME_CODE},
                ${decimals.contract_value},
                ${docAllowReason},
                ${docAllowPercent},
                ${docAllowAmount},
                ${docAllowBaseAmount},
                ${docAllowVatCatCode},
                ${docAllowVatRate},
                ${docAllowVatExemptCode},
                ${docAllowVatExemptText},
                ${docAllowTaxSchemeCode},
                ${docChargeIndicator},
                ${decimals.doc_charge_percent},
                ${decimals.doc_charge_amount},
                ${decimals.doc_charge_base_amount},
                ${decimals.doc_charge_vat_rate},
                ${row.DocChargeReasonCode},
                ${row.DocChargeReason},
                ${docChargeVatCatCode},
                ${decimals.calculation_rate},
                ${decimals.total_doc_allowances},
                ${decimals.total_doc_charges},
                ${decimals.paid_amount},
                ${decimals.rounding_amount},
                ${row.InvoiceLineIdentifier},
                ${row.InvoiceLineIdentifier},
                ${row.InvoiceLineNote},
                ${decimals.invoiced_qty},
                ${decimals.invoice_line_net_amt},
                ${lineChargeIndicator},
                ${decimals.line_allow_percent},
                ${decimals.line_allow_amount},
                ${decimals.line_allow_base_amount},
                ${lineAllowReason},
                ${decimals.line_charge_percent},
                ${decimals.line_charge_amount},
                ${decimals.line_charge_base_amount},
                ${row.ItemName},
                ${row.ItemDescription},
                ${row.ItemStandardId},
                ${row.ItemSchemeId},
                ${row.ItemVatCategory},
                ${decimals.item_vat_rate},
                ${VAT_TAX_SCHEME_CODE},
                ${row.UOMCode},
                ${toDecimal(row.PriceExcl)},
                ${decimals.item_price_base_qty},
                ${decimals.item_price_discount},
                ${decimals.item_gross_price},
                ${row.SellerElectronicAddress},
                ${row.SellerElectronicSchemeId},
                ${row.SellerId},
                ${row.SellerSchemeId},
                ${row.SellerTradeName},
                ${row.SellerName},
                ${row.SellerAddressline1},
                ${row.SellerAddressline2},
                ${row.SellerAddressline3},
                ${row.SellerCity},
                ${row.SellerPostCode},
                ${row.SellerCountrySubdivision},
                ${row.SellerCountryCode},
                ${row.SellerVatId},
                ${row.SellerTaxSchemeCode},
                ${row.SellerLegalRegistrationId},
                ${row.SellerLegalSchemeId},
                ${row.SellerAuthorityName},
                ${row.SellerPassportCountryCode},
                ${row.SellerLegalRegistrationType},
                ${row.SellerContactPoint},
                ${row.SellerContactEmail},
                ${row.SellerContactPhone},
                ${decimals.invoice_line_net_total},
                ${decimals.invoice_total_without_tax},
                ${decimals.invoice_total_tax_amt},
                ${decimals.invoice_total_with_tax},
                ${decimals.invoice_total_vat_tax_currency},
                ${decimals.invoice_line_amt_aed},
                ${decimals.vat_line_amt_aed},
                ${decimals.amount_due},
                ${decimals.vat_cat_taxable_amt},
                ${decimals.vat_cat_tax_amt},
                ${decimals.vat_cat_rate},
                ${row.DocType},
                ${row.EInvoiceType},
                GETDATE(),
                GETDATE()
            )
        END
    `;
};

const markQueueInvoiced = async (client = db, queueData) => {
    if (!queueData.length) return;
    const queueClause = queueData.map((q) => Number(q.QueueID)).join(",");
    await client.executeUnsafe(`
        UPDATE E_InvoiceQueue
        SET IsInvoiced = 1,
            IsProcessing = 0,
            InvoicedAt = GETDATE(),
            Status = '1'
        WHERE QueueID IN (${queueClause})
    `);
};

const releaseQueueEntries = async (client = db, queueData) => {
    if (!queueData.length) return;
    const queueClause = queueData.map((q) => Number(q.QueueID)).join(",");
    await client.executeUnsafe(`
        UPDATE E_InvoiceQueue
        SET IsProcessing = 0
        WHERE QueueID IN (${queueClause})
    `);
};

const releaseStuckQueue = async (client = db) => {
    await client.execute`
        UPDATE E_InvoiceQueue
        SET IsProcessing = 0,
            Status = '0'
        WHERE IsProcessing = 1 AND IsInvoiced = 0
    `;
};

module.exports = {
    lockPendingQueue,
    fetchInvoiceSourceRows,
    upsertInvoiceRow,
    markQueueInvoiced,
    releaseQueueEntries,
    releaseStuckQueue
};
