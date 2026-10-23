import { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  ShoppingCart,
  Undo2,
  ArrowLeftRight,
  Landmark,
  Network,
  Server,
  Activity,
  ShieldCheck,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useSnackbar } from '../components/Snackbar';
import { API_BASE_URL, apiFetch } from '../services/apiService';
import '../Styles/Dashboard.css';

const getDates = (days) => {
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(toDate.getDate() - days);
  return {
    fromDate: fromDate.toISOString().split('T')[0],
    toDate: toDate.toISOString().split('T')[0]
  };
};

const formatLastSynced = (date = new Date()) =>
  date.toLocaleString('en-AE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

const getTransactionStatus = (status) => {
  const stat = String(status ?? '').trim();
  const upperStat = stat.toUpperCase();

  if (stat === '1') {
    return { label: 'Pending', color: 'warning', chartKey: 'Pending' };
  }

  if (stat === '3' || upperStat === 'SUCCESS') {
    return { label: 'Success', color: 'success', chartKey: 'Success' };
  }

  if (stat === '4' || upperStat === 'FAILED') {
    return { label: 'Failed', color: 'error', chartKey: 'Failed' };
  }

  if (stat === '6' || upperStat === 'ERROR') {
    return { label: 'Error', color: 'error', chartKey: 'Error' };
  }

  return null;
};

const getCurrencyCode = (source) =>
  String(source?.InvoiceCurrencyCode || source?.invoice_currency_code || 'AED').trim().toUpperCase();

const formatCurrencyAmount = (amount, currencyCode = 'AED') => {
  if (amount === null || amount === undefined || amount === '') return '-';
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

const formatActivityDateTime = (value, hourOffset = 0) => {
  if (!value) return 'N/A';
  const text = String(value).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2}(?::\d{2})?)/);

  if (!match) return text;
  if (!hourOffset) return `${match[1]} ${match[2]}`;

  const [year, month, day] = match[1].split('-').map(Number);
  const [hour, minute, second = 0] = match[2].split(':').map(Number);
  const adjustedDate = new Date(year, month - 1, day, hour + hourOffset, minute, second);
  const pad = (number) => String(number).padStart(2, '0');
  const adjustedDateText = [
    adjustedDate.getFullYear(),
    pad(adjustedDate.getMonth() + 1),
    pad(adjustedDate.getDate())
  ].join('-');
  const adjustedTimeText = [
    pad(adjustedDate.getHours()),
    pad(adjustedDate.getMinutes()),
    ...(match[2].split(':').length === 3 ? [pad(adjustedDate.getSeconds())] : [])
  ].join(':');

  return `${adjustedDateText} ${adjustedTimeText}`;
};

const getSortableDateTime = (value, hourOffset = 0) => {
  if (!value) return 0;
  const text = String(value).trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2}(?::\d{2})?)/);
  const normalizedText = match ? `${match[1]}T${match[2]}` : text;
  const timestamp = new Date(normalizedText).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp + (hourOffset * 60 * 60 * 1000);
};

const getInboundDocumentType = (invoiceType) => {
  const type = String(invoiceType ?? '').trim();
  if (type === '381') return 'Purchase Return';
  return 'Purchase';
};

const CORNER_NODES = [
  { id: 'sage', label: 'Sage', sublabel: 'ERP source', icon: Server, position: 'corner-sage' },
  { id: 'artax', label: 'ARTAX', sublabel: 'Connector', icon: ArrowLeftRight, position: 'corner-artax', highlight: true },
  { id: 'taxilla', label: 'Taxilla', sublabel: 'Accredited SP', icon: ShieldCheck, position: 'corner-taxilla' },
  { id: 'fta', label: 'UAE FTA', sublabel: 'Authority', icon: Landmark, position: 'corner-fta' },
  { id: 'next-asp', label: 'ASP', sublabel: 'Buyer/Seller ASP', icon: Network, position: 'corner-next-asp' }
];

