const {
    SBDH_NS,
    XSI_NS,
    CAC_NS,
    CBC_NS,
    randomUUID,
    generateInstanceIdentifier,
    text,
    dateText,
    timeText,
    fallback,
    hasValue,
    compact,
    firstFilled,
    isForeignCurrencyDocument,
    optionalSchemeNode,
    currencyNode,
    defaultTaxPointDate,
    buildAdditionalDocumentReferences,
    buildLineAllowanceCharge,
    buildStandardBusinessDocumentHeader,
    buildDeliveryAndParties,
    buildDocumentTotals,
    buildItemBlock,
    serializeDocuments
} = require("./ublXmlBuilderCommon");

const {
    getSpecialHandling,
    getDefaultTaxCategory
} = require("./invoiceTransactionTypeBuilder");

const INVOICE_NS = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";

const INVOICE_PROFILE = {
    standard: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
    type: "Invoice",
    documentTypeId:
        "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:peppol:pint:billing-1@ae-1::2.1"
};

const PURCHASE_PROFILE = {
    standard: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
    type: "Invoice",
    documentTypeId:
        "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:peppol:pint:selfbilling-1@ae-1::2.1",
    processId: "urn:peppol:bis:selfbilling",
    senderPrefix: "buyer",
    receiverPrefix: "seller"
};

const isPurchaseDocument = (h) => Number(h.DocType ?? h.doc_type) === 5;

const buildInvoiceLine = (line, h) => {
    const txnTypeCode = getInvoiceTransactionTypeCode(h);
    const txnHandling = getSpecialHandling(txnTypeCode);
    const defaultTaxCategory = getDefaultTaxCategory(txnTypeCode);
    const effectiveLine = txnHandling.isMarginScheme
        ? {
            ...line,
            invoice_line_note: fallback(line.invoice_line_note),
            item_vat_cat_code: defaultTaxCategory,
            item_vat_rate: "5",
            vat_line_amt_aed: "0"
        }
        : line;

    return {
        "cac:InvoiceLine": {
            "cbc:ID": text(effectiveLine.invoice_line_id),
            "cbc:Note": text(effectiveLine.invoice_line_note),
            "cbc:InvoicedQuantity": {
                "@unitCode": text(effectiveLine.invoiced_qty_uom_code),
                "#": text(effectiveLine.invoiced_qty)
            },
            ...currencyNode("cbc:LineExtensionAmount", effectiveLine.invoice_line_net_amt, h.invoice_currency_code),
            "cbc:AccountingCost": text(effectiveLine.invoice_line_buyer_acc_ref),
            "cac:InvoicePeriod": {
                "cbc:StartDate": dateText(firstFilled(effectiveLine.invoice_line_period_start, h.invoice_period_start)),
                "cbc:EndDate": dateText(firstFilled(effectiveLine.invoice_line_period_end, h.invoice_period_end))
            },
            ...(hasValue(effectiveLine.invoice_line_obj_id) ? { "cac:OrderLineReference": {
                "cbc:LineID": text(effectiveLine.invoice_line_obj_id)
            } } : {}),
            ...(hasValue(effectiveLine.invoice_line_obj_id) || hasValue(h.document_type_code) ? { "cac:DocumentReference": {
                ...optionalSchemeNode("cbc:ID", effectiveLine.invoice_line_obj_id, effectiveLine.invoice_line_scheme_id),
                "cbc:DocumentTypeCode": text(h.document_type_code)
            } } : {}),
            "cac:AllowanceCharge": compact([
                buildLineAllowanceCharge(effectiveLine, true, h.invoice_currency_code)?.["cac:AllowanceCharge"],
                buildLineAllowanceCharge(effectiveLine, false, h.invoice_currency_code)?.["cac:AllowanceCharge"]
            ]),
            ...buildItemBlock(effectiveLine, h, defaultTaxCategory)
        }
    };
};

const getInvoiceTransactionTypeCode = (h) =>
    firstFilled(h.invoice_txn_type_code, h.TransactionCode, h.transaction_code, h.syntax_binding_qualifier);

const getSellerSupplierPartyId = (h) =>
    firstFilled(h.seller_supplier_party_id, h.seller_party_id, h.principle_id);

const getPaymentMeansTypeCode = (h) =>
    firstFilled(h.payment_means_type_code, h.payment_type_code, h.PaymentType);

const decimalValue = (value, defaultValue = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : defaultValue;
};

