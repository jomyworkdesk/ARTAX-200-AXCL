import { useState, useEffect, useRef, useCallback } from 'react';

import { Search, Eye, Info, ChevronLeft, ChevronRight, Send, ArrowRight, AlertTriangle, Clock, CheckCircle, ArrowUp, ArrowDown, RotateCw } from 'lucide-react';
import { useSnackbar } from '../components/Snackbar';
import InvoiceDetailsModal from '../components/Invoices/InvoiceDetailsModal';
import PurchaseTransactionModal from '../components/Invoices/PurchaseTransactionModal';
import { getDocumentTypeConfig } from '../utils/documentTypeConfig';
import { API_BASE_URL, apiFetch, validateSendConfiguration } from '../services/apiService';
import '../Styles/Invoices.css';

const AUTO_REFRESH_INTERVAL_MS = 5000;
const AUTO_REFRESH_DOCUMENT_TYPES = new Set(['invoice', 'creditNote']);
const OUTBOUND_TRANSACTION_TABS = [
  'outbound',
  'c2_tdd_outbound',
  'mls_inbound',
  'c2_tdd_mls_inbound'
];

const Invoices = ({ initialDocumentType = 'invoice' }) => {
  const snackbar = useSnackbar();
  const [activeDocumentType, setActiveDocumentType] = useState(initialDocumentType);
  const [activeTab, setActiveTab] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedTransactionInvoice, setSelectedTransactionInvoice] = useState(null);
  const [selectedInvoices, setSelectedInvoices] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [lastSync, setLastSync] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [tempStartDate, setTempStartDate] = useState(() => {
    let d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });
  const [tempEndDate, setTempEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [startDate, setStartDate] = useState(tempStartDate);
  const [endDate, setEndDate] = useState(tempEndDate);

  const [dashboardCounts, setDashboardCounts] = useState({});
  const autoRefreshInFlight = useRef(false);
  const documentConfig = getDocumentTypeConfig(activeDocumentType);

  const tabs = [
    { id: 'All', label: 'All', count: dashboardCounts.total || 0 },
    { id: 'Pending', label: 'Pending', count: dashboardCounts.pending || 0 },
    { id: 'Success', label: 'Success', count: dashboardCounts.success || dashboardCounts.received || 0 },
    { id: 'Failed', label: 'Failed', count: dashboardCounts.failed || 0 },
    { id: 'Error', label: 'Error', count: dashboardCounts.error || 0 },
  ];

  const [loading, setLoading] = useState(false);
  const [syncingTransactions, setSyncingTransactions] = useState(false);
  const [updatingInvoices, setUpdatingInvoices] = useState(false);
  const [sendingInvoices, setSendingInvoices] = useState(false);
  const [apiInvoices, setApiInvoices] = useState([]);
  const shouldPauseAutoRefresh = selectedInvoices.size > 0
    || updatingInvoices
    || sendingInvoices
    || syncingTransactions
    || !!selectedInvoice
    || !!selectedTransactionInvoice;
  const totalAllInvoices = Number(dashboardCounts.total) || 0;
  const loadedInvoiceCount = activeTab === 'All'
    ? apiInvoices.length
    : totalAllInvoices;
  const syncProgress = totalAllInvoices > 0
    ? Math.min((loadedInvoiceCount / totalAllInvoices) * 100, 100)
    : 0;

  useEffect(() => {
    setActiveDocumentType(initialDocumentType);
    setActiveTab('All');
    setCurrentPage(1);
    setSelectedInvoices(new Set());
    setSelectedInvoice(null);
    setSelectedTransactionInvoice(null);
  }, [initialDocumentType]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatCurrency = (amount, currencyCode = 'AED') => {
    if (amount === null || amount === undefined || amount === '') return '';
    const currency = String(currencyCode || 'AED').trim().toUpperCase();
    const number = Number(amount);
    const formattedAmount = Number.isFinite(number)
      ? number.toLocaleString('en-AE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
      : amount;
    return `${currency} ${formattedAmount}`;
  };

  const getSortableDateValue = (dateStr) => {
    if (!dateStr) return Number.NEGATIVE_INFINITY;
    const timestamp = new Date(dateStr).getTime();
    return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
  };

  const normalizeStatus = (status) => {
    if (status === 1 || status === '1') return 'Pending';
    if (status === 2 || status === '2') return 'Sent';
    if (status === 3 || status === '3') return 'Success';
    if (status === 4 || status === '4') return 'Failed';
    if (status === 6 || status === '6') return 'Error';
    const normalizedText = String(status || '').trim().toUpperCase();
    if (normalizedText === 'PENDING') return 'Pending';
    if (normalizedText === 'SENT') return 'Sent';
    if (normalizedText === 'SUCCESS') return 'Success';
    if (normalizedText === 'FAILED') return 'Failed';
    if (normalizedText === 'ERROR') return 'Error';
    return status || 'Pending';
  };

  const formatSuccessColumnStatus = (status) => {
    if (status === 3 || status === '3') return 'Sucess(ASP)';
    if (status === 4 || status === '4') return 'FAILED (ASP)';
    if (status === 1 || status === '1') return 'PENDING (SAGE)';
    if (status === 6 || status === '6') return 'ERROR (SAGE)';
    return normalizeStatus(status);
  };

  const isStatusThree = (status) => status === 3 || status === '3';

  const fetchDashboard = useCallback(async (fromDate = startDate, toDate = endDate) => {
    const params = new URLSearchParams();
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    const response = await apiFetch(`${documentConfig.apiBase}/dashboard?${params.toString()}`);
    if (!response.ok) throw new Error('Failed to fetch dashboard');
    const data = await response.json();
    setDashboardCounts(data || {});
  }, [documentConfig.apiBase, startDate, endDate]);

  const fetchInvoices = useCallback(async (type, fromDate = startDate, toDate = endDate) => {
    const params = new URLSearchParams({ type });
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    const response = await apiFetch(`${documentConfig.apiBase}/${documentConfig.listPath}?${params.toString()}`);
    if (!response.ok) throw new Error(`Failed to fetch ${documentConfig.itemLabelPlural}`);
    const data = await response.json();
    setApiInvoices(Array.isArray(data) ? data : []);
  }, [documentConfig.apiBase, documentConfig.itemLabelPlural, documentConfig.listPath, startDate, endDate]);

  const refreshInvoiceData = useCallback(async ({
    showSuccessMessage = false,
    showLoading = true,
    showErrorMessage = true,
    fromDate = startDate,
    toDate = endDate
  } = {}) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const type = activeTab.toLowerCase();
      await Promise.all([
        fetchDashboard(fromDate, toDate),
        fetchInvoices(type, fromDate, toDate)
      ]);
      setLastSync(new Date().toLocaleTimeString());
      if (showSuccessMessage) {
        snackbar.success('Sync completed!');
      }
    } catch (err) {
      console.error('Invoice refresh error', err);
      setApiInvoices([]);
      if (showErrorMessage) {
        snackbar.error(`Failed to load ${documentConfig.itemLabelPlural}: ` + err.message);
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [activeTab, documentConfig.itemLabelPlural, endDate, fetchDashboard, fetchInvoices, snackbar, startDate]);

  useEffect(() => {
    refreshInvoiceData();
  }, [refreshInvoiceData]);

  useEffect(() => {
    if (!AUTO_REFRESH_DOCUMENT_TYPES.has(activeDocumentType)) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      if (autoRefreshInFlight.current || shouldPauseAutoRefresh) {
        return;
      }

      autoRefreshInFlight.current = true;
      try {
        await refreshInvoiceData({
          showLoading: false,
          showErrorMessage: false
        });
      } finally {
        autoRefreshInFlight.current = false;
      }
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [activeDocumentType, refreshInvoiceData, shouldPauseAutoRefresh]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, activeDocumentType, searchQuery, rowsPerPage, startDate, endDate]);

  const getStatusBadge = (status, displayStatus) => {
    const normalizedStatus = normalizeStatus(status);
    if (!normalizedStatus) return '';
    const statusMap = {
      'Delivered': 'success',
      'Sent': 'warning',
      'Pending': 'neutral',
      'Success': 'success',
      'Accepted': 'success',
      'Rejected': 'error',
      'Failed': 'error',
      'Error': 'warning',
      'Processing': 'warning'
    };
    const badgeType = statusMap[normalizedStatus] || 'neutral';
    return <span className={`badge ${badgeType}`}>{displayStatus || normalizedStatus}</span>;
  };

  const getResponseStatus = (status) => {
    const normalizedStatus = normalizeStatus(status);
    if (normalizedStatus === 'Accepted' || normalizedStatus === 'Rejected' || normalizedStatus === 'Pending') {
      return normalizedStatus;
    }
    if (normalizedStatus === 'Success') return 'Accepted';
    return 'Pending';
  };

  const getTabIcon = (tabId) => {
    switch (tabId) {
      case 'Sent': return <Send size={16} className="tab-icon" />;
      case 'Success': return <CheckCircle size={16} className="tab-icon" />;
      case 'Failed': return <AlertTriangle size={16} className="tab-icon" />;
      case 'Error': return <AlertTriangle size={16} className="tab-icon" />;
      case 'Pending': return <Clock size={16} className="tab-icon" />;
      default: return null;
    }
  };

  const displayInvoices = apiInvoices.map(item => ({
    id: item.InvoiceNumber || item.InvNumber || '',
    client: item.Customer || '',
    date: formatDate(item.InvoiceIssueDate),
    dateSortValue: getSortableDateValue(item.InvoiceIssueDate),
    amount: formatCurrency(item.InvTotIncl, item.InvoiceCurrencyCode || item.invoice_currency_code),
    amountSortValue: Number(item.InvTotIncl) || 0,
    status: normalizeStatus(item.Status),
    statusDisplay: formatSuccessColumnStatus(item.Status),
    c3Response: getResponseStatus(item.C3ResponseStatus || 'Pending'),
    c5Response: getResponseStatus(item.C5ResponseStatus || 'Pending'),
    isStatusThree: isStatusThree(item.Status),
    rawData: item
  }));

  // Server already filters by type, client search only
  const filteredInvoices = displayInvoices;


  // Filter further by search query
  const filteredSearchInvoices = filteredInvoices.filter(invoice => {
    const query = searchQuery.toLowerCase();
    return (
      invoice.client.toLowerCase().includes(query) ||
      invoice.id.toLowerCase().includes(query)
    );
  });

  // Apply Sorting
  const searchedInvoices = [...filteredSearchInvoices].sort((a, b) => {
    if (!sortConfig.key) return 0;

    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];

    if (sortConfig.key === 'date') {
      aVal = a.dateSortValue;
      bVal = b.dateSortValue;
    }

    if (sortConfig.key === 'amount') {
      aVal = a.amountSortValue;
      bVal = b.amountSortValue;
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalInvoices = searchedInvoices.length;
  const totalPages = Math.max(1, Math.ceil(totalInvoices / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = totalInvoices === 0 ? 0 : (safeCurrentPage - 1) * rowsPerPage;
  const pageEndIndex = Math.min(pageStartIndex + rowsPerPage, totalInvoices);
  const paginatedInvoices = searchedInvoices.slice(pageStartIndex, pageEndIndex);

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUp size={14} className="sort-icon-placeholder" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  const handleSync = async () => {
    setSyncingTransactions(true);

    try {
      const response = await apiFetch(`${API_BASE_URL}/invoice/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to run Sage Transaction Sync');
      }

      await refreshInvoiceData();
      snackbar.success(data.message || 'Sage Transaction Sync completed');
    } catch (err) {
      console.error('Sage Transaction Sync error', err);
      snackbar.error(`Failed to run Sage Transaction Sync: ${err.message}`);
    } finally {
      setSyncingTransactions(false);
    }
  };

  // Handle individual checkbox change
  const handleCheckboxChange = (invoiceId) => {
    const newSelected = new Set(selectedInvoices);
    if (newSelected.has(invoiceId)) {
      newSelected.delete(invoiceId);
    } else {
      newSelected.add(invoiceId);
    }
    setSelectedInvoices(newSelected);
  };

  // Handle select all checkbox
  const handleSelectAll = (isChecked) => {
    if (isChecked) {
      const allIds = new Set(paginatedInvoices.map(inv => inv.id));
      setSelectedInvoices(allIds);
    } else {
      setSelectedInvoices(new Set());
    }
  };

  const isAllSelected = paginatedInvoices.length > 0 && paginatedInvoices.every(inv => selectedInvoices.has(inv.id));
  const selectedInvoiceRows = displayInvoices.filter(invoice => selectedInvoices.has(invoice.id));
  const hasSelectedStatusThree = selectedInvoiceRows.some(invoice => invoice.isStatusThree);
  const isSendDisabled = selectedInvoices.size === 0 || sendingInvoices || hasSelectedStatusThree;

  // Handle send action
  const handleSendInvoices = async () => {
    const invoiceNumbers = Array.from(selectedInvoices);

    if (invoiceNumbers.length === 0) {
      snackbar.error(`Please select at least one ${documentConfig.itemLabel} to send`);
      return;
    }

    if (hasSelectedStatusThree) {
      snackbar.error(`Selected ${documentConfig.itemLabelPlural} already include a sent ${documentConfig.itemLabel}`);
      return;
    }

    try {
      setSendingInvoices(true);
      await validateSendConfiguration();

      const response = await apiFetch(`${documentConfig.apiBase}/${documentConfig.sendPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invoiceNumbers })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send XML');
      }

      await refreshInvoiceData();
      setSelectedInvoices(new Set());
      if (data.failedCount > 0) {
        snackbar.warning(data.message || `${data.sentCount || 0} ${documentConfig.itemLabel}(s) sent, ${data.failedCount} failed`);
      } else {
        snackbar.success(data.message || `Sent ${invoiceNumbers.length} ${documentConfig.itemLabel}(s) successfully`);
      }
    } catch (err) {
      console.error('Document send error', err);
      snackbar.error(err.isSendValidationError
        ? err.message
        : `Failed to send ${documentConfig.itemLabelPlural}: ${err.message}`);
    } finally {
      setSendingInvoices(false);
    }
  };

  const handleUpdateInvoices = async () => {
    const invoiceNumbers = selectedInvoiceRows.map(({ rawData, id }) => ({
      InvNumber: rawData.InvoiceNumber || rawData.InvNumber || id,
      AutoIndex: rawData.AutoIndex ?? null,
      DocType: documentConfig.docType
    }));

    if (invoiceNumbers.length === 0) {
      snackbar.error(`Please select at least one ${documentConfig.itemLabel} to update`);
      return;
    }

    if (invoiceNumbers.length > 5) {
      snackbar.error(`You can update only 5 ${documentConfig.itemLabelPlural} at a time`);
      return;
    }

    setUpdatingInvoices(true);

    try {
      const response = await apiFetch(`${API_BASE_URL}/invoice/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invoiceNumbers, docType: documentConfig.docType })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update selected invoices');
      }

      await refreshInvoiceData();
      setSelectedInvoices(new Set());
      snackbar.success(data.message || `${invoiceNumbers.length} ${documentConfig.itemLabel}(s) synchronized successfully`);
    } catch (err) {
      console.error('Document update error', err);
      snackbar.error(`Failed to synchronize ${documentConfig.itemLabelPlural}: ${err.message}`);
    } finally {
      setUpdatingInvoices(false);
    }
  };

  // Clear selections when tab changes
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setCurrentPage(1);
    setSelectedInvoices(new Set());
  };

  const handleApplyFilters = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    refreshInvoiceData({
      fromDate: tempStartDate,
      toDate: tempEndDate
    });
    snackbar.success(`Range updated: ${tempStartDate} to ${tempEndDate}`);
  };

  return (
    <div className="invoices-page">
      <div className="page-header">
        <h1 className="page-title">{documentConfig.listTitle}</h1>
        <div className="header-actions-right">
          <div className="sync-info">
            <span className="last-sync-label">Last Sync:</span>
            <span className="last-sync-time">{lastSync}</span>
          </div>
          <div className="sync-progress-card" title={`${loadedInvoiceCount} of ${totalAllInvoices} ${documentConfig.itemLabelPlural} loaded`}>
            <div className="sync-progress-meta">
              <span className="sync-progress-label">Sage Transaction Sync</span>
              <span className="sync-progress-count">{loadedInvoiceCount}/{totalAllInvoices}</span>
            </div>
            <div className="sync-progress-track">
              <div
                className="sync-progress-fill"
                style={{ width: `${syncProgress}%` }}
              />
            </div>
          </div>
          {/* <button className="icon-btn refresh-btn" onClick={handleSync} title="Refresh View">
            <RotateCw size={18} />
          </button> */}
        {/*   <button
            className={`btn-secondary sync-btn ${syncingTransactions ? 'disabled' : ''}`}
            onClick={handleSync}
            disabled={syncingTransactions}
          >
            <RefreshCcw size={18} />
            {syncingTransactions ? 'Syncing...' : 'Sync'}
          </button>
          */}
          <button
            className={`btn-secondary update-btn ${selectedInvoices.size === 0 || updatingInvoices ? 'disabled' : ''}`}
            onClick={handleUpdateInvoices}
            disabled={selectedInvoices.size === 0 || updatingInvoices}
          >
            <RotateCw size={18} />
            {updatingInvoices ? 'Updating...' : `Update (${selectedInvoices.size})`}
          </button>
          <button
            className={`send-btn ${isSendDisabled ? 'disabled' : ''}`}
            onClick={handleSendInvoices}
            disabled={isSendDisabled}
          >
            <Send size={18} />
            {sendingInvoices ? 'Sending...' : `Send (${selectedInvoices.size})`}
            </button>
        </div>
      </div>

      <div className="card table-card">
        {/* Controls Bar */}
        <div className="table-controls">
          <div className="table-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                {getTabIcon(tab.id)} {tab.label} <span className="tab-count">({tab.count})</span>
              </button>
            ))}
          </div>

          <div className="table-actions">
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder={`Search ${documentConfig.itemLabelPlural} or clients...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="native-date-filters flex-row gap-2">
              <div className="date-input-wrapper">
                <input
                  type="date"
                  className="native-date-input"
                  value={tempStartDate}
                  onChange={(e) => setTempStartDate(e.target.value)}
                />
              </div>
              <span className="date-separator">-</span>
              <div className="date-input-wrapper">
                <input
                  type="date"
                  className="native-date-input"
                  value={tempEndDate}
                  onChange={(e) => setTempEndDate(e.target.value)}
                />
              </div>
              <button
                className="filter-go-btn"
                onClick={handleApplyFilters}
                title="Apply date filters"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="table-container">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="spinner mx-auto" />
              <span className="ml-3 text-gray-600">Loading {documentConfig.itemLabelPlural}...</span>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th className="checkbox-col">
                    <input
                      type="checkbox"
                      className="table-checkbox"
                      checked={isAllSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th>Sl No</th>
                  <th className="sortable-th" onClick={() => handleSort('id')}>
                    {documentConfig.numberColumnLabel} {getSortIcon('id')}
                  </th>
                  <th className="sortable-th" onClick={() => handleSort('client')}>
                    Customer {getSortIcon('client')}
                  </th>
                  <th className="sortable-th date-col" onClick={() => handleSort('date')}>
                    Date {getSortIcon('date')}
                  </th>
                  <th className="text-right sortable-th" onClick={() => handleSort('amount')}>
                    Amount {getSortIcon('amount')}
                  </th>
                  <th className="sortable-th" onClick={() => handleSort('status')}>
                    Status {getSortIcon('status')}
                  </th>

                   <th className="sortable-th" onClick={() => handleSort('c3Response')}>
                    C3 Response {getSortIcon('c3Response')}
                  </th>

                   <th className="sortable-th" onClick={() => handleSort('c5Response')}>
                    C5 Response {getSortIcon('c5Response')}
                  </th>

                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center text-secondary">No {documentConfig.itemLabelPlural} exist</td>
                  </tr>
                ) : (
                  paginatedInvoices.map((invoice, idx) => (
                    <tr
                      key={invoice.id}
                      className={invoice.status === 'Failed' ? 'row-highlight' : invoice.status === 'Error' ? 'row-warning' : ''}
                    >
                      <td className="checkbox-col">
                        <input
                          type="checkbox"
                          className="table-checkbox"
                          checked={selectedInvoices.has(invoice.id)}
                          onChange={() => handleCheckboxChange(invoice.id)}
                        />
                      </td>
                      <td className="sl-no">{pageStartIndex + idx + 1}</td>
                      <td className="font-medium">{invoice.id}</td>
                      <td>{invoice.client}</td>
                      <td className="text-secondary date-col">{invoice.date}</td>
                      <td className="font-medium text-right">{invoice.amount}</td>
                      <td>{getStatusBadge(invoice.status, invoice.statusDisplay)}</td>
                      <td>{getStatusBadge(invoice.c3Response)}</td>

                      <td>{getStatusBadge(invoice.c5Response)}</td>

                      <td className="text-right">
                        <button
                          className="action-btn"
                          type="button"
                          onClick={() => setSelectedTransactionInvoice(invoice.rawData)}
                          title="Transaction Info"
                        >
                          <Info size={18} />
                        </button>
                        <button
                          className="action-btn"
                          onClick={() => setSelectedInvoice(invoice.rawData)}
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Info */}
        <div className="table-footer">

          <div className="footer-left">
            <span className="text-secondary text-sm">
              {totalInvoices === 0
                ? `Showing 0 of 0 ${documentConfig.itemLabelPlural}`
                : `Showing ${pageStartIndex + 1}-${pageEndIndex} of ${totalInvoices} ${documentConfig.itemLabelPlural}`}
            </span>
            <div className="rows-selector">
              <span className="text-secondary text-sm">Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rows-select"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
              </select>
            </div>
          </div>
          <div className="pagination">
            <button
              className={`page-btn ${safeCurrentPage === 1 ? 'disabled' : ''}`}
              disabled={safeCurrentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className={`page-btn ${safeCurrentPage === totalPages || totalInvoices === 0 ? 'disabled' : ''}`}
              disabled={safeCurrentPage === totalPages || totalInvoices === 0}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* The Slide-over detailed view */}
      <InvoiceDetailsModal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        invoice={selectedInvoice}
        documentType={activeDocumentType}
        onUpdated={refreshInvoiceData}
      />

      <PurchaseTransactionModal
        isOpen={!!selectedTransactionInvoice}
        onClose={() => setSelectedTransactionInvoice(null)}
        invoice={selectedTransactionInvoice}
        apiBase={documentConfig.apiBase}
        transactionTabs={OUTBOUND_TRANSACTION_TABS}
      />

    </div>
  );
};

export default Invoices;
