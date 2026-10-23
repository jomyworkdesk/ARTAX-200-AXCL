import { API_BASE_URL } from '../services/apiService';

const withDetailsUrl = (config) => ({
  ...config,
  detailsUrl: `${config.apiBase}/${config.detailsPath}`
});

const INVOICE_CONFIG = withDetailsUrl({
  docType: 4,
  title: 'Invoice',
  listTitle: 'Invoice',
  itemLabel: 'invoice',
  itemLabelPlural: 'invoices',
  apiBase: `${API_BASE_URL}/invoice`,
  listPath: 'getinvoices',
  detailsPath: 'invoice-details',
  sendPath: 'invoices/send',
  xmlFilenamePrefix: 'invoice',
  numberColumnLabel: 'Invoice No'
});

const CREDIT_NOTE_CONFIG = withDetailsUrl({
  docType: 1,
  title: 'Credit Note',
  listTitle: 'CreditNote',
  itemLabel: 'credit note',
  itemLabelPlural: 'credit notes',
  apiBase: `${API_BASE_URL}/creditnote`,
  listPath: 'getcreditnotes',
  detailsPath: 'details',
  sendPath: 'send/selected',
  xmlFilenamePrefix: 'credit-note',
  numberColumnLabel: 'Credit Note No'
});

const PURCHASE_CONFIG = withDetailsUrl({
  docType: 5,
  title: 'Purchase',
  listTitle: 'Purchase',
  itemLabel: 'purchase',
  itemLabelPlural: 'purchases',
  apiBase: `${API_BASE_URL}/purchase`,
  listPath: 'getpurchases',
  detailsPath: 'details',
  sendPath: 'send/selected',
  xmlFilenamePrefix: 'purchase',
  numberColumnLabel: 'Purchase No',
  purchaseInvoiceTypeCode: '380'
});

const AP_CREDIT_NOTE_CONFIG = withDetailsUrl({
  docType: 5,
  title: 'Purchase Return',
  listTitle: 'Purchase Return',
  itemLabel: 'AP credit note',
  itemLabelPlural: 'AP credit notes',
  apiBase: `${API_BASE_URL}/purchase`,
  listPath: 'getpurchases',
  detailsPath: 'details',
  sendPath: 'send/selected',
  xmlFilenamePrefix: 'ap-credit-note',
  numberColumnLabel: 'Return No',
  purchaseInvoiceTypeCode: '381'
});

export const getDocumentTypeConfig = (documentType = 'invoice') =>
  documentType === 'creditNote'
    ? CREDIT_NOTE_CONFIG
    : documentType === 'apCreditNote'
      ? AP_CREDIT_NOTE_CONFIG
    : documentType === 'purchase'
      ? PURCHASE_CONFIG
      : INVOICE_CONFIG;

export const getXmlUrl = (documentType, documentNumber) => {
  const { detailsUrl } = getDocumentTypeConfig(documentType);
  return `${detailsUrl}/${encodeURIComponent(documentNumber)}/xml`;
};

export const getSendUrl = (documentType, documentNumber) => {
  const { detailsUrl } = getDocumentTypeConfig(documentType);
  return `${detailsUrl}/${encodeURIComponent(documentNumber)}/send`;
};