const decimalString = (value) => {
    const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
    return String(rounded);
};

const buildMarginSchemeHeader = (h, txnTypeCode) => {
    const taxExclusiveAmount = decimalValue(h.invoice_total_without_tax);
    const taxAmount = 0;
    const taxInclusiveAmount = taxExclusiveAmount + taxAmount;
    const prepaidAmount = decimalValue(h.paid_amount);
    const roundingAmount = decimalValue(h.rounding_amount);

    return {
        ...h,
        invoice_total_tax_amt: decimalString(taxAmount),
        vat_cat_tax_amt: decimalString(taxAmount),
        invoice_total_with_tax: decimalString(taxInclusiveAmount),
        amount_due: decimalString(taxInclusiveAmount - prepaidAmount + roundingAmount),
        vat_cat_code: getDefaultTaxCategory(txnTypeCode),
        vat_cat_rate: "5"
    };
};

const buildSellerSupplierParty = (h) =>
    getInvoiceTransactionTypeCode(h) === "00000100" && hasValue(getSellerSupplierPartyId(h))
        ? {
            "cac:SellerSupplierParty": {
                "cac:Party": {
                    "cac:PartyIdentification": {
                        ...optionalSchemeNode("cbc:ID", getSellerSupplierPartyId(h), h.seller_supplier_scheme_id)
                    },
                    ...(hasValue(h.seller_supplier_party_name)
                        ? {
                            "cac:PartyName": {
                                "cbc:Name": text(h.seller_supplier_party_name)
                            }
                        }
                        : {}),
                    ...(hasValue(h.seller_supplier_party_legal_id)
                        ? {
                            "cac:PartyLegalEntity": {
                                "cbc:CompanyID": {
                                    ...optionalSchemeNode("cbc:CompanyID", h.seller_supplier_party_legal_id, h.seller_supplier_party_legal_scheme_id)
                                }
                            }
                        }
                        : {})
                }
            }
        }
        : null;

