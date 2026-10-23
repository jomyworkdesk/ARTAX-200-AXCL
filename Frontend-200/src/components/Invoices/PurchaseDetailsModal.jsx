import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, FileText, Download, RotateCw, Send, AlertCircle } from 'lucide-react';
import { useSnackbar } from '../Snackbar';
import { generateInvoicePdf } from '../../utils/invoicePdf';
import { getDocumentTypeConfig, getSendUrl, getXmlUrl } from '../../utils/documentTypeConfig';
import { API_BASE_URL, apiFetch } from '../../services/apiService';

import './InvoiceDetailsModal.css';

const downloadXmlBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const TRANSACTION_TYPE_NAMES = {
  '10000000': 'Free Trade Zone',
  '01000000': 'Deemed Supply',
  '00100000': 'Margin Scheme',
  '00010000': 'Summary Tax Invoice',
  '00001000': 'Continuous Supplies',
  '00000100': 'Disclosed Agent Billing',
  '00000010': 'Supply through E-commerce',
  '00000001': 'Exports',
  '00000000': 'Commercial Tax Invoice'
};

const valueFrom = (source, keys) => {
  const keyList = Array.isArray(keys) ? keys : [keys];
  for (const key of keyList) {
    const value = source?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') return value;
  }
  return '';
};

const commonDocumentFields = [
  { label: 'Document number', keys: ['invoice_no', 'InvoiceNumber', 'InvNumber'] },
  { label: 'Unique identifier number', keys: ['unique_identifier_no', 'UUID'] },
  { label: 'Issue date', keys: ['invoice_issue_date', 'InvoiceIssueDate'], type: 'date' },
  { label: 'Issue time', keys: ['invoice_issue_time'] },
  { label: 'Payment due date', keys: ['payment_due_date', 'InvoicePaymentDueDate'], type: 'date', invoiceOnly: true },
  { label: 'Type code', keys: ['invoice_type_code', 'EInvoiceType'] },
  { label: 'Note', keys: ['invoice_note'] },
  { label: 'Document currency code', keys: ['invoice_currency_code', 'InvoiceCurrencyCode'] },
  { label: 'Transaction type code', keys: ['invoice_txn_type_code', 'TransactionCode', 'syntax_binding_qualifier'], type: 'transactionType' },
  { label: 'Tax point date', keys: ['vat_tax_point_date'], type: 'date', invoiceOnly: true },
  { label: 'Tax account currency', keys: ['tax_account_currency'] },
  { label: 'Buyer accounting cost', keys: ['buyer_account_ref'] },
  { label: 'Buyer reference', keys: ['buyer_reference'] },
  { label: 'Invoice period start', keys: ['invoice_period_start'], type: 'date' },
  { label: 'Invoice period end', keys: ['invoice_period_end'], type: 'date' },
  { label: 'Billing frequency', keys: ['billing_frequency'] },
  { label: 'Specification identifier', keys: ['spec_identifier'] },
  { label: 'Business process type', keys: ['business_process_type'] },
  { label: 'Payment means code', keys: ['payment_means_type_code', 'PaymentType'] },
  { label: 'Payment means text', keys: ['payment_means_text'] },
  { label: 'Payment ID', keys: ['remittance_info'] },
  { label: 'Payment ID scheme', keys: ['remittance_scheme_id'] },
  { label: 'Payment card number', keys: ['payment_card_no'] },
  { label: 'Payment card network ID', keys: ['payment_card_network_id'] },
  { label: 'Payment card holder name', keys: ['payment_card_holder_name'] },
  { label: 'Payment account ID', keys: ['payment_account_id'] },
  { label: 'Payment account scheme ID', keys: ['payment_account_scheme_id'] },
  { label: 'Payment account name', keys: ['payment_account_name'] },
  { label: 'Payment service provider ID', keys: ['payment_service_provider_id'] },
  { label: 'Payment terms', keys: ['payment_terms'] },
  { label: 'Preceding invoice reference', keys: ['preceding_invoice_ref', 'PrecedingInvoiceRef'], creditNoteOnly: true },
  { label: 'Preceding invoice date', keys: ['preceding_invoice_date', 'PrecedingInvoiceDate'], type: 'date', creditNoteOnly: true },
  { label: 'Credit note reason code', keys: ['credit_note_reason_code', 'CreditNoteReasonCode'], creditNoteOnly: true }
];

const sellerFields = [
  { label: 'Electronic address', keys: ['seller_elec_address'] },
  { label: 'Electronic address scheme ID', keys: ['seller_elec_scheme_id'] },
  { label: 'Seller ID', keys: ['seller_id'] },
  { label: 'Seller scheme ID', keys: ['seller_scheme_id'] },
  { label: 'Seller legal name', keys: ['seller_name', 'SellerName'] },
  { label: 'Seller trade name', keys: ['seller_trade_name'] },
  { label: 'Address line 1', keys: ['seller_addr_line1', 'SellerAddressline1'] },
  { label: 'Address line 2', keys: ['seller_addr_line2'] },
  { label: 'Address line 3', keys: ['seller_addr_line3'] },
  { label: 'City', keys: ['seller_city', 'SellerCity'] },
  { label: 'Postal code', keys: ['seller_post_code'] },
  { label: 'Country subdivision', keys: ['seller_country_subdivision', 'SellerCountrySubdivision'] },
  { label: 'Country code', keys: ['seller_country_code', 'SellerCountryCode'] },
  { label: 'VAT identifier', keys: ['seller_vat_id'] },
  { label: 'Tax scheme code', keys: ['seller_tax_scheme_code'] },
  { label: 'Legal registration ID', keys: ['seller_legal_reg_id'] },
  { label: 'Legal registration scheme ID', keys: ['seller_legal_scheme_id'] },
  { label: 'Legal registration type', keys: ['seller_legal_reg_type'] },
  { label: 'Authority name', keys: ['seller_authority_name'] },
  { label: 'Contact point', keys: ['seller_contact_point'] },
  { label: 'Contact phone', keys: ['seller_contact_phone'] },
  { label: 'Contact email', keys: ['seller_contact_email'] }
];

