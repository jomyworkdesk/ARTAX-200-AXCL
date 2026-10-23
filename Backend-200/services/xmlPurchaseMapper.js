const { convert } = require("xmlbuilder2");

const asArray = (value) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
};

const localName = (name) => String(name || "").split(":").pop();

const findKey = (node, name) => {
    if (!node || typeof node !== "object") return null;
    return Object.keys(node).find((key) => localName(key) === name) || null;
};

const child = (node, path) =>
    path.reduce((current, key) => {
        if (!current || typeof current !== "object") return undefined;
        const nextKey = findKey(current, key);
        return nextKey ? current[nextKey] : undefined;
    }, node);

const nodeText = (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === "object") return value["#"] ?? value._ ?? null;
    return value;
};

const text = (node, path) => nodeText(child(node, path));

const firstText = (node, paths) => {
    for (const path of paths) {
        const value = text(node, path);
        if (value !== undefined && value !== null && value !== "") return value;
    }
    return null;
};

const attr = (node, path, name) => {
    const target = child(node, path);
    if (!target || typeof target !== "object") return null;
    return target[`@${name}`] || target[name] || null;
};

const findNode = (node, predicate) => {
    if (!node || typeof node !== "object") return null;
    if (predicate(node)) return node;

    for (const value of Object.values(node)) {
        for (const item of asArray(value)) {
            const found = findNode(item, predicate);
            if (found) return found;
        }
    }

    return null;
};

const decimal = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const stableInt = (...parts) => {
    const raw = parts
        .filter((part) => part !== undefined && part !== null && part !== "")
        .map(String)
        .join("|");

    let hash = 0;
    for (let index = 0; index < raw.length; index += 1) {
        hash = ((hash * 31) + raw.charCodeAt(index)) % 2147483647;
    }

    return hash || 1;
};

const taxTotal = (invoice) => asArray(child(invoice, ["TaxTotal"]))[0] || {};
const taxSubtotal = (invoice) => asArray(child(taxTotal(invoice), ["TaxSubtotal"]))[0] || {};

const party = (invoice, type) => {
    const wrapper = type === "seller"
        ? child(invoice, ["AccountingSupplierParty"])
        : child(invoice, ["AccountingCustomerParty"]);
    return child(wrapper, ["Party"]) || {};
};

const partyFields = (prefix, partyNode) => {
    const postalAddress = child(partyNode, ["PostalAddress"]) || {};
    const taxScheme = asArray(child(partyNode, ["PartyTaxScheme"]))[0] || {};
    const legalEntity = asArray(child(partyNode, ["PartyLegalEntity"]))[0] || {};
    const contact = child(partyNode, ["Contact"]) || {};
    const identification = asArray(child(partyNode, ["PartyIdentification"]))[0] || {};

    return {
        [`${prefix}_elec_address`]: text(partyNode, ["EndpointID"]),
        [`${prefix}_elec_scheme_id`]: attr(partyNode, ["EndpointID"], "schemeID"),
        [`${prefix}_id`]: text(identification, ["ID"]),
        [`${prefix}_scheme_id`]: attr(identification, ["ID"], "schemeID"),
        [`${prefix}_trade_name`]: text(partyNode, ["PartyName", "Name"]),
        [`${prefix}_addr_line1`]: text(postalAddress, ["StreetName"]),
        [`${prefix}_addr_line2`]: text(postalAddress, ["AdditionalStreetName"]),
        [`${prefix}_addr_line3`]: text(postalAddress, ["AddressLine", "Line"]),
        [`${prefix}_city`]: text(postalAddress, ["CityName"]),
        [`${prefix}_post_code`]: text(postalAddress, ["PostalZone"]),
        [`${prefix}_country_subdivision`]: text(postalAddress, ["CountrySubentity"]),
        [`${prefix}_country_code`]: text(postalAddress, ["Country", "IdentificationCode"]),
        [`${prefix}_vat_id`]: text(taxScheme, ["CompanyID"]),
        [`${prefix}_tax_scheme_code`]: text(taxScheme, ["TaxScheme", "ID"]),
        [`${prefix}_name`]: text(legalEntity, ["RegistrationName"]),
        [`${prefix}_legal_reg_id`]: text(legalEntity, ["CompanyID"]),
        [`${prefix}_legal_scheme_id`]: attr(legalEntity, ["CompanyID"], "schemeID"),
        [`${prefix}_authority_name`]: attr(legalEntity, ["CompanyID"], "schemeAgencyName"),
        [`${prefix}_passport_country_code`]: attr(legalEntity, ["CompanyID"], "schemeAgencyName"),
        [`${prefix}_legal_reg_type`]: attr(legalEntity, ["CompanyID"], "schemeAgencyID"),
        [`${prefix}_contact_point`]: text(contact, ["Name"]),
        [`${prefix}_contact_phone`]: text(contact, ["Telephone"]),
        [`${prefix}_contact_email`]: text(contact, ["ElectronicMail"])
    };
};

