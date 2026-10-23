# Invoice Transaction Type - Column to XML Mapping Guide

This document maps E_Invoicing database columns to XML elements for each invoice transaction type.

## Transaction Type Codes

| Code | Name | Description |
|------|------|-------------|
| `10000000` | Free Trade Zone | Supply in free trade zones with beneficiary ID |
| `01000000` | Deemed Supply | Deemed supply transactions | -- ok
| `00100000` | Margin Scheme | Margin scheme goods (second hand, works of art, antiques) |
| `00010000` | Summary Tax Invoice | Summary of multiple invoices | -- ok
| `00001000` | Continuous Supplies | Continuous supply of services over period | -- ok
| `00000100` | Disclosed Agent Billing | Billing with disclosed agent (SellerSupplierParty) |
| `00000010` | Supply through E-commerce | E-commerce supply transactions |
| `00000001` | Exports | Export supplies |
| `00000000` | Commercial Tax Invoice | Standard commercial tax invoice |-- ok

---

## Common Fields (All Types)

These fields apply to all invoice types:

| Column Name | XML Element | Required | Notes |
|---|---|---|---|
| `invoice_no` | `cbc:ID` | Yes | Invoice number |
| `unique_identifier_no` | `cbc:UUID` | Yes | Unique identifier |
| `invoice_issue_date` | `cbc:IssueDate` | Yes | Issue date (YYYY-MM-DD) |
| `invoice_issue_time` | `cbc:IssueTime` | No | Issue time (HH:MM:SS) |
| `payment_due_date` | `cbc:DueDate` | No | Due date (YYYY-MM-DD) |
| `invoice_type_code` | `cbc:InvoiceTypeCode` | Yes | Usually "380" |
| `invoice_note` | `cbc:Note` | No | Invoice note/memo |
| `invoice_currency_code` | `cbc:DocumentCurrencyCode` | Yes | Currency code (AED) |
| `invoice_txn_type_code` | `cbc:ProfileExecutionID` | Yes | Transaction type code (see table above) |
| `vat_tax_point_date` | `cbc:TaxPointDate` | No | Tax point date |
| `tax_account_currency` | `cbc:TaxCurrencyCode` | No | Tax currency if different |
| `buyer_account_ref` | `cbc:AccountingCost` | No | Buyer accounting cost |
| `buyer_reference` | `cbc:BuyerReference` | No | Buyer reference |
| `invoice_period_start` | `cac:InvoicePeriod/cbc:StartDate` | No | Period start date |
| `invoice_period_end` | `cac:InvoicePeriod/cbc:EndDate` | No | Period end date |
| `billing_frequency` | `cac:InvoicePeriod/cbc:Description` | No | Billing frequency (e.g., "MTH", "YEAR") |
| `spec_identifier` | `cbc:CustomizationID` | No | Default: "urn:peppol:pint:billing-1@ae-1" |
| `business_process_type` | `cbc:ProfileID` | No | Default: "urn:peppol:bis:billing" |

---

## Seller/Supplier Party Fields

