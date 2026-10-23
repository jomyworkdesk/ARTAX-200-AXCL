import { useEffect, useMemo, useState } from 'react';
import { Eye, RefreshCw, X } from 'lucide-react';
import { useSnackbar } from '../components/Snackbar';
import { API_BASE_URL, apiFetch } from '../services/apiService';
import '../Styles/LogFile.css';

const formatDateTime = (value) => {
  if (!value) return '';
  return String(value).replace('T', ' ').slice(0, 19);
};

const getTokenExpiresAt = (row) => {
  const expiresTimestamp = Number(row.expires_in);

  if (!Number.isFinite(expiresTimestamp)) return '';

  const epochMillis = expiresTimestamp < 1000000000000
    ? expiresTimestamp * 1000
    : expiresTimestamp;
  const date = new Date(epochMillis);

  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date).replace(',', '');
};

const getStatusText = (statusCode) => {
  const code = Number(statusCode);
  const statusMap = {
    100: 'Continue',
    101: 'Switching Protocols',
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    304: 'Not Modified',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Validation Error',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable'
  };

  if (!Number.isFinite(code)) return statusCode || '';

  const label = statusMap[code] || (
    code >= 200 && code < 300 ? 'Success' :
    code >= 300 && code < 400 ? 'Redirect' :
    code >= 400 && code < 500 ? 'Client Error' :
    code >= 500 ? 'Server Error' :
    'HTTP Status'
  );

  return `${code} ${label}`;
};

const stripNamespace = (value) => {
  if (!value) return '';
  const text = String(value);
  const match = text.match(/:([A-Za-z0-9_]+)'?$/);
  return match ? match[1] : text;
};

const buildFriendlyError = (row) => {
  const source = row?.errorDetails || row?.responseMessage || '';
  if (!source) return '';

  const validationFailed = source.match(/Invoice validation failed\./i);
  const ref = source.match(/Ref identifier:\s*\[([^\]]+)\]/i)?.[1];
  const invalidElement = source.match(/Invalid content was found starting with element '\{[^}]+":([^"}]+)"?\}'/i)?.[1];
  const expectedElement = source.match(/One of '\{[^}]+":([^"}]+)"?\}' is expected/i)?.[1];
  const saxMessage = source.match(/\[SAX\]\s*([^\]]+)/i)?.[1];

  const lines = [];
  if (validationFailed) lines.push('Invoice validation failed.');
  if (ref) lines.push(`Reference: ${ref}`);
  if (invalidElement) lines.push(`Problem: ${stripNamespace(invalidElement)} is in the wrong place.`);
  if (expectedElement) lines.push(`Expected: ${stripNamespace(expectedElement)} should be there instead.`);
  if (!invalidElement && saxMessage) lines.push(`Technical detail: ${saxMessage}`);

  return lines.length ? lines.join('\n') : source;
};

const DetailItem = ({ label, value, wide = false }) => (
  <div className={`log-detail-item ${wide ? 'wide' : ''}`}>
    <span className="log-detail-label">{label}</span>
    <span className="log-detail-value">{value || ''}</span>
  </div>
);

const buildLocationLabel = (row) => {
  const parts = [row?.City, row?.Country].filter(Boolean);
  if (parts.length) return parts.join(', ');
  if (row?.Latitude !== null && row?.Latitude !== undefined && row?.Longitude !== null && row?.Longitude !== undefined) {
    return 'Location captured';
  }
  return '';
};

