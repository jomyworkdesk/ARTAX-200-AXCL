import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ChevronDown, Eye, RefreshCw, Send, Search, RotateCw } from 'lucide-react';
import InvoiceDetailsModal from '../components/Invoices/InvoiceDetailsModal';
import { useSnackbar } from '../components/Snackbar';
import { API_BASE_URL, apiFetch, validateSendConfiguration } from '../services/apiService';
import { getDocumentTypeConfig, getSendUrl } from '../utils/documentTypeConfig';

import '../Styles/Errors.css';

const formatDate = (value) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return String(value);
  }
};

const formatDateTime = (value) => {
  if (!value) return '';
  try {
    const date = new Date(value);
    date.setHours(date.getHours() - 4);

    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(value);
  }
};

const formatAmount = (value) => {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED'
  }).format(num);
};

const formatRefreshTime = (value) =>
  value
    ? value.toLocaleString('en-AE', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      })
    : 'Not refreshed yet';

const getStatusClass = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('success')) return 'success';
  if (normalized.includes('fail')) return 'error';
  if (normalized.includes('error') || normalized.includes('sent') || normalized.includes('pending')) return 'warning';
  return 'neutral';
};

const getDocumentStatusLabel = (status) => {
  if (status === 6 || status === '6') return 'Error';
  if (status === 4 || status === '4') return 'Failed';
  return status || 'Error';
};

const getDateInputValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
};