| Column Name | XML Element | All Types | Notes |
|---|---|---|---|
| `seller_elec_scheme_id` | `cac:AccountingSupplierParty/.../cbc:EndpointID[@schemeID]` | Yes | Default: "0235" |
| `seller_elec_address` | `cac:AccountingSupplierParty/.../cbc:EndpointID` | Yes | Electronic address |
| `seller_name` | `cac:AccountingSupplierParty/.../cac:PartyName/cbc:Name` | Yes | Supplier legal name |
| `seller_trade_name` | `cac:AccountingSupplierParty/.../cac:PartyName/cbc:Name` | Yes | Supplier trade name |
| `seller_addr_line1` | `cac:AccountingSupplierParty/.../cac:PostalAddress/cbc:StreetName` | Yes | Address line 1 |
| `seller_addr_line2` | `cac:AccountingSupplierParty/.../cac:PostalAddress/cbc:AdditionalStreetName` | No | Address line 2 |
| `seller_addr_line3` | `cac:AccountingSupplierParty/.../cac:PostalAddress/cac:AddressLine/cbc:Line` | No | Address line 3 |
| `seller_city` | `cac:AccountingSupplierParty/.../cac:PostalAddress/cbc:CityName` | Yes | City |
| `seller_post_code` | `cac:AccountingSupplierParty/.../cac:PostalAddress/cbc:PostalZone` | No | Postal code |
| `seller_country_subdivision` | `cac:AccountingSupplierParty/.../cac:PostalAddress/cbc:CountrySubentity` | No | Subdivision (e.g., "DXB", "AUH") |
| `seller_country_code` | `cac:AccountingSupplierParty/.../cac:Country/cbc:IdentificationCode` | Yes | Country code (AE) |
| `seller_vat_id` | `cac:AccountingSupplierParty/.../cac:PartyTaxScheme/cbc:CompanyID` | Yes | VAT ID |
| `seller_legal_reg_id` | `cac:AccountingSupplierParty/.../cac:PartyLegalEntity/cbc:CompanyID` | No | Registration ID (from license) |
| `seller_legal_scheme_id` | `cac:AccountingSupplierParty/.../cac:PartyLegalEntity/cbc:CompanyID[@schemeID]` | No | Scheme ID for legal reg |
| `seller_contact_point` | `cac:AccountingSupplierParty/.../cac:Contact/cbc:Name` | No | Contact person name |
| `seller_contact_phone` | `cac:AccountingSupplierParty/.../cac:Contact/cbc:Telephone` | No | Contact phone |
| `seller_contact_email` | `cac:AccountingSupplierParty/.../cac:Contact/cbc:ElectronicMail` | No | Contact email |

---

## Buyer/Customer Party Fields

| Column Name | XML Element | All Types | Notes |
|---|---|---|---|
| `buyer_elec_scheme_id` | `cac:AccountingCustomerParty/.../cbc:EndpointID[@schemeID]` | No | Default: "0235" |
| `buyer_elec_address` | `cac:AccountingCustomerParty/.../cbc:EndpointID` | No | Electronic address |
| `buyer_id` | `cac:AccountingCustomerParty/.../cac:PartyIdentification/cbc:ID` | No | Buyer identifier |
| `buyer_name` | `cac:AccountingCustomerParty/.../cac:PartyName/cbc:Name` | Yes | Buyer legal name |
| `buyer_addr_line1` | `cac:AccountingCustomerParty/.../cac:PostalAddress/cbc:StreetName` | No | Address line 1 |
| `buyer_addr_line2` | `cac:AccountingCustomerParty/.../cac:PostalAddress/cbc:AdditionalStreetName` | No | Address line 2 |
| `buyer_addr_line3` | `cac:AccountingCustomerParty/.../cac:PostalAddress/cac:AddressLine/cbc:Line` | No | Address line 3 |
| `buyer_city` | `cac:AccountingCustomerParty/.../cac:PostalAddress/cbc:CityName` | No | City |
| `buyer_post_code` | `cac:AccountingCustomerParty/.../cac:PostalAddress/cbc:PostalZone` | No | Postal code |
| `buyer_country_subdivision` | `cac:AccountingCustomerParty/.../cac:PostalAddress/cbc:CountrySubentity` | No | Subdivision |
| `buyer_country_code` | `cac:AccountingCustomerParty/.../cac:Country/cbc:IdentificationCode` | No | Country code |
| `buyer_vat_id` | `cac:AccountingCustomerParty/.../cac:PartyTaxScheme/cbc:CompanyID` | No | VAT ID |
| `buyer_legal_reg_id` | `cac:AccountingCustomerParty/.../cac:PartyLegalEntity/cbc:CompanyID` | No | Legal registration ID |
| `buyer_contact_point` | `cac:AccountingCustomerParty/.../cac:Contact/cbc:Name` | No | Contact person |
| `buyer_contact_phone` | `cac:AccountingCustomerParty/.../cac:Contact/cbc:Telephone` | No | Contact phone |
| `buyer_contact_email` | `cac:AccountingCustomerParty/.../cac:Contact/cbc:ElectronicMail` | No | Contact email |

---

## Type-Specific Fields

### Free Trade Zone (`10000000`)