const allowanceChargeFields = (prefix, allowanceCharge = {}) => {
    const taxCategory = child(allowanceCharge, ["TaxCategory"]) || {};

    return {
        [`${prefix}_reason_code`]: text(allowanceCharge, ["AllowanceChargeReasonCode"]),
        [`${prefix}_reason`]: text(allowanceCharge, ["AllowanceChargeReason"]),
        [`${prefix}_percent`]: decimal(text(allowanceCharge, ["MultiplierFactorNumeric"])),
        [`${prefix}_amount`]: decimal(text(allowanceCharge, ["Amount"])),
        [`${prefix}_base_amount`]: decimal(text(allowanceCharge, ["BaseAmount"])),
        [`${prefix}_vat_cat_code`]: text(taxCategory, ["ID"]),
        [`${prefix}_vat_rate`]: decimal(text(taxCategory, ["Percent"])),
        [`${prefix}_vat_exempt_code`]: text(taxCategory, ["TaxExemptionReasonCode"]),
        [`${prefix}_vat_exempt_text`]: text(taxCategory, ["TaxExemptionReason"]),
        [`${prefix}_tax_scheme_code`]: text(taxCategory, ["TaxScheme", "ID"])
    };
};

const firstAllowanceCharge = (node, chargeIndicator) =>
    asArray(child(node, ["AllowanceCharge"])).find((allowanceCharge) => (
        String(text(allowanceCharge, ["ChargeIndicator"])).toLowerCase() === String(chargeIndicator)
    )) || {};

const firstAdditionalDocumentReference = (invoice, predicate) =>
    asArray(child(invoice, ["AdditionalDocumentReference"])).find(predicate) || {};

const buildHeaderFields = (parsed) => {
    const header = findNode(parsed, (node) => child(node, ["DocumentIdentification"]) && (child(node, ["Sender"]) || child(node, ["Receiver"]))) || {};
    const documentIdentification = child(header, ["DocumentIdentification"]) || {};

    return {
        SenderId: text(header, ["Sender", "Identifier"]),
        ReceiverId: text(header, ["Receiver", "Identifier"]),
        InstanceIdentifier: text(documentIdentification, ["InstanceIdentifier"]),
        DocCreatedAt: text(documentIdentification, ["CreationDateAndTime"])
    };
};