const Errors = () => {
  const snackbar = useSnackbar();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialInvoiceNumber = searchParams.get('invnum') || searchParams.get('q') || '';
  const initialFromDate = getDateInputValue(searchParams.get('fromDate'));

  const [selectedError, setSelectedError] = useState(null);
  const [modalInvoiceId, setModalInvoiceId] = useState('');
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState([]);
  const [searchTerm, setSearchTerm] = useState(initialInvoiceNumber);
  const [responseLogs, setResponseLogs] = useState([]);
  const [responseLogsLoading, setResponseLogsLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const documentConfig = getDocumentTypeConfig('invoice');

  // Date filter (InvDate)
  const [startDate, setStartDate] = useState(() => {
    if (initialFromDate) return initialFromDate;
    let d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Static pagination
  const PAGE_SIZE = 7;
  const [page, setPage] = useState(1);

  const filteredErrors = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return errors;

    return errors.filter((err) =>
      [err.id, err.client, err.type, err.date, err.amount, err.status]
        .some((value) => String(value ?? '').toLowerCase().includes(query))
    );
  }, [errors, searchTerm]);

  const totalCount = filteredErrors.length;
  const pagedErrors = useMemo(() => {
    const startIdx = (page - 1) * PAGE_SIZE;
    return filteredErrors.slice(startIdx, startIdx + PAGE_SIZE);
  }, [filteredErrors, page]);

  // Selected details
  const selectedErrorData = errors.find((err) => err.id === selectedError);

  const openInvoiceModal = (invoiceNumber) => {
    if (!invoiceNumber) return;
    setSelectedError(invoiceNumber);
    setModalInvoiceId(invoiceNumber);
    setIsInvoiceModalOpen(true);
  };

  const fetchResponseLogs = async (invoiceNumber) => {
    if (!invoiceNumber) {
      setResponseLogs([]);
      setExpandedLogId(null);
      return;
    }

    setResponseLogsLoading(true);
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/invoice/errors/${encodeURIComponent(invoiceNumber)}/response-log`
      );
      if (!response.ok) throw new Error('Failed to fetch response logs');

      const data = await response.json();
      setResponseLogs(Array.isArray(data) ? data : []);
      setExpandedLogId(null);
    } catch (err) {
      console.error('Response log fetch error:', err);
      snackbar.error('Failed to load response logs');
      setResponseLogs([]);
      setExpandedLogId(null);
    } finally {
      setResponseLogsLoading(false);
    }
  };

  const handleSendInvoice = async (targetError = selectedErrorData) => {
    if (!targetError?.id) return;

    setSending(true);
    try {
      await validateSendConfiguration();

      const response = await apiFetch(
        getSendUrl('invoice', targetError.id),
        {
          method: 'POST'
        }
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || 'Failed to send invoice');

      snackbar.success(data.message || `Invoice ${targetError.id} sent successfully`);
      const refreshedSelectedError = await fetchErrors({
        targetInvoiceNumber: targetError.id
      });
      await fetchResponseLogs(refreshedSelectedError || targetError.id);
    } catch (err) {
      console.error('Invoice send error:', err);
      snackbar.error(err.message || 'Failed to send invoice');
    } finally {
      setSending(false);
    }
  };

  const fetchErrors = async ({
    fromDate = startDate,
    toDate = endDate,
    targetInvoiceNumber = searchTerm
  } = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);

      const response = await apiFetch(`${API_BASE_URL}/invoice/errors?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch failed invoices');

      const data = await response.json();

      const matchedInvoices = (Array.isArray(data) ? data : []).map((inv) => {
        const invoiceNo = inv.InvNumber ?? inv.INVNUMBER ?? '';
        const status = getDocumentStatusLabel(inv.Status ?? inv.STATUS ?? inv.status);

        return {
          id: invoiceNo,
          client: inv.buyer_name ?? inv.BUYER_NAME ?? '',
          date: formatDate(inv.InvDate ?? inv.INVDATE),
          amount: formatAmount(inv.AMOUNT),
          errorCode: 'Status 6',
          status,
          type: inv.EInvoiceType ?? inv.EINVOICETYPE ?? '',
          rawData: inv
        };
      });

      setErrors(matchedInvoices);
      setLastRefreshedAt(new Date());
      setPage(1);
      const selectedMatch = targetInvoiceNumber
        ? matchedInvoices.find((inv) => String(inv.id).toLowerCase() === String(targetInvoiceNumber).toLowerCase())
        : null;
      const nextSelectedError = selectedMatch?.id || matchedInvoices[0]?.id || null;
      setSelectedError(nextSelectedError);
      return nextSelectedError;
    } catch (err) {
      console.error('Errors fetch error:', err);
      snackbar.error('Failed to load invoices');
      setErrors([]);
      setSelectedError(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    const refreshedSelectedError = await fetchErrors({
      targetInvoiceNumber: selectedError || searchTerm
    });

    if (refreshedSelectedError === selectedError || (!refreshedSelectedError && selectedError)) {
      await fetchResponseLogs(refreshedSelectedError);
    }
  };

  useEffect(() => {
    const queryInvoiceNumber = searchParams.get('invnum') || searchParams.get('q') || '';
    const queryFromDate = getDateInputValue(searchParams.get('fromDate'));

    if (queryInvoiceNumber) {
      setSearchTerm(queryInvoiceNumber);
      setPage(1);
    }
    if (queryFromDate) setStartDate(queryFromDate);

    fetchErrors({
      fromDate: queryFromDate || startDate,
      toDate: endDate,
      targetInvoiceNumber: queryInvoiceNumber || searchTerm
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    fetchResponseLogs(selectedError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedError]);

  const handleUpdateInvoice = async () => {
    const selectedRawData = selectedErrorData?.rawData || {};
    const invoiceNumber =
      selectedRawData.InvoiceNumber ||
      selectedRawData.InvNumber ||
      selectedRawData.INVNUMBER ||
      selectedErrorData?.id ||
      selectedError ||
      '';
    const autoIndex = selectedRawData.AutoIndex ?? selectedRawData.AUTOINDEX ?? null;

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

      const refreshedSelectedError = await fetchErrors({
        targetInvoiceNumber: invoiceNumber
      });
      await fetchResponseLogs(refreshedSelectedError || invoiceNumber);
      snackbar.success(data.message || `${documentConfig.itemLabel} ${invoiceNumber} synchronized successfully`);
    } catch (err) {
      console.error('Invoice update error', err);
      snackbar.error(`Failed to synchronize ${documentConfig.itemLabel.toLowerCase()}: ${err.message}`);
    } finally {
      setIsUpdating(false);
    }
  };


  return (
    <div className="errors-page">
      <div className="page-header">
        <h1 className="page-title">Artax Documents Errors</h1>
        <div className="failed-documents-refresh">
          <span className="last-refresh-time">
            Last Synced: {formatRefreshTime(lastRefreshedAt)}
          </span>
          <button
            className="btn btn-outline failed-refresh-btn"
            type="button"
            onClick={handleRefresh}
            disabled={loading || responseLogsLoading}
            title="Refresh Artax Documents Errors"
            aria-label="Refresh Artax Documents Errors"
          >
            <RefreshCw size={16} className={loading || responseLogsLoading ? 'refresh-icon spinning' : 'refresh-icon'} />
            {loading || responseLogsLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="errors-split-view">
        {/* Left Panel: List */}
        <div className="card left-panel">
          <div className="panel-header">
            <h2>Error Document List</h2>
          </div>

          <div className="table-controls">
            <div className="search-box full-width">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="native-date-filters flex-row gap-2">
              <div className="date-input-wrapper">
                <input
                  type="date"
                  className="native-date-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <span className="date-separator">-</span>
              <div className="date-input-wrapper">
                <input
                  type="date"
                  className="native-date-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" type="button" onClick={() => fetchErrors()} disabled={loading}>
                Go
              </button>
            </div>
          </div>

          <div className="table-container list-container">
            <table className="data-table selectable">
              <thead>
                <tr>
                  <th>Document #</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  {/* <th>Status</th> */}
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                      Loading...
                    </td>
                  </tr>
                ) : pagedErrors.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                      <div className="empty-error-message">
                        <span>No Error invoices found. Check failed invoices instead.</span>
                        <button
                          className="btn btn-warning"
                          type="button"
                          onClick={() => navigate('/failed')}
                        >
                          Go to Failed <ArrowRight size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pagedErrors.map((err) => (
                    <tr
                      key={err.id}
                      className={selectedError === err.id ? 'selected-row' : ''}
                      onClick={() => setSelectedError(err.id)}
                    >
                      <td className="font-medium">{err.id}</td>
                      <td className="text-secondary">{err.date}</td>
                      <td>{err.client}</td>
                      <td className="font-medium">{err.amount}</td>
                      {/* <td>
                        <span className={`badge ${getStatusClass(err.status)}`}>{err.status}</span>
                      </td> */}
                      <td className="text-right">
                        <div className="row-action-buttons">
                          <button
                            className="action-btn"
                            type="button"
                            title="Send Document"
                            disabled={sending}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedError(err.id);
                              handleSendInvoice(err);
                            }}
                          >
                            <Send size={16} />
                          </button>
                          <button
                            className="action-btn"
                            type="button"
                            title="View Document"
                            onClick={(event) => {
                              event.stopPropagation();
                              openInvoiceModal(err.id);
                            }}
                          >
                            <Eye size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="table-footer">
            <span className="text-secondary text-sm">
              Showing {totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} Error
            </span>
            {/* Static pagination controls */}
            <div className="pagination">
              <button
                className={`page-btn ${page <= 1 ? 'disabled' : ''}`}
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                {'<'}
              </button>
              <button
                className={`page-btn ${page * PAGE_SIZE >= totalCount ? 'disabled' : ''}`}
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page * PAGE_SIZE >= totalCount}
              >
                {'>'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: DETAILS */}
        <div className="card right-panel">
          <div className="panel-header detailed-header error-detail-header">
            <div>
              <h2>{selectedErrorData?.type || 'Invoice'} - {selectedErrorData?.id || 'N/A'}</h2>
              <div className="detail-subtitle">
                <span>{selectedErrorData?.date || 'No date'}</span>
                <span>{selectedErrorData?.client || 'No buyer name'}</span>
              </div>
            </div>
            <div className="detail-header-actions">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => handleSendInvoice()}
                disabled={!selectedErrorData || sending}
              >
                <Send size={16} /> {sending ? 'Sending...' : 'Send'}
              </button>
              <button
                className="btn btn-outline"
                type="button"
                onClick={handleUpdateInvoice}
                disabled={!selectedErrorData || isUpdating}
              >
                <RotateCw size={16} /> {isUpdating ? 'Updating...' : 'Update'}
              </button>

              <button
                className="btn btn-outline"
                type="button"
                onClick={() => openInvoiceModal(selectedErrorData?.id)}
                disabled={!selectedErrorData}
              >
                <Eye size={16} /> View Document
              </button>
            </div>
          </div>

          {selectedErrorData ? (
            <>
              <div className="details-info-grid compact">
                <div className="info-block">
                  <span className="info-label">Amount</span>
                  <span className="info-value">{selectedErrorData.amount}</span>
                </div>
                <div className="info-block">
                  <span className="info-label">Retry Count</span>
                  <span className="info-value">{responseLogsLoading ? '...' : responseLogs.length}</span>
                </div>
                <div className="info-block">
                  <span className="info-label">Document Type</span>
                  <span className="info-value">{selectedErrorData.type || '-'}</span>
                </div>
                {/* <div className="info-block">
                  <span className="info-label">Status</span>
                  <span className={`badge ${getStatusClass(selectedErrorData.status)}`}>{selectedErrorData.status}</span>
                </div> */}
              </div>

              <div className="error-trace-container">
                <h3 className="trace-title">Response Log</h3>

                {responseLogsLoading ? (
                  <div className="response-empty">Loading response log...</div>
                ) : responseLogs.length === 0 ? (
                  <div className="response-empty">No response log found for this invoice</div>
                ) : (
                  <div className="response-log-list">
                    {responseLogs.map((log) => {
                      const isExpanded = expandedLogId === log.Id;
                      return (
                        <div className="response-log-item" key={log.Id}>
                          <button
                            type="button"
                            className="response-log-toggle"
                            onClick={() => setExpandedLogId(isExpanded ? null : log.Id)}
                          >
                            <span className="response-log-main">
                              <span className="response-log-date">{formatDateTime(log.responseCreatedDate)}</span>
                              <span className={`badge ${getStatusClass(log.status)}`}>{log.status || 'Unknown'}</span>
                            </span>
                            <ChevronDown className={isExpanded ? 'expanded' : ''} size={18} />
                          </button>
                          {isExpanded && (
                            <div className="response-log-message">
                              {log.responseMessage || 'No response message'}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p>Select an Document to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Slide-over for Invoice */}
      <InvoiceDetailsModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        invoiceId={modalInvoiceId}
        invoice={errors.find((err) => err.id === modalInvoiceId)?.rawData}
        documentType="invoice"
      />
    </div>
  );
};

export default Errors;