const buyerFields = [
  { label: 'Electronic address', keys: ['buyer_elec_address'] },
  { label: 'Electronic address scheme ID', keys: ['buyer_elec_scheme_id'] },
  { label: 'Buyer ID', keys: ['buyer_id'] },
  { label: 'Buyer scheme ID', keys: ['buyer_scheme_id'] },
  { label: 'Buyer legal name', keys: ['buyer_name', 'BuyerName'] },
  { label: 'Buyer trade name', keys: ['buyer_trade_name'] },
  { label: 'Address line 1', keys: ['buyer_addr_line1', 'BuyerAddressline1'] },
  { label: 'Address line 2', keys: ['buyer_addr_line2'] },
  { label: 'Address line 3', keys: ['buyer_addr_line3'] },
  { label: 'City', keys: ['buyer_city', 'BuyerCity'] },
  { label: 'Postal code', keys: ['buyer_post_code'] },
  { label: 'Country subdivision', keys: ['buyer_country_subdivision', 'BuyerCountrySubdivision'] },
  { label: 'Country code', keys: ['buyer_country_code', 'BuyerCountry'] },
  { label: 'VAT identifier', keys: ['buyer_vat_id'] },
  { label: 'Tax scheme code', keys: ['buyer_tax_scheme_code'] },
  { label: 'Legal registration ID', keys: ['buyer_legal_reg_id'] },
  { label: 'Legal registration scheme ID', keys: ['buyer_legal_scheme_id'] },
  { label: 'Contact point', keys: ['buyer_contact_point'] },
  { label: 'Contact phone', keys: ['buyer_contact_phone'] },
  { label: 'Contact email', keys: ['buyer_contact_email'] }
];

const referenceFields = [
  { label: 'Purchase order reference', keys: ['purchase_order_ref'] },
  { label: 'Sales order reference', keys: ['sales_order_ref'] },
  { label: 'Preceding invoice reference', keys: ['preceding_invoice_ref', 'PrecedingInvoiceRef'] },
  { label: 'Despatch advice reference', keys: ['despatch_advice_ref'] },
  { label: 'Receiving advice reference', keys: ['receiving_advice_ref'] },
  { label: 'Customs reference number', keys: ['customs_ref_no'] },
  { label: 'Originator document reference', keys: ['originator_doc_ref'] },
  { label: 'Contract reference', keys: ['contract_ref'] },
  { label: 'Contract value', keys: ['contract_value'] },
  { label: 'Inbound document link', keys: ['inDocument'] },
  { label: 'Inbound document ID', keys: ['in_document_id'] },
  { label: 'Inbound document invoice ID', keys: ['in_document_einvoice_id'] },
  { label: 'Inbound document invoice number', keys: ['in_document_invoice_no'] },
  { label: 'Project reference', keys: ['project_ref'] },
  { label: 'Invoiced object ID', keys: ['invoiced_obj_id'] },
  { label: 'Invoiced object scheme ID', keys: ['invoiced_obj_scheme_id'] },
  { label: 'Document type code', keys: ['document_type_code'] },
  { label: 'Support document reference', keys: ['support_doc_ref'] },
  { label: 'Support document description', keys: ['support_doc_desc'] },
  { label: 'External document location', keys: ['external_doc_location'] },
  { label: 'Attached document filename', keys: ['attached_doc_filename'] },
  { label: 'Attached document MIME code', keys: ['attached_doc_mime_code'] },
  { label: 'Attached document content', keys: ['attached_document'], type: 'presence' }
];

const deliveryFields = [
  { label: 'Actual delivery date', keys: ['actual_delivery_date'], type: 'date' },
  { label: 'Delivery location ID', keys: ['deliver_to_location_id'] },
  { label: 'Delivery scheme ID', keys: ['deliver_to_scheme_id'] },
  { label: 'Delivery address line 1', keys: ['deliver_to_addr_line1'] },
  { label: 'Delivery address line 2', keys: ['deliver_to_addr_line2'] },
  { label: 'Delivery address line 3', keys: ['deliver_to_addr_line3'] },
  { label: 'Delivery city', keys: ['deliver_to_city'] },
  { label: 'Delivery postal code', keys: ['deliver_to_post_code'] },
  { label: 'Delivery country subdivision', keys: ['deliver_to_country_subdivision'] },
  { label: 'Delivery country code', keys: ['deliver_to_country_code'] },
  { label: 'Delivery party ID', keys: ['deliver_to_party_id'] },
  { label: 'Delivery party name', keys: ['deliver_to_party_name'] },
  { label: 'Incoterms', keys: ['incoterms'] },
  { label: 'Incoterms scheme ID', keys: ['incoterms_scheme_id'] }
];

