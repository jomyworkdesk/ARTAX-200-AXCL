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
    buildAdditionalDocumentReferences,
    buildLineAllowanceCharge,
    buildStandardBusinessDocumentHeader,
    buildDeliveryAndParties,
    buildDocumentTotals,
    buildItemBlock,
    serializeDocuments
} = require("./ublXmlBuilderCommon");

const CREDIT_NOTE_NS = "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2";
const DEFAULT_TRANSACTION_TYPE_CODE = "00000000";

const CREDIT_NOTE_PROFILE = {
    standard: "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2",
    type: "CreditNote",
    documentTypeId:
        "urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2::CreditNote##urn:peppol:pint:billing-1@ae-1::2.1"
};

const buildBillingReference = (h) => {
    const creditNoteReasonCode = firstFilled(
        h.credit_note_reason_code,
        h.CreditNoteReasonCode
    );
    const precedingInvoiceRef = firstFilled(h.preceding_invoice_ref, h.PrecedingInvoiceRef);
    const precedingInvoiceDate = firstFilled(h.preceding_invoice_date, h.PrecedingInvoiceDate);

    if (String(creditNoteReasonCode || "").trim().toUpperCase() === "VD") return {};
    if (!hasValue(precedingInvoiceRef)) return {};

    return {
        "cac:BillingReference": {
            "cac:InvoiceDocumentReference": {
                "cbc:ID": text(precedingInvoiceRef),
                "cbc:IssueDate": dateText(precedingInvoiceDate)
            }
        }
    };
};

const buildDiscrepancyResponse = (h) => {
    const creditNoteReasonCode = firstFilled(
        h.credit_note_reason_code,
        h.CreditNoteReasonCode
    );

    if (!hasValue(creditNoteReasonCode)) return {};

    return {
        "cac:DiscrepancyResponse": {
            "cbc:ResponseCode": text(creditNoteReasonCode)
        }
    };
};

const buildCreditNoteLine = (line, h) => ({
    "cac:CreditNoteLine": {
        "cbc:ID": text(line.invoice_line_id),
        "cbc:Note": text(line.invoice_line_note),
        "cbc:CreditedQuantity": {
            "@unitCode": text(line.invoiced_qty_uom_code),
            "#": text(line.invoiced_qty)
        },
        ...currencyNode("cbc:LineExtensionAmount", line.invoice_line_net_amt, h.invoice_currency_code),
        "cac:TaxTotal": {
            ...currencyNode("cbc:TaxAmount", line.vat_line_amt_aed, h.invoice_currency_code)
        },
        "cbc:AccountingCost": text(line.invoice_line_buyer_acc_ref),
        ...(hasValue(line.invoice_line_obj_id) ? { "cac:OrderLineReference": {
            "cbc:LineID": text(line.invoice_line_obj_id)
        } } : {}),
        ...(hasValue(line.invoice_line_obj_id) || hasValue(h.document_type_code) ? { "cac:DocumentReference": {
            ...optionalSchemeNode("cbc:ID", line.invoice_line_obj_id, line.invoice_line_scheme_id),
            "cbc:DocumentTypeCode": text(h.document_type_code)
        } } : {}),
        "cac:AllowanceCharge": compact([
            buildLineAllowanceCharge(line, true, h.invoice_currency_code)?.["cac:AllowanceCharge"],
            buildLineAllowanceCharge(line, false, h.invoice_currency_code)?.["cac:AllowanceCharge"]
        ]),
        ...buildItemBlock(line, h)
    }
});