const buildCommonFields = (invoice) => {
    const seller = party(invoice, "seller");
    const buyer = party(invoice, "buyer");
    const subtotal = taxSubtotal(invoice);
    const taxCategory = child(subtotal, ["TaxCategory"]) || {};
    const legalMonetaryTotal = child(invoice, ["LegalMonetaryTotal"]) || {};
    const paymentMeans = asArray(child(invoice, ["PaymentMeans"]))[0] || {};
    const invoicePeriod = asArray(child(invoice, ["InvoicePeriod"]))[0] || {};
    const orderReference = child(invoice, ["OrderReference"]) || {};
    const billingReference = asArray(child(invoice, ["BillingReference"]))[0] || {};
    const contractReference = asArray(child(invoice, ["ContractDocumentReference"]))[0] || {};
    const documentReference = firstAdditionalDocumentReference(invoice, (reference) => (
        text(reference, ["DocumentTypeCode"]) || attr(reference, ["ID"], "schemeID")
    ));
    const embeddedReference = firstAdditionalDocumentReference(invoice, (reference) => (
        text(reference, ["Attachment", "EmbeddedDocumentBinaryObject"])
    ));
    const externalReference = firstAdditionalDocumentReference(invoice, (reference) => (
        text(reference, ["Attachment", "ExternalReference", "URI"])
    ));
    const supportReference = Object.keys(embeddedReference).length ? embeddedReference : externalReference;
    const taxTotals = asArray(child(invoice, ["TaxTotal"]));
    const taxCurrencyTotal = taxTotals[1] || {};
    const docCharge = firstAllowanceCharge(invoice, true);
    const docAllowance = firstAllowanceCharge(invoice, false);

    return {
        spec_identifier: text(invoice, ["CustomizationID"]),
        business_process_type: text(invoice, ["ProfileID"]),
        invoice_txn_type_code: text(invoice, ["ProfileExecutionID"]),
        invoice_no: text(invoice, ["ID"]),
        unique_identifier_no: text(invoice, ["UUID"]) || text(invoice, ["ID"]),
        invoice_issue_date: text(invoice, ["IssueDate"]),
        invoice_issue_time: text(invoice, ["IssueTime"]),
        payment_due_date: text(invoice, ["DueDate"]),
        invoice_type_code: firstText(invoice, [["InvoiceTypeCode"], ["CreditNoteTypeCode"]]),
        invoice_note: text(invoice, ["Note"]),
        vat_tax_point_date: text(invoice, ["TaxPointDate"]),
        invoice_currency_code: text(invoice, ["DocumentCurrencyCode"]),
        tax_account_currency: text(invoice, ["TaxCurrencyCode"]),
        buyer_account_ref: text(invoice, ["AccountingCost"]),
        buyer_reference: text(invoice, ["BuyerReference"]),
        invoice_period_start: text(invoicePeriod, ["StartDate"]),
        invoice_period_end: text(invoicePeriod, ["EndDate"]),
        billing_frequency: text(invoicePeriod, ["Description"]),
        purchase_order_ref: text(orderReference, ["ID"]),
        sales_order_ref: text(orderReference, ["SalesOrderID"]),
        preceding_invoice_ref: text(billingReference, ["InvoiceDocumentReference", "ID"]),
        preceding_invoice_date: text(billingReference, ["InvoiceDocumentReference", "IssueDate"]),
        contract_ref: text(contractReference, ["ID"]),
        contract_value: decimal(text(contractReference, ["DocumentDescription"])),
        invoiced_obj_id: text(documentReference, ["ID"]),
        invoiced_obj_scheme_id: attr(documentReference, ["ID"], "schemeID"),
        document_type_code: text(documentReference, ["DocumentTypeCode"]),
        support_doc_ref: text(supportReference, ["ID"]),
        support_doc_desc: text(supportReference, ["DocumentDescription"]),
        attached_document: text(embeddedReference, ["Attachment", "EmbeddedDocumentBinaryObject"]),
        attached_doc_mime_code: attr(embeddedReference, ["Attachment", "EmbeddedDocumentBinaryObject"], "mimeCode"),
        attached_doc_filename: attr(embeddedReference, ["Attachment", "EmbeddedDocumentBinaryObject"], "filename"),
        external_doc_location: text(externalReference, ["Attachment", "ExternalReference", "URI"]),
        ...partyFields("seller", seller),
        ...partyFields("buyer", buyer),
        payment_instruction_id: text(paymentMeans, ["ID"]),
        payment_means_type_code: text(paymentMeans, ["PaymentMeansCode"]),
        remittance_info: text(paymentMeans, ["PaymentID"]),
        payment_terms: text(invoice, ["PaymentTerms", "Note"]),
        syntax_binding_qualifier: text(invoice, ["ProfileExecutionID"]),
        ...allowanceChargeFields("doc_allow", docAllowance),
        ...allowanceChargeFields("doc_charge", docCharge),
        invoice_total_tax_amt: decimal(text(taxTotal(invoice), ["TaxAmount"])),
        vat_cat_taxable_amt: decimal(text(subtotal, ["TaxableAmount"])),
        vat_cat_tax_amt: decimal(text(subtotal, ["TaxAmount"])),
        vat_cat_code: text(taxCategory, ["ID"]),
        vat_cat_rate: decimal(text(taxCategory, ["Percent"])),
        vat_cat_tax_scheme_code: text(taxCategory, ["TaxScheme", "ID"]),
        invoice_total_vat_tax_currency: decimal(text(taxCurrencyTotal, ["TaxAmount"])),
        invoice_line_net_total: decimal(text(legalMonetaryTotal, ["LineExtensionAmount"])),
        invoice_total_without_tax: decimal(text(legalMonetaryTotal, ["TaxExclusiveAmount"])),
        invoice_total_with_tax: decimal(text(legalMonetaryTotal, ["TaxInclusiveAmount"])),
        total_doc_allowances: decimal(text(legalMonetaryTotal, ["AllowanceTotalAmount"])),
        total_doc_charges: decimal(text(legalMonetaryTotal, ["ChargeTotalAmount"])),
        paid_amount: decimal(text(legalMonetaryTotal, ["PrepaidAmount"])),
        rounding_amount: decimal(text(legalMonetaryTotal, ["PayableRoundingAmount"])),
        amount_due: decimal(text(legalMonetaryTotal, ["PayableAmount"]))
    };
};