const totalFields = [
  { label: 'Invoice line net total', keys: ['invoice_line_net_total', 'InvTotExcl'], type: 'currency' },
  { label: 'Total amount without tax', keys: ['invoice_total_without_tax', 'InvTotExcl'], type: 'currency' },
  { label: 'Total tax amount', keys: ['invoice_total_tax_amt', 'InvTotTax'], type: 'currency' },
  { label: 'Total amount with tax', keys: ['invoice_total_with_tax', 'InvTotIncl'], type: 'currency' },
  { label: 'Total document allowances', keys: ['total_doc_allowances'], type: 'currency' },
  { label: 'Total document charges', keys: ['total_doc_charges'], type: 'currency' },
  { label: 'Paid amount', keys: ['paid_amount'], type: 'currency' },
  { label: 'Rounding amount', keys: ['rounding_amount'], type: 'currency' },
  { label: 'Amount due for payment', keys: ['amount_due', 'InvTotIncl'], type: 'currency' },
  { label: 'VAT category taxable amount', keys: ['vat_cat_taxable_amt', 'TotalInvoiceAmt'], type: 'currency' },
  { label: 'VAT category tax amount', keys: ['vat_cat_tax_amt'], type: 'currency' },
  { label: 'VAT category code', keys: ['vat_cat_code', 'VatCategory'] },
  { label: 'VAT category rate', keys: ['vat_cat_rate', 'ItemVatPrice'] },
  { label: 'VAT tax scheme code', keys: ['vat_cat_tax_scheme_code'] },
  { label: 'Invoice total VAT in tax currency', keys: ['invoice_total_vat_tax_currency'], type: 'currency', currencyCode: 'AED' },
  { label: 'Source currency code', keys: ['source_currency_code'] },
  { label: 'Target currency code', keys: ['target_currency_code'] },
  { label: 'Calculation rate', keys: ['calculation_rate'] }
];

const allowanceChargeFields = [
  { label: 'Document charge reason code', keys: ['doc_charge_reason_code'] },
  { label: 'Document charge reason', keys: ['doc_charge_reason'] },
  { label: 'Document charge percent', keys: ['doc_charge_percent'] },
  { label: 'Document charge amount', keys: ['doc_charge_amount'], type: 'currency' },
  { label: 'Document charge base amount', keys: ['doc_charge_base_amount'], type: 'currency' },
  { label: 'Document charge VAT category code', keys: ['doc_charge_vat_cat_code'] },
  { label: 'Document charge VAT rate', keys: ['doc_charge_vat_rate'] },
  { label: 'Document allowance reason code', keys: ['doc_allow_reason_code'] },
  { label: 'Document allowance reason', keys: ['doc_allow_reason'] },
  { label: 'Document allowance percent', keys: ['doc_allow_percent'] },
  { label: 'Document allowance amount', keys: ['doc_allow_amount'], type: 'currency' },
  { label: 'Document allowance base amount', keys: ['doc_allow_base_amount'], type: 'currency' },
  { label: 'Document allowance VAT category code', keys: ['doc_allow_vat_cat_code'] },
  { label: 'Document allowance VAT rate', keys: ['doc_allow_vat_rate'] }
];

const taxRepresentativeFields = [
  { label: 'Tax representative name', keys: ['seller_tax_rep_name'] },
  { label: 'Tax representative VAT ID', keys: ['seller_tax_rep_vat_id'] },
  { label: 'Address line 1', keys: ['tax_rep_addr_line1'] },
  { label: 'Address line 2', keys: ['tax_rep_addr_line2'] },
  { label: 'Address line 3', keys: ['tax_rep_addr_line3'] },
  { label: 'City', keys: ['tax_rep_city'] },
  { label: 'Postal code', keys: ['tax_rep_post_code'] },
  { label: 'Country subdivision', keys: ['tax_rep_country_subdivision'] },
  { label: 'Country code', keys: ['tax_rep_country_code'] },
  { label: 'Tax scheme code', keys: ['tax_rep_tax_scheme_code'] }
];

const typeSpecificFields = {
  '10000000': [
    { label: 'Beneficiary ID', keys: ['beneficiary_id'] },
    { label: 'Principle ID', keys: ['principle_id'] },
    { label: 'Payee name', keys: ['payee_name'] },
    { label: 'Payee ID', keys: ['payee_id'] },
    { label: 'Payee scheme ID', keys: ['payee_scheme_id'] },
    { label: 'Payee legal registration ID', keys: ['payee_legal_reg_id'] },
    { label: 'Payee legal scheme ID', keys: ['payee_legal_scheme_id'] }
  ],
  '00000100': [
    { label: 'Seller supplier party ID', keys: ['seller_supplier_party_id', 'seller_party_id', 'principle_id'] },
    { label: 'Seller supplier scheme ID', keys: ['seller_supplier_scheme_id'] },
    { label: 'Seller supplier party name', keys: ['seller_supplier_party_name'] },
    { label: 'Seller supplier party legal ID', keys: ['seller_supplier_party_legal_id'] },
    { label: 'Seller supplier party legal scheme ID', keys: ['seller_supplier_party_legal_scheme_id'] }
  ],
  '00001000': [
    { label: 'Invoice period start', keys: ['invoice_period_start'], type: 'date' },
    { label: 'Invoice period end', keys: ['invoice_period_end'], type: 'date' },
    { label: 'Billing frequency', keys: ['billing_frequency'] },
    { label: 'Contract reference', keys: ['contract_ref'] },
    { label: 'Contract value', keys: ['contract_value'] }
  ],
  '00010000': [
    { label: 'Invoice period start', keys: ['invoice_period_start'], type: 'date' },
    { label: 'Invoice period end', keys: ['invoice_period_end'], type: 'date' },
    { label: 'Preceding invoice reference', keys: ['preceding_invoice_ref'] }
  ],
  '00000010': [
    { label: 'Delivery location ID', keys: ['deliver_to_location_id'] },
    { label: 'Delivery address line 1', keys: ['deliver_to_addr_line1'] },
    { label: 'Delivery city', keys: ['deliver_to_city'] },
    { label: 'Delivery country code', keys: ['deliver_to_country_code'] },
    { label: 'Actual delivery date', keys: ['actual_delivery_date'], type: 'date' }
  ],
  '00000001': [
    { label: 'Delivery country code', keys: ['deliver_to_country_code'] },
    { label: 'Customs reference number', keys: ['customs_ref_no'] }
  ],
  '00100000': [
    { label: 'Margin scheme item VAT category', keys: ['item_vat_cat_code', 'ItemVatCategory'] },
    { label: 'Invoice line note', keys: ['invoice_line_note'] }
  ]
};

