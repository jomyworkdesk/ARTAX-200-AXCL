const { create } = require("xmlbuilder2");
const { randomUUID } = require("crypto");

const SBDH_NS = "http://www.unece.org/cefact/namespaces/StandardBusinessDocumentHeader";
const XSI_NS = "http://www.w3.org/2001/XMLSchema-instance";
const CAC_NS = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
const CBC_NS = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
const CEC_NS = "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2";
const PXS_NS = "urn:peppol:schema:taxdata:1.0";
const DEFAULT_TRANSACTION_TYPE_CODE = "00000000";

/**
 * Generate unique instance identifier.
 * Required format:
 * invnumber-date-timestamp
 * - date: YYYY-MM-DD (current invoice date)
 * - timestamp: epoch milliseconds (current time, with milli seconds)
 */
const generateInstanceIdentifier = (invNumber, invoiceDate) => {
    const safeInvNumber = hasValue(invNumber) ? String(invNumber).trim() : "";
    const safeInvoiceDate = hasValue(invoiceDate) ? String(dateText(invoiceDate)).trim() : "";

    const timestamp = Date.now(); // epoch milliseconds
    return `${safeInvNumber}-${safeInvoiceDate}-${timestamp}`;
};


const DEFAULT_SBDH = {
    processId: "urn:peppol:bis:billing",
    countryC1: "AE",
    mlsTo: "0242:000539",
    mlsType: "ALWAYS_SEND"
};

const TAX_DATA_PROFILE = {
    standard: PXS_NS,
    typeVersion: "1.0",
    type: "TaxData",
    documentTypeId: `${PXS_NS}::TaxData##urn:peppol:taxdata:ae-1::1.0`,
    processId: "urn:peppol:taxreporting",
    mlsTo: "0242:000539-MLS"
};

const isEmpty = (value) => value === null || value === undefined;
const hasValue = (value) => !isEmpty(value) && value !== "";

const text = (value) => {
    if (isEmpty(value)) return "";
    if (value instanceof Date) return value.toISOString();
    return String(value);
};

const decimalText = (value, defaultValue = "") => {
    if (isEmpty(value) || value === "") return String(defaultValue);
    const decimal = Number(value);
    return Number.isFinite(decimal) ? String(value) : String(defaultValue);
};

const dateText = (value) => {
    if (isEmpty(value) || value === "") return "";
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    const raw = String(value);
    return raw.includes("T") ? raw.slice(0, 10) : raw;
};

const timeText = (value) => {
    if (isEmpty(value) || value === "") return "";
    if (value instanceof Date) return value.toISOString().slice(11, 19);
    const raw = String(value);
    if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
    const match = raw.match(/\b(\d{2}:\d{2}:\d{2})(?:\.\d+)?\b/);
    if (match) return match[1];
    return raw;
};

const currentTimestampText = () => {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");

    return [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate())
    ].join("-") + "T" + [
        pad(now.getHours()),
        pad(now.getMinutes()),
        pad(now.getSeconds())
    ].join(":");
};

const node = (name, value, attrs = null) => {
    if (!attrs) return { [name]: text(value) };
    return { [name]: { ...attrs, "#": text(value) } };
};

const currencyNode = (name, value, currency) =>
    node(name, decimalText(value), { "@currencyID": text(currency) });

const optionalSchemeNode = (name, value, schemeColumn, schemeAttr = "@schemeID") => {
    const attrs = {};
    if (!isEmpty(schemeColumn) && schemeColumn !== "") attrs[schemeAttr] = text(schemeColumn);
    return node(name, value, attrs);
};

const compact = (items) => items.filter(Boolean);

const firstFilled = (...values) =>
    values.find((value) => !isEmpty(value) && value !== "") ?? "";

const hasLinkedOutDocument = (source) =>
    hasValue(source?.outDocument) && hasValue(source?.outdoc_id);

const documentFieldValue = (source, fieldName) =>
    hasLinkedOutDocument(source) ? source?.[`outdoc_${fieldName}`] : null;

const documentBinaryText = (value) => {
    if (Buffer.isBuffer(value)) return value.toString("base64");
    if (value && value.type === "Buffer" && Array.isArray(value.data)) {
        return Buffer.from(value.data).toString("base64");
    }
    return text(value);
};

const buildParticipantId = (schemeId, electronicAddress) => {
    if (!hasValue(electronicAddress)) return "";

    const address = text(electronicAddress).trim();
    if (address.includes(":")) return address;

    return `${text(fallback(schemeId, "0235")).trim()}:${address}`;
};

const splitParticipantId = (schemeId, electronicAddress) => {
    const address = text(electronicAddress).trim();
    const separatorIndex = address.indexOf(":");

    if (separatorIndex > -1) {
        return {
            schemeId: address.slice(0, separatorIndex),
            id: address.slice(separatorIndex + 1)
        };
    }

    return {
        schemeId: text(fallback(schemeId, "0235")).trim(),
        id: address
    };
};

const cleanEmpty = (value) => {
    if (value === "" || value === null || value === undefined) return undefined;
    if (Array.isArray(value)) {
        const items = value.map(cleanEmpty).filter((item) => item !== undefined);
        return items.length ? items : undefined;
    }
    if (typeof value === "object" && !(value instanceof Date)) {
        const entries = Object.entries(value)
            .map(([key, item]) => [key, cleanEmpty(item)])
            .filter(([, item]) => item !== undefined);
        return entries.length ? Object.fromEntries(entries) : undefined;
    }
    return value;
};