const buildCreditNoteDocument = ({ header: h, lines }) => {
    const uniqueInstanceIdentifier = generateInstanceIdentifier(h.invoice_no, h.invoice_issue_date);

    return {
        "StandardBusinessDocument": {
            "@xmlns": SBDH_NS,
            "@xmlns:xsi": XSI_NS,
            "@xsi:schemaLocation": `${SBDH_NS} https://docs.peppol.eu/poacc/billing/3.0/files/xsd/openpeppol-sbdh-1.3.xsd`,
            ...buildStandardBusinessDocumentHeader(CREDIT_NOTE_PROFILE, uniqueInstanceIdentifier, h),
            CreditNote: {
                "@xmlns:cac": CAC_NS,
                "@xmlns:cbc": CBC_NS,
                "@xmlns": CREDIT_NOTE_NS,
                "cbc:CustomizationID": text(fallback(h.spec_identifier, "urn:peppol:pint:billing-1@ae-1")),
                "cbc:ProfileID": text(fallback(h.business_process_type, "urn:peppol:bis:billing")),
                "cbc:ProfileExecutionID": text(firstFilled(
                    h.invoice_txn_type_code,
                    h.TransactionCode,
                    h.transaction_code,
                    h.syntax_binding_qualifier,
                    DEFAULT_TRANSACTION_TYPE_CODE
                )),
                "cbc:ID": text(h.invoice_no),
                "cbc:UUID": text(h.unique_identifier_no || randomUUID()),
                "cbc:IssueDate": dateText(h.invoice_issue_date),
                "cbc:IssueTime": timeText(h.invoice_issue_time),
                "cbc:CreditNoteTypeCode": text(fallback(h.invoice_type_code, "381")),
                "cbc:Note": text(h.invoice_note),
                "cbc:DocumentCurrencyCode": text(h.invoice_currency_code),
                ...(isForeignCurrencyDocument(h) && hasValue(h.tax_account_currency)
                    ? { "cbc:TaxCurrencyCode": text(fallback(h.tax_account_currency, "AED")) }
                    : {}),
                "cbc:AccountingCost": text(h.buyer_account_ref),
                "cbc:BuyerReference": text(h.buyer_reference),
                "cac:InvoicePeriod": {
                    "cbc:StartDate": dateText(h.invoice_period_start),
                    "cbc:EndDate": dateText(h.invoice_period_end),
                    "cbc:Description": text(h.billing_frequency)
                },
                ...buildDiscrepancyResponse(h),
                "cac:OrderReference": {
                    "cbc:ID": text(h.purchase_order_ref),
                    "cbc:SalesOrderID": text(h.sales_order_ref)
                },
                ...buildBillingReference(h),
                ...(hasValue(h.despatch_advice_ref) ? { "cac:DespatchDocumentReference": { "cbc:ID": text(h.despatch_advice_ref) } } : {}),
                ...(hasValue(h.receiving_advice_ref) ? { "cac:ReceiptDocumentReference": { "cbc:ID": text(h.receiving_advice_ref) } } : {}),
                ...(hasValue(h.customs_ref_no) ? { "cac:StatementDocumentReference": { "cbc:ID": text(h.customs_ref_no) } } : {}),
                ...(hasValue(h.originator_doc_ref)
                    ? { "cac:OriginatorDocumentReference": { "cbc:ID": text(h.originator_doc_ref) } }
                    : {}),
                ...(hasValue(h.contract_ref) ? { "cac:ContractDocumentReference": {
                    "cbc:ID": text(h.contract_ref),
                    "cbc:DocumentDescription": text(h.contract_value)
                } } : {}),
                "cac:AdditionalDocumentReference": buildAdditionalDocumentReferences(h),
                ...(hasValue(h.project_ref)
                    ? { "cac:ProjectReference": { "cbc:ID": text(h.project_ref) } }
                    : {}),
                ...buildDeliveryAndParties(h),
                "cac:PaymentTerms": {
                    "cbc:Note": text(h.payment_terms)
                },
                ...buildDocumentTotals(h, { includeTaxIncludedIndicator: false, lines }),
                "cac:CreditNoteLine": lines.map((line) => buildCreditNoteLine(line, h)["cac:CreditNoteLine"])
            }
        }
    };
};

const buildCreditNoteXml = (rows, emptyMessage = "No credit notes found") =>
    serializeDocuments(rows, buildCreditNoteDocument, emptyMessage);

module.exports = {
    buildCreditNoteXml
};