const buildLineFields = (line, index, documentKey) => {
    const item = child(line, ["Item"]) || {};
    const classifiedTaxCategory = asArray(child(item, ["ClassifiedTaxCategory"]))[0] || {};
    const price = child(line, ["Price"]) || {};

    return {
        InvoiceLineid: stableInt(documentKey, text(line, ["ID"]) || index + 1, index + 1),
        invoice_line_id: text(line, ["ID"]),
        invoice_line_note: text(line, ["Note"]),
        invoiced_qty: decimal(firstText(line, [["InvoicedQuantity"], ["CreditedQuantity"]])),
        invoiced_qty_uom_code: attr(line, ["InvoicedQuantity"], "unitCode") || attr(line, ["CreditedQuantity"], "unitCode"),
        invoice_line_net_amt: decimal(text(line, ["LineExtensionAmount"])),
        item_description: text(item, ["Description"]),
        item_name: text(item, ["Name"]),
        item_buyer_id: text(item, ["BuyersItemIdentification", "ID"]),
        item_seller_id: text(item, ["SellersItemIdentification", "ID"]),
        item_standard_id: text(item, ["StandardItemIdentification", "ID"]),
        item_scheme_id: attr(item, ["StandardItemIdentification", "ID"], "schemeID"),
        item_vat_cat_code: text(classifiedTaxCategory, ["ID"]),
        item_vat_rate: decimal(text(classifiedTaxCategory, ["Percent"])),
        vat_exempt_reason_code: text(classifiedTaxCategory, ["TaxExemptionReasonCode"]),
        vat_exempt_reason_text: text(classifiedTaxCategory, ["TaxExemptionReason"]),
        item_tax_scheme: text(classifiedTaxCategory, ["TaxScheme", "ID"]),
        item_net_price: decimal(text(price, ["PriceAmount"])),
        item_price_base_qty: decimal(text(price, ["BaseQuantity"])),
        item_price_base_uom_code: attr(price, ["BaseQuantity"], "unitCode")
    };
};

const mapXmlToPurchaseRows = (xml) => {
    const parsed = convert(xml, { format: "object" });
    const invoice = findNode(parsed, (node) => child(node, ["InvoiceLine"]) || child(node, ["CreditNoteLine"]));

    if (!invoice || typeof invoice !== "object") {
        throw new Error("XML does not contain an invoice document");
    }

    const lines = asArray(child(invoice, ["InvoiceLine"]) || child(invoice, ["CreditNoteLine"]));
    if (!lines.length) {
        throw new Error("XML does not contain any InvoiceLine entries");
    }

    const commonFields = buildCommonFields(invoice);
    const headerFields = buildHeaderFields(parsed);
    const documentKey = headerFields.InstanceIdentifier || commonFields.unique_identifier_no || commonFields.invoice_no || Date.now();
    const now = new Date();

    return lines.map((line, index) => ({
        ...headerFields,
        ...commonFields,
        ...buildLineFields(line, index, documentKey),
        created_at: now,
        updated_at: now
    }));
};

module.exports = {
    mapXmlToPurchaseRows
};