const isPositiveNumber = (value) => Number(value) > 0;
const hasMeaningfulAmount = (...values) => values.some(isPositiveNumber);
const isForeignCurrencyDocument = (h) =>
    hasValue(h.invoice_currency_code)
    && text(h.invoice_currency_code).trim().toUpperCase() !== "AED";

const normalizedBoolean = (value) => {
    if (isEmpty(value) || value === "") return null;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") {
        if (value === 1) return true;
        if (value === 0) return false;
        return null;
    }

    const normalized = String(value).trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
    return null;
};

const fallback = (value, defaultValue) => (hasValue(value) ? value : defaultValue);

const normalizedVatCategoryCode = (value) =>
    text(value).trim().toUpperCase();

const isExemptVatCategory = (value) => normalizedVatCategoryCode(value) === "E";
const isVatCategoryWithoutRate = (value) => ["E", "O"].includes(normalizedVatCategoryCode(value));

const defaultTaxPointDate = (taxPointDate, issueDate) => {
    const taxDate = dateText(taxPointDate);
    const invDate = dateText(issueDate);

    if (taxDate && (!invDate || taxDate < invDate)) return taxDate;
    if (!invDate) return "";

    const date = new Date(`${invDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
};

const priceAmountForLine = (line) => {
    const qty = Number(line.invoiced_qty);
    const baseQty = Number(line.item_price_base_qty || 1);
    const lineNet = Number(line.invoice_line_net_amt);

    // if (
    //     qty > 0 &&
    //     baseQty > 0 &&
    //     Number.isFinite(lineNet) &&
    //     !hasMeaningfulAmount(line.line_charge_amount, line.line_allow_amount)
    // ) {
    //     return (lineNet * baseQty / qty).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
    // }

    return line.item_net_price;
};

const taxableAmountForHeader = (h) =>
    firstFilled(h.invoice_total_without_tax, h.vat_cat_taxable_amt);

const taxAmountForHeader = (h) => firstFilled(h.vat_cat_tax_amt, h.invoice_total_tax_amt);

const decimalValue = (value, defaultValue = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : defaultValue;
};

const decimalNumber = (value) => {
    if (!hasValue(value)) return null;

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

const decimalSumText = (value) => {
    const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
    return rounded.toFixed(2);
};

const documentAllowanceTaxAdjustment = (h, subtotal) => {
    if (normalizedBoolean(h.syntax_binding_qualifier) !== false) return null;

    const allowanceAmount = decimalNumber(h.doc_allow_amount);
    const allowanceRate = decimalNumber(firstFilled(h.doc_allow_vat_rate, h.vat_cat_rate));
    const subtotalRate = decimalNumber(subtotal.rate);

    if (allowanceAmount === null || allowanceAmount <= 0) return null;
    if (allowanceRate === null || subtotalRate === null || allowanceRate !== subtotalRate) return null;

    return {
        taxableAmount: allowanceAmount,
        taxAmount: allowanceAmount * allowanceRate / 100
    };
};

const applyDocumentAllowanceTaxAdjustment = (h, subtotal) => {
    const adjustment = documentAllowanceTaxAdjustment(h, subtotal);
    if (!adjustment) return subtotal;

    return {
        ...subtotal,
        taxableAmount: decimalValue(subtotal.taxableAmount) - adjustment.taxableAmount,
        taxAmount: decimalValue(subtotal.taxAmount) - adjustment.taxAmount
    };
};

const buildTaxSubtotal = ({ taxableAmount, taxAmount, categoryCode, rate, schemeCode }, currency) => ({
    ...currencyNode("cbc:TaxableAmount", taxableAmount, currency),
    ...currencyNode("cbc:TaxAmount", taxAmount, currency),
    "cac:TaxCategory": {
        "cbc:ID": text(categoryCode),
        ...(!isVatCategoryWithoutRate(categoryCode) ? { "cbc:Percent": text(rate) } : {}),
        "cac:TaxScheme": {
            "cbc:ID": text(schemeCode)
        }
    }
});

const buildTaxSubtotals = (h, lines = []) => {
    if (!lines.length) {
        const subtotal = applyDocumentAllowanceTaxAdjustment(h, {
            taxableAmount: taxableAmountForHeader(h),
            taxAmount: taxAmountForHeader(h),
            categoryCode: fallback(h.vat_cat_code),
            rate: fallback(h.vat_cat_rate),
            schemeCode: h.vat_cat_tax_scheme_code
        });

        return buildTaxSubtotal({
            ...subtotal,
            taxableAmount: typeof subtotal.taxableAmount === "number"
                ? decimalSumText(subtotal.taxableAmount)
                : subtotal.taxableAmount,
            taxAmount: typeof subtotal.taxAmount === "number"
                ? decimalSumText(subtotal.taxAmount)
                : subtotal.taxAmount
        }, h.invoice_currency_code);
    }

    const grouped = new Map();

    lines.forEach((line) => {
        const categoryCode = text(fallback(line.vat_cat_code, h.vat_cat_code)).trim();
        const key = categoryCode || "__blank__";
        const current = grouped.get(key) || {
            taxableAmount: 0,
            taxAmount: 0,
            categoryCode,
            rate: firstFilled(line.vat_cat_rate, line.item_vat_rate, h.vat_cat_rate),
            schemeCode: firstFilled(line.vat_cat_tax_scheme_code, line.item_tax_scheme, h.vat_cat_tax_scheme_code)
        };

        current.taxableAmount += decimalValue(firstFilled(line.vat_cat_taxable_amt, line.invoice_line_net_amt));
        current.taxAmount += decimalValue(firstFilled(line.vat_cat_tax_amt, line.vat_line_amt_aed));
        if (!hasValue(current.rate)) current.rate = firstFilled(line.vat_cat_rate, line.item_vat_rate, h.vat_cat_rate);
        if (!hasValue(current.schemeCode)) current.schemeCode = firstFilled(line.vat_cat_tax_scheme_code, line.item_tax_scheme, h.vat_cat_tax_scheme_code);

        grouped.set(key, current);
    });

    return [...grouped.values()].map((subtotal) => {
        const adjustedSubtotal = applyDocumentAllowanceTaxAdjustment(h, subtotal);

        return buildTaxSubtotal({
            ...adjustedSubtotal,
            taxableAmount: decimalSumText(adjustedSubtotal.taxableAmount),
            taxAmount: decimalSumText(adjustedSubtotal.taxAmount)
        }, h.invoice_currency_code);
    });
};

const groupByInvoice = (rows) => {
    const grouped = new Map();

    rows.forEach((row) => {
        const key = text(row.invoice_no || row.InvoiceNumber || row.InvNumber || row.ID);
        if (!grouped.has(key)) grouped.set(key, { header: row, lines: [] });
        grouped.get(key).lines.push(row);
    });

    return [...grouped.values()];
};

const buildAdditionalDocumentReferences = (h) => {
    const invoicedObjId = documentFieldValue(h, "invoiced_obj_id");
    const invoicedObjSchemeId = documentFieldValue(h, "invoiced_obj_scheme_id");
    const documentTypeCode = documentFieldValue(h, "document_type_code");
    const supportDocRef = documentFieldValue(h, "support_doc_ref");
    const supportDocDesc = documentFieldValue(h, "support_doc_desc");
    const attachedDocument = documentFieldValue(h, "attached_document");
    const attachedDocMimeCode = documentFieldValue(h, "attached_doc_mime_code");
    const attachedDocFilename = documentFieldValue(h, "attached_doc_filename");
    const externalDocLocation = documentFieldValue(h, "external_doc_location");

    return compact([
        hasValue(invoicedObjId) || hasValue(documentTypeCode) ? {
            ...(hasValue(invoicedObjId) ? optionalSchemeNode("cbc:ID", invoicedObjId, invoicedObjSchemeId) : {}),
            ...(hasValue(documentTypeCode) ? { "cbc:DocumentTypeCode": text(documentTypeCode) } : {})
        } : null,
        hasValue(externalDocLocation) ? {
            ...(hasValue(supportDocRef) ? { "cbc:ID": text(supportDocRef) } : {}),
            ...(hasValue(supportDocDesc) ? { "cbc:DocumentDescription": text(supportDocDesc) } : {}),
            "cac:Attachment": {
                "cac:ExternalReference": {
                    "cbc:URI": text(externalDocLocation)
                }
            }
        } : null,
        hasValue(attachedDocument) ? {
            ...(hasValue(supportDocRef) ? { "cbc:ID": text(supportDocRef) } : {}),
            ...(hasValue(supportDocDesc) ? { "cbc:DocumentDescription": text(supportDocDesc) } : {}),
            "cac:Attachment": {
                "cbc:EmbeddedDocumentBinaryObject": {
                    ...(hasValue(attachedDocMimeCode) ? { "@mimeCode": text(attachedDocMimeCode) } : {}),
                    ...(hasValue(attachedDocFilename) ? { "@filename": text(attachedDocFilename) } : {}),
                    "#": documentBinaryText(attachedDocument)
                }
            }
        } : null,
        isForeignCurrencyDocument(h) && (
            hasValue(h.invoice_obj_identifier)
            || hasValue(h.invoice_doc_type_code)
            || hasValue(h.invocie_doc_description)
        ) ? {
            "cbc:ID": text(h.invoice_obj_identifier),
            "cbc:DocumentTypeCode": text(h.invoice_doc_type_code),
            "cbc:DocumentDescription": text(h.invocie_doc_description)
        } : null
    ]);
};

const buildParty = (prefix, h, isSeller) => {
    const scheme = fallback(h[`${prefix}_elec_scheme_id`]);
    const idScheme = h[`${prefix}_scheme_id`];
    const legalScheme = h[`${prefix}_legal_scheme_id`];
    const vatId = h[`${prefix}_vat_id`];
    const endpointId = h[`${prefix}_elec_address`];
    const legalRegId = h[`${prefix}_legal_reg_id`];
    const legalRegType = h[`${prefix}_legal_reg_type`];
    const legalAgencyName = firstFilled(
        h[`${prefix}_authority_name`],
        h[`${prefix}_passport_country_code`]
    );

    return {
        "cac:Party": {
            ...optionalSchemeNode("cbc:EndpointID", endpointId, scheme),
            ...(hasValue(h[`${prefix}_id`]) ? { "cac:PartyIdentification": compact([
                { ...optionalSchemeNode("cbc:ID", h[`${prefix}_id`], idScheme) }
            ]) } : {}),
            "cac:PartyName": {
                "cbc:Name": text(h[`${prefix}_trade_name`])
            },
            "cac:PostalAddress": {
                "cbc:StreetName": text(h[`${prefix}_addr_line1`]),
                "cbc:AdditionalStreetName": text(h[`${prefix}_addr_line2`]),
                "cbc:CityName": text(h[`${prefix}_city`]),
                "cbc:PostalZone": text(h[`${prefix}_post_code`]),
                "cbc:CountrySubentity": text(h[`${prefix}_country_subdivision`]),
                "cac:AddressLine": {
                    "cbc:Line": text(h[`${prefix}_addr_line3`])
                },
                "cac:Country": {
                    "cbc:IdentificationCode": text(h[`${prefix}_country_code`])
                }
            },
            ...(hasValue(vatId) ? { "cac:PartyTaxScheme": {
                "cbc:CompanyID": text(vatId),
                "cac:TaxScheme": {
                    "cbc:ID": text(h[`${prefix}_tax_scheme_code`])
                }
            } } : {}),
            "cac:PartyLegalEntity": {
                "cbc:RegistrationName": text(h[`${prefix}_name`]),
                ...(hasValue(legalRegId) || hasValue(legalRegType) ? { "cbc:CompanyID": {
                    "@schemeAgencyID": text(legalRegType),
                    "@schemeAgencyName": text(legalAgencyName),
                    ...(hasValue(legalScheme) ? { "@schemeID": text(legalScheme) } : {}),
                    "#": text(legalRegId)
                } } : {})
            },
            "cac:Contact": {
                "cbc:Name": text(h[`${prefix}_contact_point`]),
                "cbc:Telephone": text(h[`${prefix}_contact_phone`]),
                "cbc:ElectronicMail": text(h[`${prefix}_contact_email`])
            }
        }
    };
};

const buildDocumentAllowanceCharge = (h, chargeIndicator) => {
    const documentChargeIndicator = chargeIndicator
        ? normalizedBoolean(h.doc_charge_indicator) ?? (isPositiveNumber(h.doc_charge_percent) ? true : null)
        : normalizedBoolean(h.syntax_binding_qualifier);
    if (documentChargeIndicator === null || documentChargeIndicator !== chargeIndicator) return null;

    const prefix = chargeIndicator ? "doc_charge" : "doc_allow";
    if (!hasMeaningfulAmount(h[`${prefix}_amount`], h[`${prefix}_base_amount`])) return null;

    return {
        "cac:AllowanceCharge": {
            "cbc:ChargeIndicator": String(documentChargeIndicator),
            "cbc:AllowanceChargeReasonCode": text(h[`${prefix}_reason_code`]),
            "cbc:AllowanceChargeReason": text(h[`${prefix}_reason`]),
            "cbc:MultiplierFactorNumeric": text(h[`${prefix}_percent`]),
            ...currencyNode("cbc:Amount", h[`${prefix}_amount`], h.invoice_currency_code),
            ...currencyNode("cbc:BaseAmount", h[`${prefix}_base_amount`], h.invoice_currency_code),
            "cac:TaxCategory": {
                "cbc:ID": text(fallback(h[`${prefix}_vat_cat_code`], h.vat_cat_code)),
                "cbc:Percent": text(fallback(h[`${prefix}_vat_rate`], h.vat_cat_rate )),
                "cbc:TaxExemptionReasonCode": text(h[`${prefix}_vat_exempt_code`]),
                "cbc:TaxExemptionReason": text(h[`${prefix}_vat_exempt_text`]),
                "cac:TaxScheme": {
                    "cbc:ID": text(fallback(h[`${prefix}_tax_scheme_code`], "VAT"))
                }
            }
        }
    };
};

const buildLineAllowanceCharge = (line, chargeIndicator, currency) => {
    const lineChargeIndicator = normalizedBoolean(line.charge_indicator);
    if (lineChargeIndicator === null || lineChargeIndicator !== chargeIndicator) return null;

    const prefix = lineChargeIndicator ? "line_charge" : "line_allow";
    if (!lineChargeIndicator && !isPositiveNumber(line.line_allow_percent)) return null;
    if (!hasMeaningfulAmount(line[`${prefix}_amount`], line[`${prefix}_base_amount`])) return null;

    return {
        "cac:AllowanceCharge": {
            "cbc:ChargeIndicator": String(lineChargeIndicator),
            "cbc:AllowanceChargeReasonCode": text(line[`${prefix}_reason_code`]),
            "cbc:AllowanceChargeReason": text(line[`${prefix}_reason`]),
            "cbc:MultiplierFactorNumeric": text(line[`${prefix}_percent`]),
            ...currencyNode("cbc:Amount", line[`${prefix}_amount`], currency),
            ...currencyNode("cbc:BaseAmount", line[`${prefix}_base_amount`], currency)
        }
    };
};

const buildStandardBusinessDocumentHeader = (profile, instanceIdentifier = null, h = {}) => {
    const senderPrefix = profile.senderPrefix || "seller";
    const receiverPrefix = profile.receiverPrefix || "buyer";

    return {
    "StandardBusinessDocumentHeader": {
        "HeaderVersion": "1.0",
        "Sender": {
            "Identifier": {
                "@Authority": "iso6523-actorid-upis",
                "#": buildParticipantId(
                    h[`${senderPrefix}_elec_scheme_id`],
                    h[`${senderPrefix}_elec_address`]
                )
            }
        },
        "Receiver": {
            "Identifier": {
                "@Authority": "iso6523-actorid-upis",
                "#": buildParticipantId(
                    h[`${receiverPrefix}_elec_scheme_id`],
                    h[`${receiverPrefix}_elec_address`]
                )
            }
        },
        "DocumentIdentification": {
            "Standard": profile.standard,
            "TypeVersion": profile.typeVersion || "2.1",
            "InstanceIdentifier": instanceIdentifier || generateInstanceIdentifier(),
            "Type": profile.type,
            "CreationDateAndTime": currentTimestampText()
        },
        "BusinessScope": {
            "Scope": [
                {
                    "Type": "DOCUMENTID",
                    "InstanceIdentifier": profile.documentTypeId,
                    "Identifier": hasValue(getTddScope(h)) ? "busdox-docid-qns" : "peppol-doctype-wildcard"
                },
                {
                    "Type": "PROCESSID",
                    "InstanceIdentifier": fallback(h.business_process_type, profile.processId || DEFAULT_SBDH.processId),
                    "Identifier": "cenbii-procid-ubl"
                },
                {
                    "Type": "COUNTRY_C1",
                    "InstanceIdentifier": DEFAULT_SBDH.countryC1
                },
                {
                    "Type": "MLS_TO",
                    "InstanceIdentifier": profile.mlsTo || DEFAULT_SBDH.mlsTo,
                    "Identifier": "iso6523-actorid-upis"
                },
                {
                    "Type": "MLS_TYPE",
                    "InstanceIdentifier": DEFAULT_SBDH.mlsType
                }
            ]
        }
    }
    };
};

const buildPayeeParty = (h) => {
    const txnTypeCode = getTransactionTypeCode(h);
    if (txnTypeCode === "10000000") return {};

    // For other transaction types, use payee_id and payee_name if available
    if (hasValue(h.payee_name) || hasValue(h.payee_id)) {
        return {
            "cac:PayeeParty": {
                "cac:PartyIdentification": {
                    ...optionalSchemeNode("cbc:ID", h.payee_id, h.payee_scheme_id)
                },
                "cac:PartyName": {
                    "cbc:Name": text(h.payee_name)
                },
                "cac:PartyLegalEntity": {
                    ...optionalSchemeNode("cbc:CompanyID", h.payee_legal_reg_id, h.payee_legal_scheme_id)
                }
            }
        };
    }
    
    return {};
};

const buildBuyerCustomerParty = (h) => {
    if (getTransactionTypeCode(h) !== "10000000" || !hasValue(h.beneficiary_id)) return {};

    return {
        "cac:BuyerCustomerParty": {
            "cac:Party": {
                "cac:PartyIdentification": {
                    "cbc:ID": text(h.beneficiary_id)
                }
            }
        }
    };
};

const getTransactionTypeCode = (h) =>
    text(firstFilled(
        h.invoice_txn_type_code,
        DEFAULT_TRANSACTION_TYPE_CODE
    )).trim();

const buildDelivery = (h) => {
    if (getTransactionTypeCode(h) !== "00000001") return {};

    const requiredDeliveryFields = [
        "deliver_to_addr_line1",
        "deliver_to_city",
        "deliver_to_country_code"
    ];
    const missingFields = requiredDeliveryFields.filter((field) => !hasValue(h[field]));

    if (missingFields.length) {
        throw new Error(`Export invoice delivery details missing required field(s): ${missingFields.join(", ")}`);
    }

    return {
        "cac:Delivery": {
            ...(hasValue(h.actual_delivery_date) ? { "cbc:ActualDeliveryDate": dateText(h.actual_delivery_date) } : {}),
            "cac:DeliveryLocation": {
                ...(hasValue(h.deliver_to_location_id)
                    ? optionalSchemeNode("cbc:ID", h.deliver_to_location_id, h.deliver_to_scheme_id)
                    : {}),
                "cac:Address": {
                    "cbc:StreetName": text(h.deliver_to_addr_line1),
                    ...(hasValue(h.deliver_to_addr_line2) ? { "cbc:AdditionalStreetName": text(h.deliver_to_addr_line2) } : {}),
                    "cbc:CityName": text(h.deliver_to_city),
                    ...(hasValue(h.deliver_to_post_code) ? { "cbc:PostalZone": text(h.deliver_to_post_code) } : {}),
                    "cbc:CountrySubentity": text(h.deliver_to_country_subdivision),
                    ...(hasValue(h.deliver_to_addr_line3) ? { "cac:AddressLine": {
                        "cbc:Line": text(h.deliver_to_addr_line3)
                    } } : {}),
                    "cac:Country": {
                        "cbc:IdentificationCode": text(h.deliver_to_country_code)
                    }
                }
            },
            ...(hasValue(h.deliver_to_party_name) || hasValue(h.deliver_to_party_id) ? { "cac:DeliveryParty": {
                ...(hasValue(h.deliver_to_party_id) ? { "cac:PartyIdentification": {
                    "cbc:ID": text(h.deliver_to_party_id)
                } } : {}),
                ...(hasValue(h.deliver_to_party_name) ? { "cac:PartyName": {
                    "cbc:Name": text(h.deliver_to_party_name)
                } } : {})
            } } : {})
        }
    };
};

const buildDeliveryAndParties = (h) => ({
    "cac:AccountingSupplierParty": buildParty("seller", h, true),
    "cac:AccountingCustomerParty": buildParty("buyer", h, false),
    ...buildBuyerCustomerParty(h),
    ...buildPayeeParty(h),
    ...(hasValue(h.seller_tax_rep_name) ? { "cac:TaxRepresentativeParty": {
        "cac:PartyName": {
            "cbc:Name": text(h.seller_tax_rep_name)
        },
        "cac:PostalAddress": {
            "cbc:StreetName": text(h.tax_rep_addr_line1),
            "cbc:AdditionalStreetName": text(h.tax_rep_addr_line2),
            "cbc:CityName": text(h.tax_rep_city),
            "cbc:PostalZone": text(h.tax_rep_post_code),
            "cbc:CountrySubentity": text(h.tax_rep_country_subdivision),
            "cac:AddressLine": {
                "cbc:Line": text(h.tax_rep_addr_line3)
            },
            "cac:Country": {
                "cbc:IdentificationCode": text(h.tax_rep_country_code)
            }
        },
        "cac:PartyTaxScheme": {
            "cbc:CompanyID": text(h.seller_tax_rep_vat_id),
            "cac:TaxScheme": {
                "cbc:ID": text(fallback(h.tax_rep_tax_scheme_code, "VAT"))
            }
        }
    } } : {}),
    ...buildDelivery(h),
    ...(hasValue(h.incoterms) ? { "cac:DeliveryTerms": {
        ...optionalSchemeNode("cbc:ID", h.incoterms, h.incoterms_scheme_id)
    } } : {})
});

const buildDocumentTotals = (h, { includeTaxIncludedIndicator, lines = [] }) => ({
    "cac:AllowanceCharge": compact([
        buildDocumentAllowanceCharge(h, true)?.["cac:AllowanceCharge"],
        buildDocumentAllowanceCharge(h, false)?.["cac:AllowanceCharge"]
    ]),
    ...(isForeignCurrencyDocument(h) && hasValue(h.source_currency_code) && hasValue(h.target_currency_code) && isPositiveNumber(h.calculation_rate) ? { "cac:TaxExchangeRate": {
        "cbc:SourceCurrencyCode": text(h.source_currency_code),
        "cbc:TargetCurrencyCode": text(h.target_currency_code),
        "cbc:CalculationRate": text(h.calculation_rate)
    } } : {}),
    "cac:TaxTotal": [
        {
            ...currencyNode("cbc:TaxAmount", h.invoice_total_tax_amt, h.invoice_currency_code),
            ...(includeTaxIncludedIndicator ? { "cbc:TaxIncludedIndicator": "false" } : {}),
            "cac:TaxSubtotal": buildTaxSubtotals(h, lines)
        },
        isForeignCurrencyDocument(h) && hasValue(h.invoice_total_vat_tax_currency) ? {
            ...currencyNode("cbc:TaxAmount", h.invoice_total_vat_tax_currency, "AED")
        } : null
    ].filter(Boolean),
    "cac:LegalMonetaryTotal": {
        ...currencyNode("cbc:LineExtensionAmount", h.invoice_line_net_total, h.invoice_currency_code),
        ...currencyNode("cbc:TaxExclusiveAmount", h.invoice_total_without_tax, h.invoice_currency_code),
        ...currencyNode("cbc:TaxInclusiveAmount", h.invoice_total_with_tax, h.invoice_currency_code),
        ...currencyNode("cbc:AllowanceTotalAmount", h.total_doc_allowances, h.invoice_currency_code),
        ...currencyNode("cbc:ChargeTotalAmount", h.total_doc_charges, h.invoice_currency_code),
        ...currencyNode("cbc:PrepaidAmount", h.paid_amount, h.invoice_currency_code),
        ...currencyNode("cbc:PayableRoundingAmount", h.rounding_amount, h.invoice_currency_code),
        ...currencyNode("cbc:PayableAmount", h.amount_due, h.invoice_currency_code)
    }
});

const buildItemBlock = (line, h, defaultTaxCategory = "S") => {
    const itemVatCategoryCode = normalizedVatCategoryCode(fallback(line.item_vat_cat_code, defaultTaxCategory));
    const includeVatPercent = !isVatCategoryWithoutRate(itemVatCategoryCode);
    const includeItemPriceTaxTotal = !isExemptVatCategory(itemVatCategoryCode);
    const includeGoodsServiceType = itemVatCategoryCode === "AE";
    const includeVatExemptReasonText = itemVatCategoryCode === "Z";
    const includeVatExemptReasonCode = itemVatCategoryCode === "E";

    return {
    "cac:Item": {
        "cbc:Description": text(line.item_description),
        "cbc:Name": text(line.item_name),
        "cac:BuyersItemIdentification": {
            "cbc:ID": text(line.item_buyer_id)
        },
        "cac:SellersItemIdentification": {
            "cbc:ID": text(line.item_seller_id)
        },
        ...(hasValue(line.item_standard_id) ? { "cac:StandardItemIdentification": {
            ...optionalSchemeNode("cbc:ID", line.item_standard_id, line.item_scheme_id)
        } } : {}),
        ...(hasValue(line.service_acc_code) ? { "cac:AdditionalItemIdentification": {
            ...optionalSchemeNode("cbc:ID", line.service_acc_code, line.service_acc_scheme_id || "SAC")
        } } : {}),
        ...(hasValue(line.item_country_origin) ? { "cac:OriginCountry": {
            "cbc:IdentificationCode": text(line.item_country_origin)
        } } : {}),
        "cac:CommodityClassification": [
            (includeGoodsServiceType && hasValue(line.goods_service_type)) || hasValue(line.item_type) ? {
                ...(includeGoodsServiceType ? { "cbc:NatureCode": text(line.goods_service_type) } : {}),
                "cbc:CommodityCode": text(line.item_type)
            } : null,
            hasValue(line.item_classification_id) ? {
                "cbc:ItemClassificationCode": {
                    "@listID": text(line.item_classification_scheme_id || "HS"),
                    "#": text(line.item_classification_id)
                }
            } : null
        ].filter(Boolean),
        "cac:ClassifiedTaxCategory": {
            "cbc:ID": text(fallback(line.item_vat_cat_code, defaultTaxCategory)),
            ...(includeVatPercent ? { "cbc:Percent": text(fallback(line.item_vat_rate, )) } : {}),
            ...(includeVatExemptReasonCode ? { "cbc:TaxExemptionReasonCode": text(line.vat_exempt_reason_code) } : {}),
            ...(includeVatExemptReasonText ? { "cbc:TaxExemptionReason": text(line.vat_exempt_reason_text) } : {}),
            "cac:TaxScheme": {
                "cbc:ID": text(line.item_tax_scheme)
            }
        },
        "cac:AdditionalItemProperty": {
            "cbc:Name": text(line.item_attribute_name),
            "cbc:Value": text(line.item_attribute_value)
        }
    },
    "cac:Price": {
        ...currencyNode("cbc:PriceAmount", priceAmountForLine(line), h.invoice_currency_code),
        "cbc:BaseQuantity": {
            "@unitCode": text(firstFilled(line.item_price_base_uom_code, line.invoiced_qty_uom_code)),
            "#": text(line.item_price_base_qty)
        },
        "cac:AllowanceCharge": {
            "cbc:ChargeIndicator": "false",
            ...currencyNode("cbc:Amount", line.item_price_discount, h.invoice_currency_code),
            ...currencyNode(
                "cbc:BaseAmount",
                line.item_gross_price,
                h.invoice_currency_code
            )
        }
    },
    "cac:ItemPriceExtension": {
        ...currencyNode("cbc:Amount", line.invoice_line_amt_aed, h.invoice_currency_code),
        ...(includeItemPriceTaxTotal ? { "cac:TaxTotal": {
            ...currencyNode("cbc:TaxAmount", line.vat_line_amt_aed, h.invoice_currency_code)
        } } : {})
    }
    };
};

const getTddScope = (h = {}) => {
    const scope = firstFilled(h.TddScope, h.tddScope, h.tdd_scope);
    return hasValue(scope) ? text(scope).trim() : "";
};

const timeWithUtcSuffix = (value) => {
    const issueTime = timeText(value);
    if (!issueTime || /z$/i.test(issueTime) || /[+-]\d{2}:\d{2}$/.test(issueTime)) return issueTime;
    return `${issueTime}Z`;
};

const sourceDocumentValue = (sourceDocument, key) => {
    const value = sourceDocument?.[key];
    return value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "#")
        ? value["#"]
        : value;
};

const findSourceDocumentEntry = (documentObject) => {
    const standardBusinessDocument = documentObject?.StandardBusinessDocument || {};
    return Object.entries(standardBusinessDocument).find(([key]) =>
        !key.startsWith("@") && key !== "StandardBusinessDocumentHeader"
    ) || [];
};

const buildUblSourceDocument = (sourceKey, sourceDocument) => {
    if (!sourceKey || !sourceDocument) return {};

    const localName = sourceKey.includes(":") ? sourceKey.split(":").pop() : sourceKey;
    const sourceNamespace = sourceDocument["@xmlns:ubl"]
        || sourceDocument["@xmlns:doc"]
        || sourceDocument["@xmlns"];
    const normalizedSourceDocument = {
        ...sourceDocument,
        ...(hasValue(sourceNamespace) ? { "@xmlns:ubl": sourceNamespace } : {})
    };

    delete normalizedSourceDocument["@xmlns"];
    delete normalizedSourceDocument["@xmlns:doc"];

    return {
        [`ubl:${localName}`]: normalizedSourceDocument
    };
};

const endpointIdNode = (schemeId, electronicAddress) => {
    const participant = splitParticipantId(schemeId, electronicAddress);
    if (!hasValue(participant.id)) return {};

    return optionalSchemeNode("cbc:EndpointID", participant.id, participant.schemeId);
};

const buildReportedPartyTaxScheme = (prefix, h) => ({
    "cac:Party": {
        "cac:PartyTaxScheme": {
            "cbc:CompanyID": text(h[`${prefix}_vat_id`]),
            "cac:TaxScheme": {
                "cbc:ID": text(fallback(h[`${prefix}_tax_scheme_code`], "VAT"))
            }
        }
    }
});

const buildReportersRepresentative = (h) => {
    const representative = splitParticipantId(
        firstFilled(h.tdd_reporters_representative_scheme_id, h.reporters_representative_scheme_id, "0242"),
        firstFilled(h.tdd_reporters_representative_id, h.reporters_representative_id, DEFAULT_SBDH.mlsTo)
    );

    return {
        "cac:PartyIdentification": {
            ...optionalSchemeNode(
                "cbc:ID",
                text(representative.id).replace(/-MLS$/i, ""),
                representative.schemeId
            )
        }
    };
};

const buildTaxDataReportedDocument = (h, sourceDocument) => ({
    "cbc:CustomizationID": text(firstFilled(sourceDocumentValue(sourceDocument, "cbc:CustomizationID"), h.spec_identifier)),
    "cbc:ProfileID": text(firstFilled(sourceDocumentValue(sourceDocument, "cbc:ProfileID"), h.business_process_type)),
    "cbc:ID": text(firstFilled(sourceDocumentValue(sourceDocument, "cbc:ID"), h.invoice_no)),
    "cbc:UUID": text(firstFilled(sourceDocumentValue(sourceDocument, "cbc:UUID"), h.unique_identifier_no)),
    "cbc:IssueDate": dateText(firstFilled(sourceDocumentValue(sourceDocument, "cbc:IssueDate"), h.invoice_issue_date)),
    "pxs:DocumentTypeCode": text(firstFilled(
        h.invoice_type_code,
        h.InvoiceTypeCode,
        h.CreditNoteTypeCode,
        sourceDocumentValue(sourceDocument, "cbc:InvoiceTypeCode"),
        sourceDocumentValue(sourceDocument, "cbc:CreditNoteTypeCode")
    )),
    "cbc:DocumentCurrencyCode": text(firstFilled(
        sourceDocumentValue(sourceDocument, "cbc:DocumentCurrencyCode"),
        h.invoice_currency_code
    )),
    "cac:AccountingSupplierParty": buildReportedPartyTaxScheme("seller", h),
    "cac:AccountingCustomerParty": buildReportedPartyTaxScheme("buyer", h),
    "cac:TaxTotal": {
        ...currencyNode("cbc:TaxAmount", firstFilled(h.invoice_total_tax_amt, h.vat_cat_tax_amt), h.invoice_currency_code)
    },
    "pxs:MonetaryTotal": {
        ...currencyNode("cbc:TaxExclusiveAmount", firstFilled(h.invoice_total_without_tax, h.vat_cat_taxable_amt), h.invoice_currency_code)
    }
});

const buildTaxDataDocument = (group, sourceDocumentObject) => {
    const h = group.header || {};
    const [sourceKey, sourceDocument] = findSourceDocumentEntry(sourceDocumentObject);
    const transportHeaderId = sourceDocumentObject
        ?.StandardBusinessDocument
        ?.StandardBusinessDocumentHeader
        ?.DocumentIdentification
        ?.InstanceIdentifier;

    return {
        "StandardBusinessDocument": {
            "@xmlns": SBDH_NS,
            "@xmlns:xsi": XSI_NS,
            "@xsi:schemaLocation": `${SBDH_NS} https://docs.peppol.eu/poacc/billing/3.0/files/xsd/openpeppol-sbdh-1.3.xsd`,
            ...buildStandardBusinessDocumentHeader(
                TAX_DATA_PROFILE,
                generateInstanceIdentifier(h.invoice_no, h.invoice_issue_date),
                { ...h, business_process_type: TAX_DATA_PROFILE.processId }
            ),
            "pxs:TaxData": {
                "@xmlns:pxs": PXS_NS,
                "@xmlns:cbc": CBC_NS,
                "@xmlns:cac": CAC_NS,
                "@xmlns:cec": CEC_NS,
                "cbc:CustomizationID": text(firstFilled(h.tdd_customization_id, "urn:peppol:taxdata:ae-1")),
                "cbc:ProfileID": text(firstFilled(h.tdd_profile_id, TAX_DATA_PROFILE.processId)),
                "cbc:IssueDate": dateText(h.invoice_issue_date),
                "cbc:IssueTime": timeWithUtcSuffix(h.invoice_issue_time),
                "pxs:DocumentTypeCode": text(firstFilled(h.tdd_document_type_code, "S")),
                "pxs:DocumentScope": text(getTddScope(h)),
                "pxs:ReporterRole": text(firstFilled(h.tdd_reporter_role, "01")),
                "pxs:ReportingParty": endpointIdNode(h.seller_elec_scheme_id, h.seller_elec_address),
                "pxs:ReceivingParty": endpointIdNode(h.buyer_elec_scheme_id, h.buyer_elec_address),
                "pxs:ReportersRepresentative": buildReportersRepresentative(h),
                "pxs:ReportedTransaction": {
                    "pxs:TransportHeaderID": text(firstFilled(
                        h.TransportHeaderID,
                        h.transport_header_id,
                        h.InstanceIdentifier,
                        transportHeaderId
                    )),
                    "pxs:ReportedDocument": buildTaxDataReportedDocument(h, sourceDocument),
                    "pxs:SourceDocument": {
                        "cec:ExtensionContent": buildUblSourceDocument(sourceKey, sourceDocument)
                    }
                }
            }
        }
    };
};

const serializeDocuments = (rows, buildDocument, emptyMessage) => {
    if (!rows.length) {
        return create({ Message: emptyMessage }).end({ prettyPrint: true });
    }

    const grouped = groupByInvoice(rows);
    const documentObjects = grouped.map((group) => {
        const documentObject = buildDocument(group);
        return hasValue(getTddScope(group.header))
            ? buildTaxDataDocument(group, documentObject)
            : documentObject;
    });
    const xmlObj = grouped.length === 1
        ? documentObjects[0]
        : { StandardBusinessDocuments: documentObjects };

    return create({ version: "1.0", encoding: "UTF-8" }, cleanEmpty(xmlObj)).end({
        prettyPrint: true,
        allowEmptyTags: false
    });
};

module.exports = {
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
};
