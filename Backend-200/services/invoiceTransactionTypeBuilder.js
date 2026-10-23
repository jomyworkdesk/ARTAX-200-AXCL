/**
 * Invoice Transaction Type Definitions and Builders
 * Handles XML generation specific to each invoice transaction type per UAE e-invoicing requirements
 */

const TRANSACTION_TYPES = {
    // Transaction type code => { code, name, description }
    FREE_TRADE_ZONE: {
        code: "10000000",
        name: "Free Trade Zone",
        description: "Supply in free trade zones with beneficiary ID"
    },
    DEEMED_SUPPLY: {
        code: "01000000",
        name: "Deemed Supply",
        description: "Deemed supply transactions"
    },
    MARGIN_SCHEME: {
        code: "00100000",
        name: "Margin Scheme",
        description: "Margin scheme goods (second hand, works of art, antiques)"
    },
    VAT_MARGIN_SCHEME_SECOND_HAND: {
        code: "00100000",
        name: "VAT Margin Scheme - Second Hand Goods",
        description: "Margin scheme for second hand goods"
    },
    VAT_MARGIN_SCHEME_ARTWORK: {
        code: "00100000",
        name: "VAT Margin Scheme - Works of Art",
        description: "Margin scheme for works of art"
    },
    VAT_MARGIN_SCHEME_ANTIQUES: {
        code: "00100000",
        name: "VAT Margin Scheme - Collectors Items and Antiques",
        description: "Margin scheme for antiques and collectibles"
    },
    SUMMARY_TAX_INVOICE: {
        code: "00010000",
        name: "Summary Tax Invoice",
        description: "Summary of multiple invoices"
    },
    CONTINUOUS_SUPPLIES: {
        code: "00001000",
        name: "Continuous Supplies",
        description: "Continuous supply of services over period"
    },
    DISCLOSED_AGENT_BILLING: {
        code: "00000100",
        name: "Disclosed Agent Billing",
        description: "Billing with disclosed agent (SellerSupplierParty)"
    },
    SUPPLY_ECOMMERCE: {
        code: "00000010",
        name: "Supply through E-commerce",
        description: "E-commerce supply transactions"
    },
    EXPORTS: {
        code: "00000001",
        name: "Exports",
        description: "Export supplies"
    },
    COMMERCIAL_TAX_INVOICE: {
        code: "00000000",
        name: "Commercial Tax Invoice",
        description: "Standard commercial tax invoice"
    }
};

/**
 * Get transaction type metadata by code
 */
const getTransactionType = (code) => {
    if (!code) return TRANSACTION_TYPES.COMMERCIAL_TAX_INVOICE;
    
    const normalized = String(code).trim();
    
    // Find matching transaction type
    for (const txnType of Object.values(TRANSACTION_TYPES)) {
        if (txnType.code === normalized) {
            return txnType;
        }
    }
    
    // Fallback to commercial if unknown
    return TRANSACTION_TYPES.COMMERCIAL_TAX_INVOICE;
};

/**
 * Check if invoice type requires SellerSupplierParty
 */
const requiresSellerSupplierParty = (txnTypeCode) => {
    const txnType = getTransactionType(txnTypeCode);
    return txnType.code === TRANSACTION_TYPES.DISCLOSED_AGENT_BILLING.code;
};

/**
 * Check if invoice type requires PayeeParty with beneficiary/principle IDs
 */
const requiresPayeePartyWithBeneficiary = (txnTypeCode) => {
    const txnType = getTransactionType(txnTypeCode);
    return txnType.code === TRANSACTION_TYPES.FREE_TRADE_ZONE.code;
};

/**
 * Get special handling flags for transaction type
 */