| Column Name | XML Element | Required | Notes |
|---|---|---|---|
| `beneficiary_id` | `cac:PayeeParty/cac:PartyIdentification/cbc:ID` | **YES** | Free Zone beneficiary ID |
| `principle_id` | `cac:PayeeParty/cac:PartyIdentification/cbc:ID[@schemeID]` | **YES** | Principle ID scheme |
| `payee_name` | `cac:PayeeParty/cac:PartyName/cbc:Name` | No | Payee name |
| `payee_id` | `cac:PayeeParty/cac:PartyIdentification/cbc:ID` | No | Additional payee ID |
| `payee_legal_reg_id` | `cac:PayeeParty/cac:PartyLegalEntity/cbc:CompanyID` | No | Payee legal ID |

**Sample:** [Free trade Zone Beneficiery ID Sample.xml](../Invoice%20Transaction%20Type%20Code%20Samples/Free%20trade%20Zone%20Beneficiery%20ID%20Sample.xml)

---

### Disclosed Agent Billing (`00000100`)

| Column Name | XML Element | Required | Notes |
|---|---|---|---|
| `seller_supplier_party_id` | `cac:SellerSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID` | **YES** | Actual supplier ID |
| `principle_id` | `cac:SellerSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID` | Fallback | Used when `seller_supplier_party_id` / `seller_party_id` is not populated |
| `seller_supplier_scheme_id` | `cac:SellerSupplierParty/cac:Party/.../cbc:ID[@schemeID]` | No | Scheme for supplier ID |
| `seller_supplier_party_name` | `cac:SellerSupplierParty/cac:Party/cac:PartyName/cbc:Name` | No | Actual supplier name |
| `seller_supplier_party_legal_id` | `cac:SellerSupplierParty/cac:Party/.../cbc:CompanyID` | No | Supplier legal entity ID |
| `seller_supplier_party_legal_scheme_id` | `cac:SellerSupplierParty/cac:Party/.../cbc:CompanyID[@schemeID]` | No | Scheme for legal ID |

**Sample:** [Disclosed agent billing_Principle ID Sample.xml](../Invoice%20Transaction%20Type%20Code%20Samples/Disclosed%20agent%20billing_Principle%20ID%20Sample.xml)

---

### Margin Scheme (`00100000`)

| Column Name | XML Element | Required | Notes |
|---|---|---|---|
| `item_vat_cat_code` | `cac:ClassifiedTaxCategory/cbc:ID` | No | Use "N" for margin scheme items |
| `invoice_line_note` | `cac:InvoiceLine/cbc:Note` | No | Should indicate "Margin scheme goods" |

**Tax Category:** Margin scheme invoices use tax category code **"N"** instead of standard rates (S, Z, E).

**Sample:** [Margin scheme.xml](../Invoice%20Transaction%20Type%20Code%20Samples/Margin%20scheme.xml)

---

### Continuous Supplies (`00001000`)

| Column Name | XML Element | Required | Notes |
|---|---|---|---|
| `invoice_period_start` | `cac:InvoicePeriod/cbc:StartDate` | **YES** | Period start |
| `invoice_period_end` | `cac:InvoicePeriod/cbc:EndDate` | **YES** | Period end |
| `billing_frequency` | `cac:InvoicePeriod/cbc:Description` | **YES** | Frequency: "MTH", "QRT", "ANN", etc. |
| `contract_ref` | `cac:ContractDocumentReference/cbc:ID` | No | Contract reference |
| `contract_value` | `cac:ContractDocumentReference/cbc:DocumentDescription` | No | Contract value |
| `invoice_line_period_start` | `cac:InvoiceLine/cac:InvoicePeriod/cbc:StartDate` | No | Line-level period |
| `invoice_line_period_end` | `cac:InvoiceLine/cac:InvoicePeriod/cbc:EndDate` | No | Line-level period |

**Sample:** [Continuous supplies.xml](../Invoice%20Transaction%20Type%20Code%20Samples/Continuous%20supplies.xml)

---

### Summary Tax Invoice (`00010000`)

| Column Name | XML Element | Required | Notes |
|---|---|---|---|
| `invoice_period_start` | `cac:InvoicePeriod/cbc:StartDate` | **YES** | Summary period start |
| `invoice_period_end` | `cac:InvoicePeriod/cbc:EndDate` | **YES** | Summary period end |
| `preceding_invoice_ref` | `cac:BillingReference/cac:InvoiceDocumentReference/cbc:ID` | No | Reference to original invoices |