const PurchaseDetailsModal = ({ isOpen, onClose, invoice, invoiceId, documentType = 'purchase', onUpdated }) => {
  const snackbar = useSnackbar();
  const navigate = useNavigate();
  const [details, setDetails] = useState(null);
  const [detailRows, setDetailRows] = useState([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDownloadingAttachment, setIsDownloadingAttachment] = useState(false);

  const hasValue = (value) => value !== null && value !== undefined && String(value).trim() !== '';
  const hasAnyFieldValue = (fields, source = details) => fields.some((field) => hasValue(getFieldValue(field, source)));
  const getSectionTitleClass = (hasData) => `section-title ${hasData ? 'section-title-filled' : 'section-title-missing'}`;
  const getFieldLabelClass = (value) => `dt-label ${hasValue(value) ? 'dt-label-filled' : 'dt-label-missing'}`;
  const getTableHeaderClass = (hasData) => `line-header ${hasData ? 'line-header-filled' : 'line-header-missing'}`;
  const transactionTypeLabel = (code) => {
    const safeCode = String(code || '').padStart(8, '0');
    return TRANSACTION_TYPE_NAMES[safeCode] ? `${safeCode} - ${TRANSACTION_TYPE_NAMES[safeCode]}` : code;
  };

  const formatNumber = (value) => {
    if (!hasValue(value)) return '';
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(2) : value;
  };

  const getInvoiceCurrencyCode = (source = details) =>
    valueFrom(source, ['invoice_currency_code', 'InvoiceCurrencyCode'])
    || valueFrom(details, ['invoice_currency_code', 'InvoiceCurrencyCode'])
    || valueFrom(invoice, ['invoice_currency_code', 'InvoiceCurrencyCode'])
    || 'AED';

  const formatCurrency = (amount, source = details, currencyOverride = null) => {
    if (!hasValue(amount)) return '';
    const currency = String(currencyOverride || getInvoiceCurrencyCode(source)).trim().toUpperCase();

    try {
      return new Intl.NumberFormat('en-AE', {
        style: 'currency',
        currency
      }).format(amount);
    } catch {
      return `${currency} ${formatNumber(amount)}`;
    }
  };

  const getFieldValue = (field, source = details) => {
    const rawValue = valueFrom(source, field.keys);
    if (!hasValue(rawValue)) return '';
    if (field.type === 'presence') return 'Available';
    if (field.type === 'date') return formatDate(rawValue);
    if (field.type === 'currency') return formatCurrency(rawValue, source, field.currencyCode);
    if (field.type === 'transactionType') return transactionTypeLabel(rawValue);
    return rawValue;
  };

  const renderDataItem = (label, value) => (
    <div className="data-item">
      <span className={getFieldLabelClass(value)}>{label}</span>
      <span className="dt-value">{value}</span>
    </div>
  );
  const renderField = (field, source = details) => renderDataItem(field.label, getFieldValue(field, source));
  const renderSection = (title, fields, className = '', gridClass = 'grid-3') => {
    const isCreditNoteDocument = documentType === 'creditNote' || documentType === 'apCreditNote';
    const visibleFields = fields.filter((field) => {
      if (field.invoiceOnly && isCreditNoteDocument) return false;
      if (field.creditNoteOnly && !isCreditNoteDocument) return false;
      return hasValue(getFieldValue(field));
    });

    if (visibleFields.length === 0) return null;

    return (
      <div className={`info-section ${className}`.trim()}>
        <h3 className={getSectionTitleClass(hasAnyFieldValue(visibleFields))}>{title}</h3>
        <div className={`data-grid ${gridClass}`}>
          {visibleFields.map((field) => (
            <div key={`${title}-${field.label}`}>
              {renderField(field)}
            </div>
          ))}
        </div>
      </div>
    );
  };
  const normalizeStatus = (status) => {
    // Backend sends numeric status codes in q.Status
    if (status === 1 || status === '1') return 'Pending';
    if (status === 3 || status === '3') return 'Success';
    if (status === 4 || status === '4') return 'Failed';

    return status || '';
  };

  const documentConfig = getDocumentTypeConfig(documentType);
  const isReadOnlyPurchase = documentType === 'purchase' || documentType === 'apCreditNote';
  const getCurrentDocumentNumber = () =>
    details?.InvoiceNumber || invoice?.InvoiceNumber || invoice?.InvNumber || invoiceId || '';

  const currentStatus = details?.Status ?? details?.STATUS ?? details?.status ?? invoice?.Status ?? invoice?.STATUS ?? invoice?.status;
  const isStatusThree = currentStatus === 3 || currentStatus === '3';
  const isFailedStatus = currentStatus === 4 || currentStatus === '4';
  const hasInboundDocument = isReadOnlyPurchase && hasValue(valueFrom(details, ['inDocument', 'in_document_id']));
  const hasInboundAttachment = hasInboundDocument && hasValue(valueFrom(details, ['attached_document']));
  const attachedDocumentFilename = valueFrom(details, ['attached_doc_filename']);

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(String(dateStr))) return String(dateStr).slice(0, 10);
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const loadInvoiceDetails = async (invoiceNumber) => {
    const params = new URLSearchParams();
    if (documentConfig.purchaseInvoiceTypeCode) {
      params.set('invoiceTypeCode', documentConfig.purchaseInvoiceTypeCode);
    }
    const query = params.toString();
    const response = await apiFetch(
      `${documentConfig.detailsUrl}/${encodeURIComponent(invoiceNumber)}${query ? `?${query}` : ''}`
    );
    const data = await response.json();
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    setDetailRows(rows);
    setDetails(rows[0] || null);
  };

  useEffect(() => {
    setDetails(null);
    setDetailRows([]);
    const invoiceNumber = invoice?.InvoiceNumber || invoice?.InvNumber || invoiceId || '';

    if (isOpen && invoiceNumber) {
      loadInvoiceDetails(invoiceNumber)
        .catch(err => {
          console.error('Details fetch error', err);
          setDetailRows([]);
          setDetails(null);
        });
    }
  }, [isOpen, invoice?.InvoiceNumber, invoice?.InvNumber, invoiceId, documentType]);

  const handleUpdateInvoice = async () => {
    const invoiceNumber = details?.InvoiceNumber || invoice?.InvoiceNumber || invoice?.InvNumber || invoiceId || '';
    const autoIndex = details?.unique_identifier_no ?? details?.UniqueIdentifierNo ?? invoice?.AutoIndex ?? null;

    if (!invoiceNumber) {
      snackbar.error(`${documentConfig.title} number is missing`);
      return;
    }

    setIsUpdating(true);

    try {
      const response = await apiFetch(`${API_BASE_URL}/invoice/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invoiceNumbers: [{
            InvNumber: invoiceNumber,
            AutoIndex: autoIndex,
            DocType: documentConfig.docType
          }],
          docType: documentConfig.docType
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update invoice');
      }

      await loadInvoiceDetails(invoiceNumber);
      await onUpdated?.();
      snackbar.success(data.message || `${documentConfig.itemLabel} ${invoiceNumber} synchronized successfully`);
    } catch (err) {
      console.error('Invoice modal update error', err);
      snackbar.error(`Failed to synchronize ${documentConfig.itemLabel.toLowerCase()}: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExportXml = async () => {
    const invoiceNumber = details?.InvoiceNumber || invoice?.InvoiceNumber || invoice?.InvNumber || invoiceId || '';

    if (!invoiceNumber) {
      snackbar.error(`${documentConfig.title} number is missing`);
      return;
    }

    try {
      const response = await apiFetch(getXmlUrl(documentType, invoiceNumber));

      if (!response.ok) {
        throw new Error(`Failed to export ${documentConfig.itemLabel.toLowerCase()} XML`);
      }

      const blob = await response.blob();
      downloadXmlBlob(blob, `${documentConfig.xmlFilenamePrefix}-${invoiceNumber}.xml`);
      snackbar.success(`${documentConfig.itemLabel} ${invoiceNumber} XML downloaded`);
    } catch (err) {
      console.error('Invoice XML export error', err);
      snackbar.error(`Failed to export XML: ${err.message}`);
    }
  };

  const handleDownloadPdf = () => {
    const invoiceNumber = details?.InvoiceNumber || invoice?.InvoiceNumber || invoice?.InvNumber || invoiceId || '';

    if (!invoiceNumber) {
      snackbar.error(`${documentConfig.title} number is missing`);
      return;
    }

    if (!details) {
      snackbar.error(`${documentConfig.title} details are still loading`);
      return;
    }

    try {
      generateInvoicePdf({
        details,
        invoice,
        lineItems,
        docType: documentConfig.docType
      });
      snackbar.success(`${documentConfig.itemLabel} ${invoiceNumber} PDF downloaded`);
    } catch (err) {
      console.error('PDF download error', err);
      snackbar.error(`Failed to download PDF: ${err.message}`);
    }
  };

  const handleDownloadAttachment = async () => {
    const invoiceNumber = getCurrentDocumentNumber();

    if (!invoiceNumber) {
      snackbar.error(`${documentConfig.title} number is missing`);
      return;
    }

    if (!hasInboundAttachment) {
      snackbar.error('Purchase attachment was not found');
      return;
    }

    if (!attachedDocumentFilename) {
      snackbar.error('Attached document filename is missing');
      return;
    }

    const params = new URLSearchParams({ disposition: 'attachment' });
    if (documentConfig.purchaseInvoiceTypeCode) {
      params.set('invoiceTypeCode', documentConfig.purchaseInvoiceTypeCode);
    }

    setIsDownloadingAttachment(true);

    try {
      const response = await apiFetch(
        `${documentConfig.detailsUrl}/${encodeURIComponent(invoiceNumber)}/in-document/attachment?${params.toString()}`
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to download attachment');
      }

      const blob = await response.blob();

      downloadXmlBlob(blob, attachedDocumentFilename);
      snackbar.success('Attachment downloaded');
    } catch (err) {
      console.error('Purchase attachment download error', err);
      snackbar.error(`Failed to download attachment: ${err.message}`);
    } finally {
      setIsDownloadingAttachment(false);
    }
  };

  const handleViewError = () => {
    const invoiceNumber = details?.InvoiceNumber || details?.InvNumber || details?.INVNUMBER || invoice?.InvoiceNumber || invoice?.InvNumber || invoice?.INVNUMBER || invoiceId || '';
    const invoiceDate = details?.InvoiceIssueDate || details?.InvDate || details?.INVDATE || invoice?.InvoiceIssueDate || invoice?.InvDate || invoice?.INVDATE || '';

    if (!invoiceNumber) {
      snackbar.error(`${documentConfig.title} number is missing`);
      return;
    }

    const params = new URLSearchParams({ invnum: invoiceNumber });
    const fromDate = formatDateForInput(invoiceDate);
    if (fromDate) params.set('fromDate', fromDate);

    onClose?.();
    navigate(`/issues/failed?${params.toString()}`);
  };

  const handleSendInvoice = async () => {
    const invoiceNumber = details?.InvoiceNumber || invoice?.InvoiceNumber || invoice?.InvNumber || invoiceId || '';

    if (!invoiceNumber) {
      snackbar.error(`${documentConfig.title} number is missing`);
      return;
    }

    if (isStatusThree) {
      snackbar.error(`${documentConfig.itemLabel} ${invoiceNumber} is already sent`);
      return;
    }

    setIsSending(true);

    try {
      const response = await apiFetch(
        getSendUrl(documentType, invoiceNumber),
        {
          method: 'POST'
        }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to send ${documentConfig.itemLabel.toLowerCase()}`);
      }

      await loadInvoiceDetails(invoiceNumber);
      snackbar.success(data.message || `${documentConfig.itemLabel} ${invoiceNumber} sent successfully`);
    } catch (err) {
      console.error('Invoice send error', err);
      snackbar.error(`Failed to send ${documentConfig.itemLabel.toLowerCase()}: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const getStatusBadge = (status) => {
    const normalizedStatus = normalizeStatus(status);
    if (!normalizedStatus) return '';

    const statusMap = {
      Pending: 'neutral',
      Success: 'success',
      Failed: 'error',
      Sent: 'warning',
      Received: 'neutral',
      Invoiced: 'success'
    };

    const badgeType = statusMap[normalizedStatus] || 'neutral';
    return <span className={`badge ${badgeType}`}>{normalizedStatus}</span>;
  };


  const lineItems = detailRows.map((line) => ({
    id: valueFrom(line, ['invoice_line_id', 'InvoiceLineIdentifier']),
    note: valueFrom(line, ['invoice_line_note']),
    qty: valueFrom(line, ['invoiced_qty', 'InvoicedQuantity']),
    unitName: valueFrom(line, ['invoiced_qty_uom_code', 'UOMCode']),
    lineNet: valueFrom(line, ['invoice_line_net_amt', 'LineNet', 'LineExtensionAmount']),
    buyerAccountingRef: valueFrom(line, ['invoice_line_buyer_acc_ref']),
    periodStart: formatDate(valueFrom(line, ['invoice_line_period_start'])),
    periodEnd: formatDate(valueFrom(line, ['invoice_line_period_end'])),
    objectId: valueFrom(line, ['invoice_line_obj_id']),
    objectSchemeId: valueFrom(line, ['invoice_line_scheme_id']),
    name: valueFrom(line, ['item_name', 'ItemName']),
    desc: valueFrom(line, ['item_description', 'ItemDescription']),
    buyerItemId: valueFrom(line, ['item_buyer_id']),
    sellerItemId: valueFrom(line, ['item_seller_id']),
    standardItemId: valueFrom(line, ['item_standard_id']),
    itemSchemeId: valueFrom(line, ['item_scheme_id']),
    serviceAccountingCode: valueFrom(line, ['service_acc_code']),
    goodsServiceType: valueFrom(line, ['goods_service_type']),
    itemType: valueFrom(line, ['item_type']),
    itemClassificationId: valueFrom(line, ['item_classification_id']),
    itemCountryOrigin: valueFrom(line, ['item_country_origin']),
    taxCat: valueFrom(line, ['item_vat_cat_code', 'ItemVatCategory']),
    taxRate: valueFrom(line, ['item_vat_rate', 'ItemVatPrice']),
    vatExemptReasonCode: valueFrom(line, ['vat_exempt_reason_code']),
    vatExemptReasonText: valueFrom(line, ['vat_exempt_reason_text']),
    taxScheme: valueFrom(line, ['item_tax_scheme']),
    netPrice: valueFrom(line, ['item_net_price', 'PriceExcl']),
    baseQty: valueFrom(line, ['item_price_base_qty']),
    baseUom: valueFrom(line, ['item_price_base_uom_code']),
    itemPriceDiscount: valueFrom(line, ['item_price_discount']),
    lineChargeAmount: valueFrom(line, ['line_charge_amount']),
    lineAllowAmount: valueFrom(line, ['line_allow_amount']),
    vatAmntAED: valueFrom(line, ['vat_line_amt_aed', 'LineTax']),
    lineAmntAED: valueFrom(line, ['invoice_line_amt_aed', 'LineTotal'])
  }));

  const transactionTypeCode = String(valueFrom(details, ['invoice_txn_type_code', 'TransactionCode', 'syntax_binding_qualifier']) || '').padStart(8, '0');
  const transactionTypeFields = typeSpecificFields[transactionTypeCode] || [];

  const hasInvoiceLinesData = lineItems.length > 0;
  const lineHeaderDataMap = {
    id: lineItems.some((line) => hasValue(line.id)),
    note: lineItems.some((line) => hasValue(line.note)),
    name: lineItems.some((line) => hasValue(line.name)),
    desc: lineItems.some((line) => hasValue(line.desc)),
    qty: lineItems.some((line) => hasValue(line.qty)),
    unitName: lineItems.some((line) => hasValue(line.unitName)),
    buyerAccountingRef: lineItems.some((line) => hasValue(line.buyerAccountingRef)),
    periodStart: lineItems.some((line) => hasValue(line.periodStart)),
    periodEnd: lineItems.some((line) => hasValue(line.periodEnd)),
    objectId: lineItems.some((line) => hasValue(line.objectId)),
    objectSchemeId: lineItems.some((line) => hasValue(line.objectSchemeId)),
    buyerItemId: lineItems.some((line) => hasValue(line.buyerItemId)),
    sellerItemId: lineItems.some((line) => hasValue(line.sellerItemId)),
    standardItemId: lineItems.some((line) => hasValue(line.standardItemId)),
    itemSchemeId: lineItems.some((line) => hasValue(line.itemSchemeId)),
    serviceAccountingCode: lineItems.some((line) => hasValue(line.serviceAccountingCode)),
    goodsServiceType: lineItems.some((line) => hasValue(line.goodsServiceType)),
    itemType: lineItems.some((line) => hasValue(line.itemType)),
    itemClassificationId: lineItems.some((line) => hasValue(line.itemClassificationId)),
    itemCountryOrigin: lineItems.some((line) => hasValue(line.itemCountryOrigin)),
    netPrice: lineItems.some((line) => hasValue(line.netPrice)),
    baseQty: lineItems.some((line) => hasValue(line.baseQty)),
    itemPriceDiscount: lineItems.some((line) => hasValue(line.itemPriceDiscount)),
    lineChargeAmount: lineItems.some((line) => hasValue(line.lineChargeAmount)),
    lineAllowAmount: lineItems.some((line) => hasValue(line.lineAllowAmount)),
    taxCat: lineItems.some((line) => hasValue(line.taxCat)),
    taxRate: lineItems.some((line) => hasValue(line.taxRate)),
    vatExemptReasonCode: lineItems.some((line) => hasValue(line.vatExemptReasonCode)),
    vatExemptReasonText: lineItems.some((line) => hasValue(line.vatExemptReasonText)),
    taxScheme: lineItems.some((line) => hasValue(line.taxScheme)),
    baseUom: lineItems.some((line) => hasValue(line.baseUom)),
    vatAmntAED: lineItems.some((line) => hasValue(line.vatAmntAED)),
    lineNet: lineItems.some((line) => hasValue(line.lineNet)),
    lineAmntAED: lineItems.some((line) => hasValue(line.lineAmntAED))
  };

  const lineColumns = [
    { key: 'id', label: 'ID', render: (line) => line.id },
    { key: 'note', label: 'Note', className: 'text-muted', render: (line) => line.note },
    { key: 'qty', label: 'Qty', render: (line) => line.qty },
    { key: 'unitName', label: 'Unit', render: (line) => line.unitName },
    { key: 'lineNet', label: 'Line Net', render: (line) => formatNumber(line.lineNet) },
    { key: 'buyerAccountingRef', label: 'Buyer Acc. Ref.', render: (line) => line.buyerAccountingRef },
    { key: 'periodStart', label: 'Period Start', render: (line) => line.periodStart },
    { key: 'periodEnd', label: 'Period End', render: (line) => line.periodEnd },
    { key: 'objectId', label: 'Line Object ID', render: (line) => line.objectId },
    { key: 'objectSchemeId', label: 'Line Object Scheme', render: (line) => line.objectSchemeId },
    { key: 'name', label: 'Item Name', className: 'font-medium', render: (line) => line.name },
    { key: 'desc', label: 'Description', className: 'text-muted', render: (line) => line.desc },
    { key: 'buyerItemId', label: 'Buyer Item ID', render: (line) => line.buyerItemId },
    { key: 'sellerItemId', label: 'Seller Item ID', render: (line) => line.sellerItemId },
    { key: 'standardItemId', label: 'Standard Item ID', render: (line) => line.standardItemId },
    { key: 'itemSchemeId', label: 'Item Scheme', render: (line) => line.itemSchemeId },
    { key: 'serviceAccountingCode', label: 'Service Acc. Code', render: (line) => line.serviceAccountingCode },
    { key: 'goodsServiceType', label: 'Goods/Service Type', render: (line) => line.goodsServiceType },
    { key: 'itemType', label: 'Item Type', render: (line) => line.itemType },
    { key: 'itemClassificationId', label: 'Classification ID', render: (line) => line.itemClassificationId },
    { key: 'itemCountryOrigin', label: 'Origin Country', render: (line) => line.itemCountryOrigin },
    { key: 'taxCat', label: 'Tax Cat.', render: (line) => line.taxCat },
    { key: 'taxRate', label: 'Tax Rate', render: (line) => line.taxRate },
    { key: 'vatExemptReasonCode', label: 'Exempt Reason Code', render: (line) => line.vatExemptReasonCode },
    { key: 'vatExemptReasonText', label: 'Exempt Reason', className: 'text-muted', render: (line) => line.vatExemptReasonText },
    { key: 'taxScheme', label: 'Tax Scheme', render: (line) => line.taxScheme },
    { key: 'netPrice', label: 'Net Price', render: (line) => formatNumber(line.netPrice) },
    { key: 'baseQty', label: 'Base Qty', render: (line) => line.baseQty },
    { key: 'baseUom', label: 'Base UOM', render: (line) => line.baseUom },
    { key: 'itemPriceDiscount', label: 'Price Discount', render: (line) => formatNumber(line.itemPriceDiscount) },
    { key: 'lineChargeAmount', label: 'Line Charge', render: (line) => formatNumber(line.lineChargeAmount) },
    { key: 'lineAllowAmount', label: 'Line Allowance', render: (line) => formatNumber(line.lineAllowAmount) },
    { key: 'vatAmntAED', label: 'VAT (AED)', render: (line) => formatNumber(line.vatAmntAED) },
    { key: 'lineAmntAED', label: 'Line Total (AED)', className: 'font-medium', render: (line) => formatNumber(line.lineAmntAED) }
  ].filter((column) => lineHeaderDataMap[column.key]);
  const hasVisibleInvoiceLineData = lineColumns.length > 0;

  if (!isOpen) return null;


  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />

      <div className={`slide-over-panel ${isOpen ? 'open' : ''}`}>

        {/* Panel Header */}
        <div className="panel-header-fixed">
          <div className="flex-row items-center gap-4">
            <button className="icon-btn" onClick={onClose}><X size={24} /></button>
            <h2 className="panel-title">{documentConfig.title} Details: {details?.InvoiceNumber || invoice?.InvoiceNumber || invoice?.InvNumber || invoiceId || ''}</h2>
            {!isReadOnlyPurchase && getStatusBadge(details?.Status)}
          </div>
          <div className="flex-row gap-2">
            {hasInboundAttachment && (
              <button
                className="btn btn-outline"
                onClick={handleDownloadAttachment}
                disabled={isDownloadingAttachment}
              >
                <Download size={16} /> {isDownloadingAttachment ? 'Downloading...' : 'Attachment'}
              </button>
            )}
            <button className="btn btn-outline" onClick={handleDownloadPdf}>
              <Download size={16} /> PDF
            </button>
            {!isReadOnlyPurchase && isFailedStatus && (
              <button className="btn btn-outline" onClick={handleViewError}>
                <AlertCircle size={16} /> Error
              </button>
            )}
            {!isReadOnlyPurchase && (
              <>
                <button
                  className="btn btn-outline"
                  onClick={handleUpdateInvoice}
                  disabled={isUpdating}
                >
                  <RotateCw size={16} />  {isUpdating ? 'Updating...' : ' Update'}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSendInvoice}
                  disabled={isSending || isStatusThree}
                >
                  <Send size={16} /> {isSending ? 'Sending...' : isStatusThree ? 'Sent' : 'Send'}
                </button>
                <button className="btn btn-primary" onClick={handleExportXml}><Download size={16} /> Export XML</button>
              </>
            )}
          </div>
        </div>

        {/* Panel Content (Scrollable) */}
        <div className="panel-content-scroll">

          {renderSection(
            <><FileText size={18} /> 1. {documentConfig.title} Details</>,
            commonDocumentFields
          )}

          <div className="flex-row gap-6">
            {renderSection('2. Seller Details', sellerFields, 'flex-1', 'grid-2')}
            {renderSection('3. Buyer Details', buyerFields, 'flex-1', 'grid-2')}
          </div>

          {transactionTypeFields.length > 0 && renderSection(
            `4. Transaction Type Details: ${TRANSACTION_TYPE_NAMES[transactionTypeCode] || transactionTypeCode}`,
            transactionTypeFields,
            '',
            'grid-3'
          )}

          <div className="flex-row gap-6">
            {renderSection('5. Document Totals and Tax Breakdown', totalFields, 'flex-1 bg-gray-subtle', 'grid-2')}
            {renderSection('6. Allowances and Charges', allowanceChargeFields, 'flex-1 bg-gray-subtle', 'grid-2')}
          </div>

          <div className="flex-row gap-6">
            {renderSection('7. References and Supporting Documents', referenceFields, 'flex-1', 'grid-2')}
            {renderSection('8. Delivery Details', deliveryFields, 'flex-1', 'grid-2')}
          </div>

          {renderSection('9. Tax Representative Details', taxRepresentativeFields, '', 'grid-3')}

          {hasVisibleInvoiceLineData && (
          <div className="info-section">
            <h3 className={getSectionTitleClass(hasInvoiceLinesData)}>10. {documentConfig.title} Lines</h3>
            <div className="table-responsive">
              <table className="lines-table">
                <thead>
                  <tr>
                    {lineColumns.map((column) => (
                      <th key={column.key} className={getTableHeaderClass(true)}>{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((line, idx) => (
                    <tr key={idx}>
                      {lineColumns.map((column) => (
                        <td key={column.key} className={column.className || undefined}>
                          {column.render(line)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="lines-footer">
                <span className="text-sm text-secondary">Displaying {lineItems.length} records. If no lines, blank as per data.</span>
              </div>
            </div>
          </div>
          )}

        </div>
      </div>
    </>
  );
};

export default PurchaseDetailsModal;