const getSpecialHandling = (txnTypeCode) => {
    const txnType = getTransactionType(txnTypeCode);
    
    return {
        // Disclosed Agent Billing - needs SellerSupplierParty
        requiresSellerSupplierParty: txnType.code === TRANSACTION_TYPES.DISCLOSED_AGENT_BILLING.code,
        
        // Free Trade Zone - needs beneficiary and principle IDs in PayeeParty
        requiresBeneficiaryId: txnType.code === TRANSACTION_TYPES.FREE_TRADE_ZONE.code,
        
        // Margin Scheme types - tax category code "N" for margin scheme
        isMarginScheme: txnType.code === TRANSACTION_TYPES.MARGIN_SCHEME.code,
        
        // Continuous Supplies - uses invoice periods
        isContinuousSupply: txnType.code === TRANSACTION_TYPES.CONTINUOUS_SUPPLIES.code,
        
        // Summary Invoice - aggregates multiple invoices
        isSummaryInvoice: txnType.code === TRANSACTION_TYPES.SUMMARY_TAX_INVOICE.code,
        
        // E-commerce supply
        isEcommerce: txnType.code === TRANSACTION_TYPES.SUPPLY_ECOMMERCE.code,
        
        // Exports - may have special VAT treatment
        isExport: txnType.code === TRANSACTION_TYPES.EXPORTS.code,
        
        transactionType: txnType
    };
};

/**
 * Get default tax category for transaction type
 * Margin scheme uses "N", others use standard categories
 */
const getDefaultTaxCategory = (txnTypeCode) => {
    const handling = getSpecialHandling(txnTypeCode);
    
    if (handling.isMarginScheme) {
        return "N"; // Margin scheme tax category
    }
    if (handling.isExport || handling.isEcommerce) {
        return "Z"; // Zero-rated or exempt for exports/ecommerce
    }
    if (handling.isContinuousSupply) {
        return "S"; // Standard rate for continuous supplies
    }
    
    return "S"; // Default to standard rate
};

/**
 * Get mapping of E_Invoicing columns to XML elements for each transaction type
 * This helps document which database fields map to which XML nodes per type
 */
const getColumnMapping = (txnTypeCode) => {
    const handling = getSpecialHandling(txnTypeCode);
    
    // Base mapping applicable to all types
    const baseMapping = {
        "invoice_no": "cbc:ID",
        "unique_identifier_no": "cbc:UUID",
        "invoice_issue_date": "cbc:IssueDate",
        "payment_due_date": "cbc:DueDate",
        "invoice_type_code": "cbc:InvoiceTypeCode",
        "invoice_note": "cbc:Note",
        "invoice_currency_code": "cbc:DocumentCurrencyCode",
        "invoice_txn_type_code": "cbc:ProfileExecutionID",
        "invoice_period_start": "cac:InvoicePeriod/cbc:StartDate",
        "invoice_period_end": "cac:InvoicePeriod/cbc:EndDate",
        "billing_frequency": "cac:InvoicePeriod/cbc:Description",
        "seller_name": "cac:AccountingSupplierParty/cac:Party/cac:PartyName/cbc:Name",
        "buyer_name": "cac:AccountingCustomerParty/cac:Party/cac:PartyName/cbc:Name",
        "seller_vat_id": "cac:AccountingSupplierParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID",
        "buyer_vat_id": "cac:AccountingCustomerParty/cac:Party/cac:PartyTaxScheme/cbc:CompanyID"
    };
    
    // Type-specific mappings
    const typeSpecificMapping = {};
    
    if (handling.requiresSellerSupplierParty) {
        typeSpecificMapping.seller_supplier_party_id = "cac:SellerSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID";
        typeSpecificMapping.principle_id = "cac:SellerSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID [fallback source column]";
        typeSpecificMapping.seller_supplier_party_name = "cac:SellerSupplierParty/cac:Party/cac:PartyName/cbc:Name";
    }
    
    if (handling.requiresBeneficiaryId) {
        typeSpecificMapping.beneficiary_id = "cac:PayeeParty/cac:PartyIdentification/cbc:ID";
        typeSpecificMapping.principle_id = "cac:PayeeParty/cac:PartyIdentification/cbc:ID[@schemeID]";
    }
    
    if (handling.isMarginScheme) {
        typeSpecificMapping.item_vat_cat_code = "cac:ClassifiedTaxCategory/cbc:ID [N for margin scheme]";
    }
    
    return { ...baseMapping, ...typeSpecificMapping };
};

module.exports = {
    TRANSACTION_TYPES,
    getTransactionType,
    requiresSellerSupplierParty,
    requiresPayeePartyWithBeneficiary,
    getSpecialHandling,
    getDefaultTaxCategory,
    getColumnMapping
};