const buildMapUrl = (row) => {
  if (row?.Latitude === null || row?.Latitude === undefined || row?.Longitude === null || row?.Longitude === undefined) {
    return null;
  }

  const latitude = Number(row.Latitude);
  const longitude = Number(row.Longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
};

const LocationDetailItem = ({ row }) => {
  const mapUrl = buildMapUrl(row);
  const label = buildLocationLabel(row);

  return (
    <div className="log-detail-item">
      <span className="log-detail-label">Location</span>
      <span className="log-detail-value">
        {label}
        {mapUrl && (
          <a className="log-location-link" href={mapUrl} target="_blank" rel="noreferrer">
            View map
          </a>
        )}
      </span>
    </div>
  );
};

const ResponseDetailsModal = ({ row, onClose }) => {
  if (!row) return null;
  const friendlyError = buildFriendlyError(row);

  return (
    <>
      <div className="log-modal-backdrop" onClick={onClose} />
      <div className="log-modal">
        <div className="log-modal-header">
          <div>
            <h2>Response Log Details</h2>
            <span>Id: {row.Id}</span>
          </div>
          <button className="log-icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="log-modal-content">
          <DetailItem label="response_id" value={row.response_id} />
          <DetailItem label="messageId" value={row.messageId} wide />
          <DetailItem label="instanceIdentifier" value={row.instanceIdentifier} />
          <DetailItem label="InvNumber" value={row.InvNumber} />
          <DetailItem label="senderParticipantID" value={row.senderParticipantID} />
          <DetailItem label="receiverParticipantID" value={row.receiverParticipantID} />
          <DetailItem label="documentTypeID" value={row.documentTypeID} wide />
          <DetailItem label="processID" value={row.processID} wide />
          <DetailItem label="transmissionType" value={row.transmissionType} />
          <DetailItem label="status" value={row.status} />
          <DetailItem label="serviceProviderId" value={row.serviceProviderId} />
          <DetailItem label="responseCreatedDate" value={formatDateTime(row.responseCreatedDate)} />
          <DetailItem label="User Friendly Message" value={friendlyError || row.responseMessage} wide />
          <DetailItem label="Raw responseMessage" value={row.responseMessage} wide />
          <DetailItem label="Raw errorDetails" value={row.errorDetails} wide />
          <DetailItem label="createdby" value={row.createdby} />
          <DetailItem label="createdAt" value={formatDateTime(row.createdAt)} />
        </div>
      </div>
    </>
  );
};

const AppLogDetailsModal = ({ row, appLoggerRows, loading, onClose }) => {
  if (!row) return null;

  return (
    <>
      <div className="log-modal-backdrop" onClick={onClose} />
      <div className="log-modal app-log-modal">
        <div className="log-modal-header">
          <div>
            <h2>App Log Details</h2>
            {/* <span>SessionId: {row.SessionId || ''}</span> */}
          </div>
          <button className="log-icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="log-modal-content">
          {/* <DetailItem label="LogID" value={row.LogID} />
          <DetailItem label="AgentId" value={row.AgentId} /> */}
          <DetailItem label="UserName" value={row.UserName} />
          <DetailItem label="LoginStatus" value={row.LoginStatus} />
          <DetailItem label="LoginDateTime" value={formatDateTime(row.LoginDateTime)} />
          <DetailItem label="LogoutDateTime" value={formatDateTime(row.LogoutDateTime)} />
          <DetailItem label="IPAddress" value={row.IPAddress} />
          <LocationDetailItem row={row} />
          <DetailItem label="FailureReason" value={row.FailureReason} wide />
          <DetailItem label="Browser" value={row.Browser} wide />
          {/* <DetailItem label="SessionId" value={row.SessionId} wide /> */}

          <div className="log-detail-item wide">
            <span className="log-detail-label">App Logger</span>
            <div className="nested-log-table-wrap">
              <table className="nested-log-table">
                <thead>
                  <tr>
                    <th>LogID</th>
                    <th>LogDateTime</th>
                    <th>Level</th>
                    <th>Message</th>
                    <th>Method</th>
                    <th>Url</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="log-empty">Loading app logs...</td>
                    </tr>
                  ) : appLoggerRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="log-empty">No app logger rows found for this session</td>
                    </tr>
                  ) : (
                    appLoggerRows.map((log) => (
                      <tr key={log.LogID}>
                        <td>{log.LogID}</td>
                        <td>{formatDateTime(log.LogDateTime)}</td>
                        <td>{log.Level}</td>
                        <td>{log.Message}</td>
                        <td>{log.Method}</td>
                        <td>{log.Url}</td>
                        <td>{getStatusText(log.StatusCode)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const LogFile = () => {
  const snackbar = useSnackbar();
  const [activeTab, setActiveTab] = useState('response');
  const [responseLogs, setResponseLogs] = useState([]);
  const [tokenLogs, setTokenLogs] = useState([]);
  const [appLogs, setAppLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState(null);
  const [selectedAppLog, setSelectedAppLog] = useState(null);
  const [appLoggerRows, setAppLoggerRows] = useState([]);
  const [appLoggerLoading, setAppLoggerLoading] = useState(false);

  const activeRows = useMemo(
    () => {
      if (activeTab === 'response') return responseLogs;
      if (activeTab === 'token') return tokenLogs;
      return appLogs;
    },
    [activeTab, responseLogs, tokenLogs, appLogs]
  );

  const fetchLogs = async (tab = activeTab) => {
    setLoading(true);
    try {
      const endpoint = tab === 'response' ? 'responses' : tab === 'token' ? 'tokens' : 'app';
      const response = await apiFetch(`${API_BASE_URL}/logs/${endpoint}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch logs');
      }

      if (tab === 'response') {
        setResponseLogs(Array.isArray(data.data) ? data.data : []);
      } else if (tab === 'token') {
        setTokenLogs(Array.isArray(data.data) ? data.data : []);
      } else {
        setAppLogs(Array.isArray(data.data) ? data.data : []);
      }
    } catch (error) {
      console.error('Log fetch error', error);
      snackbar.error(`Failed to load logs: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(activeTab);
  }, [activeTab]);

  const openAppLogDetails = async (row) => {
    setSelectedAppLog(row);
    setAppLoggerRows([]);

    if (!row.SessionId) return;

    setAppLoggerLoading(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/logs/app/${encodeURIComponent(row.SessionId)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch app logger rows');
      }

      setAppLoggerRows(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('App log detail fetch error', error);
      snackbar.error(`Failed to load app log details: ${error.message}`);
    } finally {
      setAppLoggerLoading(false);
    }
  };

  return (
    <div className="log-page">
      <div className="log-header">
        <h1>Log File</h1>
        <button className="log-refresh-btn" onClick={() => fetchLogs(activeTab)} disabled={loading}>
          <RefreshCw size={16} />
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="log-tabs">
        <button
          className={`log-tab ${activeTab === 'response' ? 'active' : ''}`}
          onClick={() => setActiveTab('response')}
        >
          Response
        </button>
        <button
          className={`log-tab ${activeTab === 'token' ? 'active' : ''}`}
          onClick={() => setActiveTab('token')}
        >
          Token
        </button>
        <button
          className={`log-tab ${activeTab === 'app' ? 'active' : ''}`}
          onClick={() => setActiveTab('app')}
        >
          AppLog
        </button>
      </div>

      <div className="log-table-card">
        <div className="log-table-wrap">
          <table className="log-table">
            {activeTab === 'response' ? (
              <>
                <thead>
                  <tr>
                    <th>Id</th>
                    <th>Inv Number</th>
                    <th>Transmission Type</th>
                    <th>Status</th>
                    <th>Created By</th>
                    <th>Created At</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="log-empty">No response logs found</td>
                    </tr>
                  ) : (
                    activeRows.map((row) => (
                      <tr key={row.Id}>
                        <td>{row.Id}</td>
                        <td>{row.InvNumber}</td>
                        <td>{row.transmissionType}</td>
                        <td><span className="log-status">{row.status}</span></td>
                        <td>{row.createdby}</td>
                        <td>{formatDateTime(row.createdAt)}</td>
                        <td className="text-right">
                          <button className="log-action-btn" onClick={() => setSelectedResponse(row)} title="View Details">
                            <Eye size={17} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </>
            ) : activeTab === 'token' ? (
              <>
                <thead>
                  <tr>
                    <th>Sl No</th>
                    <th>Expires At</th>
                    {/* <th>Expires In</th> */}
                    <th>Token Type</th>
                    <th>Created By</th>
                    <th>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="log-empty">No token logs found</td>
                    </tr>
                  ) : (
                    activeRows.map((row, index) => (
                      <tr key={row.Id}>
                        <td>{index + 1}</td>
                        <td>{getTokenExpiresAt(row)}</td>
                        {/* <td>{row.expires_in ?? ''}</td> */}
                        <td>{row.token_type}</td>
                        <td>{row.createdby}</td>
                        <td>{formatDateTime(row.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </>
            ) : (
              <>
                <thead>
                  <tr>
                    <th>Sl No</th>
                    <th>UserName</th>
                    <th>Login At</th>
                    <th>Login Status</th>
                    <th>Logout At</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="log-empty">No app logs found</td>
                    </tr>
                  ) : (
                    activeRows.map((row, index) => (
                      <tr key={row.LogID}>
                        <td>{index + 1}</td>
                        <td>{row.UserName}</td>
                        <td>{formatDateTime(row.LoginDateTime)}</td>
                        <td><span className="log-status">{row.LoginStatus}</span></td>
                        <td>{formatDateTime(row.LogoutDateTime)}</td>
                        <td className="text-right">
                          <button className="log-action-btn" onClick={() => openAppLogDetails(row)} title="View Details">
                            <Eye size={17} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </>
            )}
          </table>
        </div>
      </div>

      <ResponseDetailsModal row={selectedResponse} onClose={() => setSelectedResponse(null)} />
      <AppLogDetailsModal
        row={selectedAppLog}
        appLoggerRows={appLoggerRows}
        loading={appLoggerLoading}
        onClose={() => {
          setSelectedAppLog(null);
          setAppLoggerRows([]);
        }}
      />
    </div>
  );
};

export default LogFile;