const Dashboard = () => {
  const snackbar = useSnackbar();
  const [timePeriod, setTimePeriod] = useState(7);
  const [dashboardCounts, setDashboardCounts] = useState({ invoices: {}, creditNotes: {}, purchases: {} });
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [purchaseActivity, setPurchaseActivity] = useState([]);
  const [lastSynced, setLastSynced] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const { fromDate, toDate } = getDates(timePeriod);
      const params = new URLSearchParams({ fromDate, toDate });

      const invDashRes = await apiFetch(`${API_BASE_URL}/invoice/dashboard?${params.toString()}`);
      const cnDashRes = await apiFetch(`${API_BASE_URL}/creditnote/dashboard?${params.toString()}`);
      const purchaseDashRes = await apiFetch(`${API_BASE_URL}/purchase/dashboard?${params.toString()}`);

      const invData = invDashRes.ok ? await invDashRes.json() : {};
      const cnData = cnDashRes.ok ? await cnDashRes.json() : {};
      const purchaseData = purchaseDashRes.ok ? await purchaseDashRes.json() : {};

      setDashboardCounts({ invoices: invData, creditNotes: cnData, purchases: purchaseData });

      const txParams = new URLSearchParams({ type: 'all', fromDate, toDate });
      const invTxRes = await apiFetch(`${API_BASE_URL}/invoice/getinvoices?${txParams.toString()}`);
      const cnTxRes = await apiFetch(`${API_BASE_URL}/creditnote/getcreditnotes?${txParams.toString()}`);
      const purchaseActivityRes = await apiFetch(`${API_BASE_URL}/purchase/recent-activity?${params.toString()}`);

      const invTxData = invTxRes.ok ? await invTxRes.json() : [];
      const cnTxData = cnTxRes.ok ? await cnTxRes.json() : [];
      const purchaseActivityData = purchaseActivityRes.ok ? await purchaseActivityRes.json() : [];

      const mergedTx = [
        ...(Array.isArray(invTxData) ? invTxData : []).map(inv => ({ ...inv, docTypeLabel: 'Invoice', docType: 4 })),
        ...(Array.isArray(cnTxData) ? cnTxData : []).map(cn => ({ ...cn, docTypeLabel: 'Credit Note', docType: 1 }))
      ].filter(txn => String(txn.Status ?? '').trim() !== '0')
        .sort((a, b) => {
          const qa = Number(a.QueueID || 0);
          const qb = Number(b.QueueID || 0);
          return qb - qa;
        });

      setTransactions(mergedTx);
      setPurchaseActivity(Array.isArray(purchaseActivityData) ? purchaseActivityData : []);
      setLastSynced(formatLastSynced());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      snackbar.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [timePeriod]);

  const invDash = dashboardCounts.invoices || {};
  const cnDash = dashboardCounts.creditNotes || {};
  const purchaseDash = dashboardCounts.purchases || {};

  const totalInvoices = invDash.total || 0;
  const totalCreditNotes = cnDash.total || 0;
  const totalPurchases = purchaseDash.purchaseFromDocuments || 0;
  const totalPurchaseReturns = purchaseDash.purchaseReturn || 0;
  const pending = (invDash.pending || 0) + (cnDash.pending || 0);
  const success = (invDash.success || invDash.received || 0) + (cnDash.success || cnDash.received || 0);
  const failed = (invDash.failed || 0) + (cnDash.failed || 0);
  const error = (invDash.error || 0) + (cnDash.error || 0);

  const outboundTotal = totalInvoices + totalCreditNotes;
  const inboundTotal = purchaseDash.total || purchaseDash.purchase || (totalPurchases + totalPurchaseReturns);
  const processedTotal = pending + success + failed + error;
  const totalDocs = outboundTotal + inboundTotal;
  const attentionDocs = pending + failed + error;
  const successRate = processedTotal > 0 ? Math.round((success / processedTotal) * 100) : 0;
  const outboundFlowCount = success.toLocaleString();
  const inboundFlowCount = inboundTotal.toLocaleString();
  const getFlowTokenWidth = (value) => Math.max(28, value.length * 7 + 18);
  const outboundFlowTokenWidth = getFlowTokenWidth(outboundFlowCount);
  const inboundFlowTokenWidth = getFlowTokenWidth(inboundFlowCount);

  const kpiSections = [
    {
      title: 'Outbound Documents',
      subtitle: 'Sales invoices & credit notes to UAE network',
      accent: 'outbound',
      metrics: [
        { title: 'Invoices', value: totalInvoices, icon: FileText, color: 'blue' },
        { title: 'Credit Notes', value: totalCreditNotes, icon: FileText, color: 'indigo' }
      ]
    },
    {
      title: 'Inbound Documents',
      subtitle: 'Purchase & Return to Supplier documents received',
      accent: 'inbound',
      metrics: [
        { title: 'Purchase', value: totalPurchases, icon: ShoppingCart, color: 'teal' },
        { title: 'Purchase Return', value: totalPurchaseReturns, icon: Undo2, color: 'amber' }
      ]
    },
    {
      title: 'Processing Status',
      subtitle: 'Document lifecycle across all channels',
      accent: 'status',
      metrics: [
        { title: 'Pending', value: pending, icon: Clock, color: 'purple' },
        { title: 'Success', value: success, icon: CheckCircle, color: 'green' },
        { title: 'Failed', value: failed, icon: AlertTriangle, color: 'amber' },
        { title: 'Error', value: error, icon: AlertTriangle, color: 'red' }
      ]
    }
  ];

  const statusData = [
    { name: 'Pending', value: pending, color: '#f97316' },
    { name: 'Success', value: success, color: 'var(--success)' },
    { name: 'Failed', value: failed, color: '#b45309' },
    { name: 'Error', value: error, color: 'var(--error)' }
  ];

  const getVolumeData = (txs, purchaseCounts, days) => {
    let data = [];
    const baseDate = new Date();
    const zeroCounts = { Success: 0, Pending: 0, Failed: 0, Error: 0 };
    const grouped = txs.reduce((acc, txn) => {
      if (!txn.InvoiceIssueDate) return acc;
      const dateStr = txn.InvoiceIssueDate.split('T')[0];
      if (!acc[dateStr]) {
        acc[dateStr] = { Success: 0, Pending: 0, Failed: 0, Error: 0 };
      }
      const statusInfo = getTransactionStatus(txn.Status);
      if (statusInfo) acc[dateStr][statusInfo.chartKey] += 1;
      return acc;
    }, {});
    const groupedPurchases = (Array.isArray(purchaseCounts) ? purchaseCounts : []).reduce((acc, item) => {
      const dateStr = String(item.date || '').split('T')[0];
      if (dateStr) {
        acc[dateStr] = (acc[dateStr] || 0) + Number(item.purchase || 0);
      }
      return acc;
    }, {});
    const addDateCounts = (target, dateStr) => {
      const counts = grouped[dateStr] || zeroCounts;
      target.Success += counts.Success;
      target.Pending += counts.Pending;
      target.Failed += counts.Failed;
      target.Error += counts.Error;
      target.Inbound += groupedPurchases[dateStr] || 0;
    };

    if (days <= 30) {
      for (let i = days - 1; i >= 0; i--) {
        let d = new Date(baseDate);
        d.setDate(baseDate.getDate() - i);
        let dateStr = d.toISOString().split('T')[0];
        let label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        let counts = grouped[dateStr] || zeroCounts;
        data.push({ date: label, ...counts, Inbound: groupedPurchases[dateStr] || 0 });
      }
    } else if (days < 360) {
      const weekCount = Math.ceil(days / 7);
      for (let i = weekCount - 1; i >= 0; i--) {
        let start = new Date(baseDate);
        start.setDate(baseDate.getDate() - (i * 7) - 6);
        let end = new Date(start);
        end.setDate(start.getDate() + 6);
        if (end > baseDate) end = new Date(baseDate);

        let intervalCounts = { Success: 0, Pending: 0, Failed: 0, Error: 0, Inbound: 0 };
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          addDateCounts(intervalCounts, d.toISOString().split('T')[0]);
        }

        const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        data.push({ date: `${startLabel}-${endLabel}`, ...intervalCounts });
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const start = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
        let end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        if (end > baseDate) end = new Date(baseDate);

        let intervalCounts = { Success: 0, Pending: 0, Failed: 0, Error: 0, Inbound: 0 };
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          addDateCounts(intervalCounts, d.toISOString().split('T')[0]);
        }

        data.push({
          date: start.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          ...intervalCounts
        });
      }
    }
    return data;
  };

  const volumeData = getVolumeData(transactions, purchaseDash.dailyPurchaseCounts, timePeriod);
  const rotateTrendLabels = timePeriod <= 30 || timePeriod === 180;

  const topClients = transactions
    .reduce((acc, txn) => {
      const existing = acc.find(c => c.name === txn.Customer);
      if (existing) {
        existing.invoices += 1;
        existing.volume += Number(txn.InvTotIncl || 0);
        if (existing.currency !== getCurrencyCode(txn)) {
          existing.currency = 'MIXED';
        }
      } else {
        acc.push({
          name: txn.Customer || 'Unknown',
          invoices: 1,
          volume: Number(txn.InvTotIncl || 0),
          currency: getCurrencyCode(txn)
        });
      }
      return acc;
    }, [])
    .sort((a, b) => b.volume - a.volume)
    .map(c => ({
      ...c,
      volume: c.currency === 'MIXED'
        ? c.volume.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : formatCurrencyAmount(c.volume, c.currency)
    }));

  const topInboundClients = purchaseActivity
    .reduce((acc, row) => {
      const name = row.Client || 'Unknown';
      const existing = acc.find(c => c.name === name);
      const amount = Number(row.AmountValue || 0);
      const currency = String(row.CurrencyCode || 'AED').trim().toUpperCase();

      if (existing) {
        existing.documents += 1;
        existing.volume += amount;
        if (existing.currency !== currency) {
          existing.currency = 'MIXED';
        }
      } else {
        acc.push({
          name,
          documents: 1,
          volume: amount,
          currency
        });
      }
      return acc;
    }, [])
    .sort((a, b) => b.volume - a.volume)
    .map(c => ({
      ...c,
      volume: c.currency === 'MIXED'
        ? c.volume.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : formatCurrencyAmount(c.volume, c.currency)
    }));

  const recentErrors = transactions
    .filter(txn => {
      const statusInfo = getTransactionStatus(txn.Status);
      return statusInfo?.chartKey === 'Failed' || statusInfo?.chartKey === 'Error';
    })
    .map(txn => ({
      id: txn.InvoiceNumber || txn.InvNumber || 'N/A',
      client: txn.Customer || 'Unknown',
      date: txn.InvoiceIssueDate ? txn.InvoiceIssueDate.split('T')[0] : 'N/A',
      type: txn.docTypeLabel,
      error: getTransactionStatus(txn.Status)?.label === 'Error'
        ? 'Document has a Sage error'
        : 'ASP rejected due to validation error.'
    }));

  const recentActivity = transactions
    .map(txn => {
      const statusInfo = getTransactionStatus(txn.Status);
      if (!statusInfo) return null;

      return {
        id: txn.InvoiceNumber || txn.InvNumber || 'N/A',
        client: txn.Customer || 'Unknown',
        date: formatActivityDateTime(txn.CreatedAt || txn.created_at),
        sortDate: txn.CreatedAt || txn.created_at || txn.InvoiceIssueDate || '',
        direction: 'OUTBOUND',
        type: txn.docTypeLabel,
        amount: formatCurrencyAmount(txn.InvTotIncl, getCurrencyCode(txn)),
        status: statusInfo.label,
        color: statusInfo.color
      };
    })
    .filter(Boolean)
    .concat(
      purchaseActivity.map(row => ({
        id: row.DocumentNo || 'N/A',
        client: row.Client || 'Unknown',
        date: formatActivityDateTime(row.CreatedAt, 4),
        sortDate: row.CreatedAt || row.Date || '',
        sortOffsetHours: 4,
        direction: row.Type || 'INBOUND',
        type: getInboundDocumentType(row.InvoiceType),
        amount: formatCurrencyAmount(row.AmountValue, row.CurrencyCode),
        status: row.Status || 'Pending',
        color: 'success'
      }))
    )
    .sort((a, b) =>
      getSortableDateTime(b.sortDate, b.sortOffsetHours || 0) -
      getSortableDateTime(a.sortDate, a.sortOffsetHours || 0)
    );

  const periodLabel = timePeriod === 1 ? 'Today' : `Last ${timePeriod} days`;

  return (
    <div className="dashboard">
      {/* Hero Header */}
      <section className="dashboard-hero">
        <div className="dashboard-hero-content">
          <div className="dashboard-hero-text">
            <div className="hero-eyebrow">
              <ShieldCheck size={14} />
              <span>UAE E-Invoicing · 5-Corner Artax Connector</span>
            </div>
            {/* <h1 className="dashboard-title">Connector Command Center</h1> */}
            <p className="dashboard-subtitle">
              Monitor Outbound and Inbound documents through your ARTAX Connector  from Sage ERP to UAE Peppol network compliance.
            </p>
          </div>

          <div className="dashboard-hero-controls">
            <div className="hero-stat-pills">
              <span className="hero-pill live">
                <span className="live-dot" />
                Live Connector
              </span>
              <span className="hero-pill">
                <Clock size={13} />
                Synced {lastSynced || '...'}
              </span>
            </div>

            <div className="hero-control-row">
              <div className="time-toggle">
                {[1, 7, 30, 90, 180, 360].map(days => (
                  <button
                    key={days}
                    className={`toggle-btn ${timePeriod === days ? 'active' : ''}`}
                    onClick={() => setTimePeriod(days)}
                  >
                    {days}D
                  </button>
                ))}
              </div>

              <button
                className="dashboard-refresh-btn"
                onClick={fetchData}
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? 'spinning' : ''} />
                {loading ? 'Refreshing' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        <div className="hero-summary-strip">
          <div className="summary-metric">
            <ArrowUpRight size={18} />
            <div>
              <span className="summary-value">{outboundTotal.toLocaleString()}</span>
              <span className="summary-label">Outbound docs</span>
            </div>
          </div>
          <div className="summary-divider" />
          <div className="summary-metric">
            <ArrowDownLeft size={18} />
            <div>
              <span className="summary-value">{inboundTotal.toLocaleString()}</span>
              <span className="summary-label">Inbound docs</span>
            </div>
          </div>

          <div className="summary-divider" />
          <div className="summary-metric">
            <Activity size={18} />
            <div>
              <span className="summary-value">{totalDocs.toLocaleString()}</span>
              <span className="summary-label">Total Docs · {periodLabel}</span>
            </div>
          </div>

          <div className="summary-divider" />
          <div className="summary-metric">
            <TrendingUp size={18} />
            <div>
              <span className="summary-value">{successRate}%</span>
              <span className="summary-label">Success rate</span>
            </div>
          </div>

          <div className="summary-divider" />
          <div className="summary-metric">
            <Activity size={18} />
            <div>
              <span className="summary-value">{attentionDocs.toLocaleString()}</span>
              <span className="summary-label">Attention needed · {periodLabel}</span>
            </div>
          </div>

        </div>
      </section>



      {/* KPI Sections */}
      <div className="kpi-sections">
        {kpiSections.map((section) => (
          <section key={section.title} className={`kpi-section kpi-section--${section.accent}`}>
            <div className="kpi-section-header">
              <h3 className="kpi-section-title">{section.title}</h3>
              <p className="kpi-section-subtitle">{section.subtitle}</p>
            </div>
            <div className="kpi-section-grid">
              {section.metrics.map((metric) => {
                const Icon = metric.icon;
                return (
                  <div key={metric.title} className="card kpi-card">
                    <div className="kpi-header">
                      <span className="kpi-title">{metric.title}</span>
                      <div className={`kpi-icon-wrapper bg-${metric.color}-light`}>
                        <Icon size={18} className={`kpi-icon ${metric.color}`} />
                      </div>
                    </div>
                    <div className="kpi-body">
                      <h2 className="kpi-value">{metric.value.toLocaleString()}</h2>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Analytics Grid */}
      <div className="dashboard-analytics">
        <div className="card chart-card">
          <div className="card-header-row">
            <h3 className="card-title">Outbound Distribution</h3>
            <span className="card-badge">{periodLabel}</span>
          </div>
          <div className="pie-chart-container">
            <div className="pie-chart-wrap">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={62}
                    outerRadius={88}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="pie-center-label">
                <span className="pie-center-value">{successRate}%</span>
                <span className="pie-center-text">Success</span>
              </div>
            </div>
            <div className="custom-legend">
              {statusData.map((item, index) => (
                <div key={index} className="legend-item">
                  <div className="legend-label">
                    <span className="legend-dot" style={{ backgroundColor: item.color }} />
                    <span className="legend-text">{item.name}</span>
                  </div>
                  <span className="legend-value">{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card chart-card chart-card--wide">
          <div className="card-header-row">
            <h3 className="card-title">Documents over time</h3>
            <span className="card-badge">{timePeriod} day window</span>
          </div>
          <div className="bar-chart-container">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={volumeData} margin={{ top: 10, right: 10, left: -10, bottom: rotateTrendLabels ? 18 : 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  minTickGap={0}
                  angle={rotateTrendLabels ? -45 : 0}
                  textAnchor={rotateTrendLabels ? 'end' : 'middle'}
                  height={rotateTrendLabels ? 58 : 30}
                  tick={{ fontSize: rotateTrendLabels ? 10 : 11, fill: 'var(--text-secondary)' }}
                  dy={8}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} dx={-5} />
                <Tooltip cursor={{ fill: 'var(--bg-surface-hover)' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '12px', fontSize: '12px' }} />
                <Bar dataKey="Success" stackId="a" fill="var(--success)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="Pending" stackId="a" fill="#f97316" />
                <Bar dataKey="Failed" stackId="a" fill="#b45309" />
                <Bar dataKey="Error" stackId="a" fill="var(--error)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Inbound" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Insights Row */}
      <div className="dashboard-insights">
        <div className="card top-clients-card">
          <div className="card-header-row">
            <h3 className="card-title">Top Outbound Clients</h3>
            {/* <span className="card-badge">AED ranked</span> */}
          </div>
          <div className="top-clients-list">
            {topClients.map((client, idx) => (
              <div key={idx} className="client-item">
                <div className="client-rank">{idx + 1}</div>
                <div className="client-info">
                  <span className="client-name">{client.name}</span>
                  <span className="client-invoices">{client.invoices} documents</span>
                </div>
                <div className="client-stats">
                  <span className="client-volume">{client.volume}</span>
                </div>
              </div>
            ))}
            {topClients.length === 0 && (
              <div className="empty-state">No client data for this period.</div>
            )}
          </div>
        </div>

        <div className="card top-clients-card">
          <div className="card-header-row">
            <h3 className="card-title">Top Inbound Clients</h3>
          </div>
          <div className="top-clients-list">
            {topInboundClients.map((client, idx) => (
              <div key={idx} className="client-item">
                <div className="client-rank client-rank--inbound">{idx + 1}</div>
                <div className="client-info">
                  <span className="client-name">{client.name}</span>
                  <span className="client-invoices">{client.documents} documents</span>
                </div>
                <div className="client-stats">
                  <span className="client-volume">{client.volume}</span>
                </div>
              </div>
            ))}
            {topInboundClients.length === 0 && (
              <div className="empty-state">No inbound client data for this period.</div>
            )}
          </div>
        </div>

        <div className="card recent-errors-card">
          <div className="card-header-row">
            <h3 className="card-title"> Documents Issues</h3>
            <span className="card-badge error">{recentErrors.length} issues</span>
          </div>
          <div className="recent-errors-list">
            {recentErrors.map((error, index) => (
              <div key={index} className="error-item">
                <div className="error-item-header">
                  <span className="error-id">{error.id}</span>
                  <span className="error-type badge info-light">{error.type}</span>
                </div>
                <div className="error-item-details">
                  <span className="error-client">{error.client}</span>
                  <span className="error-date">{error.date}</span>
                </div>
                <span className="error-message badge error-light">{error.error}</span>
              </div>
            ))}
            {recentErrors.length === 0 && (
              <div className="empty-state success">
                <CheckCircle size={20} />
                <span>No failed documents in this period.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5-Corner Connector Hub */}
      <section className="card connector-hub-card">
        <div className="section-header">
          <div>
            <h2 className="section-title">E-Invoicing Flow</h2>
            {/* <p className="section-subtitle">Outbound splits from Taxilla to UAE FTA and the next ASP; inbound returns through Taxilla to ARTAX</p> */}
          </div>
          <div className="flow-legend">
            <span className="flow-legend-item outbound"><ArrowUpRight size={12} /> Outbound</span>
            <span className="flow-legend-item inbound"><ArrowDownLeft size={12} /> Inbound</span>
          </div>
        </div>

        <div className="connector-hub">
          <svg className="connector-lines" viewBox="0 0 800 340" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="flowGradOut" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="flowGradIn" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#0d9488" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#0d9488" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            <path className="flow-path outbound" d="M 90 78 C 150 58 215 58 270 78" />
            <path className="flow-path outbound" d="M 270 78 C 330 96 405 96 465 78" />
            <path className="flow-path outbound" d="M 465 78 C 555 86 625 118 705 170" />
            <path className="flow-path outbound" d="M 452 82 C 426 137 426 211 452 266" />
            <path className="flow-path inbound" d="M 478 266 C 504 211 504 137 478 82" />
            <path className="flow-path inbound" d="M 465 270 C 545 236 625 204 705 170" />
            <path className="flow-path inbound" d="M 465 78 C 405 56 330 56 270 78" />
            <g className="flow-token flow-token--outbound">
              <rect x={outboundFlowTokenWidth / -2} y="-13" width={outboundFlowTokenWidth} height="26" rx="13" />
              <text x="0" y="3">{outboundFlowCount}</text>
              <animateMotion
                dur="4.5s"
                repeatCount="indefinite"
                path="M 90 78 C 150 58 215 58 270 78 C 330 96 405 96 465 78"
              />
            </g>
            <g className="flow-token flow-token--outbound flow-token--split">
              <rect x={outboundFlowTokenWidth / -2} y="-13" width={outboundFlowTokenWidth} height="26" rx="13" />
              <text x="0" y="3">{outboundFlowCount}</text>
              <animateMotion
                dur="3.8s"
                begin="1.4s"
                repeatCount="indefinite"
                path="M 465 78 C 555 86 625 118 705 170"
              />
            </g>
            <g className="flow-token flow-token--outbound flow-token--split">
              <rect x={outboundFlowTokenWidth / -2} y="-13" width={outboundFlowTokenWidth} height="26" rx="13" />
              <text x="0" y="3">{outboundFlowCount}</text>
              <animateMotion
                dur="3.8s"
                begin="1.4s"
                repeatCount="indefinite"
                path="M 452 82 C 426 137 426 211 452 266"
              />
            </g>
            <g className="flow-token flow-token--inbound">
              <rect x={inboundFlowTokenWidth / -2} y="-13" width={inboundFlowTokenWidth} height="26" rx="13" />
              <text x="0" y="3">{inboundFlowCount}</text>
              <animateMotion
                dur="8s"
                begin="0.8s"
                repeatCount="indefinite"
                path="M 478 266 C 504 211 504 137 478 82 C 405 56 330 56 270 78"
              />
            </g>
            <g className="flow-token flow-token--inbound flow-token--authority-copy">
              <rect x={inboundFlowTokenWidth / -2} y="-13" width={inboundFlowTokenWidth} height="26" rx="13" />
              <text x="0" y="3">{inboundFlowCount}</text>
              <animateMotion
                dur="3.8s"
                begin="1.2s"
                repeatCount="indefinite"
                path="M 465 270 C 545 236 625 204 705 170"
              />
            </g>
          </svg>

          <div className="connector-nodes">
            {CORNER_NODES.map((node) => {
              const Icon = node.icon;
              return (
                <div
                  key={node.id}
                  className={`connector-node ${node.position} ${node.highlight ? 'highlight' : ''}`}
                >
                  <div className="connector-node-icon">
                    <Icon size={20} />
                  </div>
                  <span className="connector-node-label">{node.label}</span>
                  <span className="connector-node-sublabel">{node.sublabel}</span>
                  {node.id === 'artax' && (
                    <span className="connector-node-count">
                      {attentionDocs.toLocaleString()} waiting
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="connector-hub-stats">
            <div className="hub-stat">
              <span className="hub-stat-value">{success.toLocaleString()}</span>
              <span className="hub-stat-label">Sent</span>
            </div>
            <div className="hub-stat-divider" />
            <div className="hub-stat">
              <span className="hub-stat-value">{inboundTotal.toLocaleString()}</span>
              <span className="hub-stat-label">Received</span>
            </div>
            <div className="hub-stat-divider" />
            <div className="hub-stat">
              <span className="hub-stat-value">{attentionDocs.toLocaleString()}</span>
              <span className="hub-stat-label">Waiting</span>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Activity */}
      <div className="card recent-activity-card">
        <div className="card-header-row">
          <h3 className="card-title">Recent Document Activity</h3>
          <span className="card-badge">{recentActivity.length} records</span>
        </div>
        <div className="table-responsive recent-activity-table-wrapper">
          <table className="activity-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Document</th>
                <th>Client</th>
                <th>Created At</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.map((act, i) => (
                <tr key={i}>
                  <td>
                    <span className={`direction-chip direction-chip--${String(act.direction).toLowerCase()}`}>
                      {act.direction}
                    </span>
                  </td>
                  <td>
                    <div className="doc-id">{act.id}</div>
                    <div className="doc-type">{act.type}</div>
                  </td>
                  <td className="cell-client">{act.client}</td>
                  <td className="cell-muted">{act.date}</td>
                  <td className="cell-amount">{act.amount}</td>
                  <td>
                    <span
                      className={`status-chip status-chip--${act.color}`}
                    >
                      {act.status}
                    </span>
                  </td>
                </tr>
              ))}
              {recentActivity.length === 0 && (
                <tr>
                  <td colSpan="6" className="empty-row">No recent activity.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