**Sample:** [Summary tax invoice.xml](../Invoice%20Transaction%20Type%20Code%20Samples/Summary%20tax%20invoice.xml)

---

### Supply through E-commerce (`00000010`)

| Column Name | XML Element | Required | Notes |
|---|---|---|---|
| `deliver_to_location_id` | `cac:Delivery/cac:DeliveryLocation/cbc:ID` | No | Delivery location |
| `deliver_to_addr_line1` | `cac:Delivery/cac:DeliveryLocation/cac:Address/cbc:StreetName` | No | Delivery address |
| `deliver_to_city` | `cac:Delivery/cac:DeliveryLocation/cac:Address/cbc:CityName` | No | Delivery city |
| `deliver_to_country_code` | `cac:Delivery/cac:DeliveryLocation/cac:Address/cac:Country/cbc:IdentificationCode` | No | Delivery country |
| `actual_delivery_date` | `cac:Delivery/cbc:ActualDeliveryDate` | No | Actual delivery date |

**Sample:** [Supply through e-commerce.xml](../Invoice%20Transaction%20Type%20Code%20Samples/Supply%20through%20e-commerce.xml)

---

### Exports (`00000001`)

| Column Name | XML Element | Required | Notes |
|---|---|---|---|
| `item_vat_cat_code` | `cac:ClassifiedTaxCategory/cbc:ID` | No | Use "Z" (zero-rated) for exports |
| `deliver_to_country_code` | `cac:Delivery/.../cac:Country/cbc:IdentificationCode` | No | Non-AE country for exports |
| `customs_ref_no` | `cac:StatementDocumentReference/cbc:ID` | No | Customs reference |

**Tax Category:** Export invoices typically use **"Z"** (zero-rated) tax category.

---

## Invoice Line Item Fields

| Column Name | XML Element | Notes |
|---|---|---|
| `invoice_line_id` | `cac:InvoiceLine/cbc:ID` | Line number |
| `invoice_line_note` | `cac:InvoiceLine/cbc:Note` | Special notes for line |
| `invoiced_qty` | `cac:InvoiceLine/cbc:InvoicedQuantity` | Quantity |
| `invoiced_qty_uom_code` | `cac:InvoiceLine/cbc:InvoicedQuantity[@unitCode]` | Unit of measure |
| `invoice_line_net_amt` | `cac:InvoiceLine/cbc:LineExtensionAmount` | Line net amount |
| `invoice_line_buyer_acc_ref` | `cac:InvoiceLine/cbc:AccountingCost` | Buyer accounting reference |
| `invoice_line_period_start` | `cac:InvoiceLine/cac:InvoicePeriod/cbc:StartDate` | For continuous supplies |
| `invoice_line_period_end` | `cac:InvoiceLine/cac:InvoicePeriod/cbc:EndDate` | For continuous supplies |
| `item_name` | `cac:InvoiceLine/cac:Item/cbc:Name` | Item name |
| `item_description` | `cac:InvoiceLine/cac:Item/cbc:Description` | Item description |
| `item_vat_cat_code` | `cac:InvoiceLine/cac:Item/cac:ClassifiedTaxCategory/cbc:ID` | VAT category (S, E, Z, N, etc.) |
| `item_vat_rate` | `cac:InvoiceLine/cac:Item/cac:ClassifiedTaxCategory/cbc:Percent` | VAT rate percentage |
| `item_net_price` | `cac:InvoiceLine/cac:Price/cbc:PriceAmount` | Price per unit |

---

## Usage Example

To generate an invoice XML for **Free Trade Zone** type:

1. Set `invoice_txn_type_code = '10000000'`
2. Populate seller and buyer party fields
3. **Required fields:**
   - `beneficiary_id` 
   - `principle_id`
4. Include invoice lines with standard items
5. System will automatically:
   - Set ProfileExecutionID to "10000000"
   - Include PayeeParty element with beneficiary/principle IDs
   - Use standard tax categories for items

---

## Notes

- The ProfileExecutionID is always set based on `invoice_txn_type_code`
- Fallback to "00000000" (Commercial Tax Invoice) if type code is unknown
- All timestamps use ISO 8601 format (YYYY-MM-DDTHH:MM:SS)
- All dates use YYYY-MM-DD format
- All amounts are decimal with 2-4 decimal places
- Currency code defaults to "AED"
