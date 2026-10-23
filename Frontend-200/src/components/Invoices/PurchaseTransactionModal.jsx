import { useEffect, useMemo, useState } from 'react';
import { X, FileCode, Loader2, Copy, Download } from 'lucide-react';
import { apiFetch } from '../../services/apiService';

import './InvoiceDetailsModal.css';

const DEFAULT_TRANSACTION_TABS = [
  'inbound',
  'c3_tdd_outbound',
  'mls_outbound',
  'c3_tdd_mls_inbound'
];

const valueFrom = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') return value;
  }
  return '';
};

const normalizeTransmissionType = (value) => String(value || '').trim().toLowerCase();

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const formatXml = (xml) => {
  const text = String(xml || '').trim();
  if (!text) return '';

  let formatted = '';
  let indent = 0;
  text
    .replace(/>\s*</g, '><')
    .split(/(?=<)|(?<=>)/g)
    .filter(Boolean)
    .forEach((node) => {
      if (/^<\//.test(node)) indent = Math.max(indent - 1, 0);
      formatted += `${'  '.repeat(indent)}${node}\n`;
      if (/^<[^!?/][^>]*[^/]?>$/.test(node)) indent += 1;
    });

  return formatted.trim();
};

const PurchaseTransactionModal = ({
  isOpen,
  onClose,
  invoice,
  apiBase,
  transactionTabs = DEFAULT_TRANSACTION_TABS,
  showXmlActions = true
}) => {
  const [activeTab, setActiveTab] = useState(transactionTabs[0]);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [xmlLoadingTab, setXmlLoadingTab] = useState('');
  const [xmlByTab, setXmlByTab] = useState({});
  const [error, setError] = useState('');

  const instanceIdentifier = valueFrom(invoice, ['InstanceIdentifier']);

  useEffect(() => {
    setActiveTab(transactionTabs[0]);
    setTransactions([]);
    setXmlByTab({});
    setError('');

    if (!isOpen || !instanceIdentifier) return;

    setIsLoading(true);
    apiFetch(`${apiBase}/transactions/${encodeURIComponent(instanceIdentifier)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || data || 'Failed to load transaction details');
        }
        setTransactions(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('Purchase transaction fetch error', err);
        setError(err.message || 'Failed to load transaction details');
      })
      .finally(() => setIsLoading(false));
  }, [apiBase, instanceIdentifier, isOpen, transactionTabs]);

  const groupedTransactions = useMemo(() => (
    transactionTabs.reduce((acc, tab) => {
      acc[tab] = transactions.filter(
        (transaction) => normalizeTransmissionType(transaction.TransmissionType) === tab
      );
      return acc;
    }, {})
  ), [transactionTabs, transactions]);

  const activeRows = groupedTransactions[activeTab] || [];
  const activeTransaction = activeRows.find((row) => valueFrom(row, ['TransactionId'])) || activeRows[0];
  const activeTransactionId = valueFrom(activeTransaction, ['TransactionId']);
  const rootTransmissionType = valueFrom(transactions[0], ['RootTransmissionType']);

  const handleLoadXml = async () => {
    if (!activeTransactionId) return;

    setXmlLoadingTab(activeTab);
    setError('');

    try {
      const response = await apiFetch(`${apiBase}/transaction-xml/${encodeURIComponent(activeTransactionId)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to load XML');
      }

      setXmlByTab((current) => ({
        ...current,
        [activeTab]: formatXml(data?.xml || '')
      }));
    } catch (err) {
      console.error('Purchase transaction XML fetch error', err);
      setError(err.message || 'Failed to load XML');
    } finally {
      setXmlLoadingTab('');
    }
  };

  const handleCopyXml = async () => {
    const xml = xmlByTab[activeTab];
    if (!xml) return;

    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(xml);
        return;
      }
    } catch (err) {
      console.warn('Clipboard API copy failed, using fallback', err);
    }

    const textarea = document.createElement('textarea');
    textarea.value = xml;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    document.execCommand('copy');
    document.body.removeChild(textarea);
  };

  const handleDownloadXml = () => {
    const xml = xmlByTab[activeTab];
    if (!xml || !activeTransactionId) return;

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeTransactionId}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="transaction-modal" role="dialog" aria-modal="true">
        <div className="transaction-modal-header">
          <div>
            <p className="transaction-modal-kicker">MLS Response</p>
            <h2 className="transaction-modal-title">{instanceIdentifier || '-'} #{rootTransmissionType || '-'}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close">
            <X size={22} />
          </button>
        </div>

        <div className="transaction-modal-body">
          <div className="transaction-tabs">
            {transactionTabs.map((tab) => (
              <button
                key={tab}
                className={`transaction-tab-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
                <span>{groupedTransactions[tab]?.length || 0}</span>
              </button>
            ))}
          </div>

          {error && <div className="transaction-error">{error}</div>}

          {isLoading ? (
            <div className="transaction-loading">
              <div className="spinner" />
              <span>Loading transaction details...</span>
            </div>
          ) : (
            <div className="transaction-tab-panel">
              <div className="table-responsive">
                <table className="lines-table transaction-table">
                  <thead>
                    <tr>
                      <th>TransactionId</th>
                      <th>Status</th>
                      <th>Sender</th>
                      <th>Receiver</th>
                      <th>InstanceIdentifier</th>
                      <th>RefInstanceIdentifier</th>
                      <th>C5 Dispatch</th>
                      <th>Created</th>
                      <th>Modified</th>
                      <th>Has File</th>
                      <th>Error Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeRows.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="text-center text-secondary">No transaction data for {activeTab}</td>
                      </tr>
                    ) : (
                      activeRows.map((row, index) => (
                        <tr key={`${row.TransactionId || activeTab}-${index}`}>
                          <td>{row.TransactionId || '-'}</td>
                          <td>{row.Status || '-'}</td>
                          <td>{row.SenderParticipantId || '-'}</td>
                          <td>{row.ReceiverParticipantId || '-'}</td>
                          <td>{row.InstanceIdentifier || '-'}</td>
                          <td>{row.RefInstanceIdentifier || '-'}</td>
                          <td>{row.C5DispatchStatus || '-'}</td>
                          <td>{formatDateTime(row.CreatedDate) || '-'}</td>
                          <td>{formatDateTime(row.LastModifiedDate) || '-'}</td>
                          <td>{row.HasFile ? 'Yes' : 'No'}</td>
                          <td>{row.ErrorDetails || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {showXmlActions && (
                <div className="transaction-xml-toolbar">
                  <div className="transaction-xml-main-actions">
                    <button
                      className="btn btn-primary"
                      onClick={handleLoadXml}
                      disabled={!activeTransactionId || xmlLoadingTab === activeTab}
                    >
                      {xmlLoadingTab === activeTab ? <Loader2 size={16} className="spin-icon" /> : <FileCode size={16} />}
                      {xmlLoadingTab === activeTab ? 'Loading...' : 'XML'}
                    </button>
                    <span className="text-sm text-secondary">{activeTransactionId || 'No TransactionId available for this tab'}</span>
                  </div>
                  <div className="transaction-xml-icon-actions">
                    <button
                      className="icon-btn"
                      onClick={handleCopyXml}
                      disabled={!xmlByTab[activeTab]}
                      title="Copy XML"
                    >
                      <Copy size={18} />
                    </button>
                    <button
                      className="icon-btn"
                      onClick={handleDownloadXml}
                      disabled={!xmlByTab[activeTab] || !activeTransactionId}
                      title="Download XML"
                    >
                      <Download size={18} />
                    </button>
                  </div>
                </div>
              )}

              {showXmlActions && xmlByTab[activeTab] && (
                <pre className="xml-viewer">
                  <code>{xmlByTab[activeTab]}</code>
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default PurchaseTransactionModal;