const buildInvoiceDocument = ({ header: h, lines }) => {
    const sellerSupplierParty = buildSellerSupplierParty(h);
    const uniqueInstanceIdentifier = generateInstanceIdentifier(h.invoice_no, h.invoice_issue_date);
    const txnTypeCode = getInvoiceTransactionTypeCode(h);
    const txnHandling = getSpecialHandling(txnTypeCode);
    const effectiveHeader = txnHandling.isMarginScheme
        ? buildMarginSchemeHeader(h, txnTypeCode)
        : h;
    const isPurchase = isPurchaseDocument(effectiveHeader);
    const profile = isPurchase ? PURCHASE_PROFILE : INVOICE_PROFILE;

    return {

        "StandardBusinessDocument": {
            "@xmlns": SBDH_NS,
            "@xmlns:xsi": XSI_NS,
            "@xsi:schemaLocation": `${SBDH_NS} https://docs.peppol.eu/poacc/billing/3.0/files/xsd/openpeppol-sbdh-1.3.xsd`,
            ...buildStandardBusinessDocumentHeader(profile, uniqueInstanceIdentifier, effectiveHeader),
            "doc:Invoice": {
                "@xmlns:cac": CAC_NS,
                "@xmlns:cbc": CBC_NS,
                "@xmlns:doc": INVOICE_NS,
                "cbc:CustomizationID": text(effectiveHeader.spec_identifier),
                "cbc:ProfileID": text(effectiveHeader.business_process_type),
                "cbc:ProfileExecutionID": text(txnTypeCode),
                "cbc:ID": text(effectiveHeader.invoice_no),
                "cbc:UUID": text(effectiveHeader.unique_identifier_no),
                "cbc:IssueDate": dateText(effectiveHeader.invoice_issue_date),
                "cbc:IssueTime": timeText(effectiveHeader.invoice_issue_time),
                "cbc:DueDate": dateText(effectiveHeader.payment_due_date),
                "cbc:InvoiceTypeCode": text(effectiveHeader.invoice_type_code),
                "cbc:Note": text(effectiveHeader.invoice_note),
                "cbc:TaxPointDate": defaultTaxPointDate(effectiveHeader.vat_tax_point_date, effectiveHeader.invoice_issue_date),
                "cbc:DocumentCurrencyCode": text(effectiveHeader.invoice_currency_code),
                ...(isForeignCurrencyDocument(effectiveHeader) && hasValue(effectiveHeader.tax_account_currency)
                    ? { "cbc:TaxCurrencyCode": text(fallback(effectiveHeader.tax_account_currency, "AED")) }
                    : {}),
                "cbc:AccountingCost": text(effectiveHeader.buyer_account_ref),
                "cbc:BuyerReference": text(effectiveHeader.buyer_reference),
                "cac:InvoicePeriod": {
                    "cbc:StartDate": dateText(effectiveHeader.invoice_period_start),
                    "cbc:EndDate": dateText(effectiveHeader.invoice_period_end),
                    "cbc:Description": text(effectiveHeader.billing_frequency)
                },
                "cac:OrderReference": {
                    "cbc:ID": text(effectiveHeader.purchase_order_ref),
                    "cbc:SalesOrderID": text(effectiveHeader.sales_order_ref)
                },
                ...(hasValue(effectiveHeader.preceding_invoice_ref) ? { "cac:BillingReference": {
                    "cac:InvoiceDocumentReference": {
                        "cbc:ID": text(effectiveHeader.preceding_invoice_ref)
                    }
                } } : {}),
                ...(hasValue(effectiveHeader.despatch_advice_ref) ? { "cac:DespatchDocumentReference": { "cbc:ID": text(effectiveHeader.despatch_advice_ref) } } : {}),
                ...(hasValue(effectiveHeader.receiving_advice_ref) ? { "cac:ReceiptDocumentReference": { "cbc:ID": text(effectiveHeader.receiving_advice_ref) } } : {}),
                ...(hasValue(effectiveHeader.customs_ref_no) ? { "cac:StatementDocumentReference": { "cbc:ID": text(effectiveHeader.customs_ref_no) } } : {}),
                ...(hasValue(effectiveHeader.originator_doc_ref)
                    ? { "cac:OriginatorDocumentReference": { "cbc:ID": text(effectiveHeader.originator_doc_ref) } }
                    : {}),
                ...(hasValue(effectiveHeader.contract_ref) ? { "cac:ContractDocumentReference": {
                    "cbc:ID": text(effectiveHeader.contract_ref),
                    "cbc:DocumentDescription": text(effectiveHeader.contract_value)
                } } : {}),
                "cac:AdditionalDocumentReference": buildAdditionalDocumentReferences(effectiveHeader),
                ...(hasValue(effectiveHeader.project_ref)
                    ? { "cac:ProjectReference": { "cbc:ID": text(effectiveHeader.project_ref) } }
                    : {}),
                ...buildDeliveryAndParties(effectiveHeader),
                ...(sellerSupplierParty || {}),
                "cac:PaymentMeans": {
                    "cbc:PaymentMeansCode": {
                        "@name": text(effectiveHeader.payment_means_text),
                        "#": text(getPaymentMeansTypeCode(effectiveHeader))
                    },
                    ...optionalSchemeNode("cbc:PaymentID", effectiveHeader.remittance_info, effectiveHeader.remittance_scheme_id),
                    ...(hasValue(effectiveHeader.payment_card_no) && hasValue(effectiveHeader.payment_card_network_id)
                        ? {
                            "cac:CardAccount": {
                                "cbc:PrimaryAccountNumberID": text(effectiveHeader.payment_card_no),
                                "cbc:NetworkID": text(effectiveHeader.payment_card_network_id),
                                ...(hasValue(effectiveHeader.payment_card_holder_name)
                                    ? { "cbc:HolderName": text(effectiveHeader.payment_card_holder_name) }
                                    : {})
                            }
                        }
                        : {}),
                    "cac:PayeeFinancialAccount": {
                        ...optionalSchemeNode("cbc:ID", effectiveHeader.payment_account_id, effectiveHeader.payment_account_scheme_id),
                        "cbc:Name": text(effectiveHeader.payment_account_name),
                        "cac:FinancialInstitutionBranch": {
                            "cbc:ID": text(effectiveHeader.payment_service_provider_id)
                        }
                    }
                },
                "cac:PaymentTerms": {
                    "cbc:Note": text(effectiveHeader.payment_terms)
                },
                ...buildDocumentTotals(effectiveHeader, { includeTaxIncludedIndicator: true, lines }),
                "cac:InvoiceLine": lines.map((line) => buildInvoiceLine(line, effectiveHeader)["cac:InvoiceLine"])
            }
        }
    };
};

const buildInvoiceXml = (rows, emptyMessage = "No invoices found") =>
    serializeDocuments(rows, buildInvoiceDocument, emptyMessage);

module.exports = {
    buildInvoiceXml
};
