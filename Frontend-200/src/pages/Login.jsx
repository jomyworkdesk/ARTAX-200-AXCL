import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Lock, ArrowRight, X } from 'lucide-react';
import Select from 'react-select';
import { API_BASE_URL, apiFetch } from '../services/apiService';
import { clearSessionItems, setSessionItem } from '../services/sessionStorageService';
import '../Styles/Login.css';

const getLoginErrorMessage = (data) => {
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors[0];
  }

  return data?.message || 'Login failed';
};

const Login = () => {
  const navigate = useNavigate();
  const [databases, setDatabases] = useState([]);
  const [selectedDatabase, setSelectedDatabase] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingDatabases, setIsFetchingDatabases] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (type, message) => {
    setToast({ type, message });
    if (type === 'success') {
      setTimeout(() => setToast(null), 3000);
    }
  };

  useEffect(() => {
    const fetchDatabases = async () => {
      setIsFetchingDatabases(true);
      try {
        const response = await apiFetch(`${API_BASE_URL}/databases`, { auth: false });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to fetch databases');
        }

        setDatabases((data.data || [])
          .map((database) => database.DatabaseName || database.name)
          .filter(Boolean)
          .map((databaseName) => ({
            value: databaseName,
            label: databaseName
          })));
      } catch (fetchError) {
        showToast('error', fetchError.message || 'Failed to load database list');
      } finally {
        setIsFetchingDatabases(false);
      }
    };

    fetchDatabases();
  }, []);

  const getCurrentPosition = () =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 300000
      });
    });

  const getLocationMetadata = async () => {
    const metadata = {
      Browser: navigator.userAgent || null,
      Country: null,
      City: null,
      Latitude: null,
      Longitude: null
    };

    try {
      const geoResponse = await fetch('https://ipwho.is/');
      const geoData = await geoResponse.json();

      if (geoResponse.ok && geoData?.success !== false) {
        metadata.Country = geoData.country || null;
        metadata.City = geoData.city || null;
        metadata.Latitude = typeof geoData.latitude === 'number' ? geoData.latitude : null;
        metadata.Longitude = typeof geoData.longitude === 'number' ? geoData.longitude : null;
      }
    } catch (error) {
      // Fall back to browser geolocation when IP lookup is unavailable.
    }

    if (metadata.Latitude === null || metadata.Longitude === null) {
      try {
        const position = await getCurrentPosition();
        metadata.Latitude = position.coords.latitude;
        metadata.Longitude = position.coords.longitude;
      } catch (error) {
        // Login should continue even if location permission is denied.
      }
    }

    return metadata;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setToast(null);

    if (!selectedDatabase) {
      showToast('error', 'Please select a database');
      return;
    }

    setIsLoading(true);

    try {
      const locationMetadata = await getLocationMetadata();
      const response = await apiFetch(`${API_BASE_URL}/login`, {
        method: "POST",
        auth: false,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          DatabaseName: selectedDatabase.value,
          UserName: username,
          Password: password,
          ...locationMetadata
        })
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        clearSessionItems();

        if (data.data?.LoginType === 'ArtaxPortal') {
          const portalName = String(data.data.Name || data.data.name || data.data.UserName || username).trim();
          setSessionItem("ArtaxPortalToken", data.data.token);
          setSessionItem("ArtaxPortalSessionId", data.data.SessionId);
          setSessionItem("ArtaxPortalUserName", data.data.UserName || username);
          setSessionItem("ArtaxPortalName", portalName);
          setSessionItem("ArtaxPortalClientCode", data.data.ClientCode);
          showToast('success', data.message || 'Artax Portal login successful');
          setTimeout(() => navigate('/artax-portal'), 1000);
          return;
        }

        setSessionItem("token", data.data.token);
        setSessionItem("SessionId", data.data.SessionId);
        setSessionItem("UserName", data.data.UserName || username);
        setSessionItem("DatabaseName", data.data.DatabaseName || selectedDatabase.value);
        setSessionItem("RoleId", data.data.RoleId);
        setSessionItem("AgentId", data.data.AgentId);
        showToast('success', data.message || 'Login successful');
        setTimeout(() => navigate('/'), 1000);
      } else {
        showToast('error', getLoginErrorMessage(data));
      }
    } catch (error) {
      console.error(error);
      showToast('error', "Error connecting to server");
    } finally {
      setIsLoading(false);
    }
  };

  const customSelectStyles = {
    control: (provided, state) => ({
      ...provided,
      padding: '4px',
      borderRadius: 'var(--radius-md)',
      borderColor: state.isFocused ? 'var(--primary)' : 'var(--border-color)',
      boxShadow: state.isFocused ? '0 0 0 3px rgba(37, 99, 235, 0.1)' : 'none',
      backgroundColor: 'var(--bg-main)',
      color: 'var(--text-primary)',
      fontSize: '1rem',
      transition: 'all 0.2s ease',
    }),
    singleValue: (provided) => ({
      ...provided,
      color: 'var(--text-primary)',
    }),
    input: (provided) => ({
      ...provided,
      color: 'var(--text-primary)',
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid var(--border-color)',
      zIndex: 10,
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isFocused ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-surface)',
      color: state.isFocused ? 'var(--primary)' : 'var(--text-primary)',
      cursor: 'pointer',
      padding: '10px 16px',
    }),
    placeholder: (provided) => ({
      ...provided,
      color: 'var(--text-muted)',
    })
  };

  return (
    <div className="login-container">
      {/* Left Branding Panel */}
      <div className="login-branding-panel">
        <div className="branding-content">
          {/* <div className="brand-logo-large">
            <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff' }}>S<span style={{ color: '#22c55e' }}>C</span></span>
          </div> */}
          <h1 className="branding-title">ARTAX-200</h1>
          <p className="branding-description">
            Your premium E-Invoicing Connector bridging Sage, and global compliance standards seamlessly.
          </p>
          <div className="branding-stats flex-row gap-6">
            <div className="stat-item">
              <span className="stat-val">99.9%</span>
              <span className="stat-lbl">Uptime</span>
            </div>
            <div className="stat-item">
              <span className="stat-val">100%</span>
              <span className="stat-lbl">Invoices Processed</span>
            </div>
          </div>

          <div className="branding-partners" style={{ marginTop: '48px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '24px' }}>
            <p style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '12px' }}>PROUD PARTNER INTEGRATIONS</p>
            <div className="flex-row gap-4 items-center">
              <span style={{ fontWeight: 600, color: '#22c55e', backgroundColor: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '4px' }}>Sage Gold Partner</span>
              <span style={{ fontWeight: 600, color: '#60a5fa', backgroundColor: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '4px' }}>Zoho Finance Premium</span>
            </div>
          </div>
        </div>

        <div className="login-branding-footer" style={{ position: 'absolute', bottom: '32px', zIndex: 3, opacity: 0.8, fontSize: '0.9rem' }}>
          <a href="https://alroman.com/" target="_blank" rel="noreferrer" style={{ color: 'white', fontWeight: 700, textDecoration: 'underline' }}>Al Roman Technologies LLC</a>
          <br />
          <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>QUALITY • PASSION • INTEGRITY AT WORK</span>
        </div>

        <div className="branding-bg-overlay"></div>
      </div>

      {/* Right Login Panel */}
      <div className="login-form-panel">
        <div className="login-form-wrapper">
          <div className="login-header">
            <img src="/logo1.png" alt="ARTAX" className="login-logo" />

            <h2 className="login-title">Sign In</h2>
            <p className="login-subtitle">Access your ARTAX-200 dashboard</p>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            {toast && (
              <div className={`toast-message ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
                <span>{toast.message}</span>
                <button type="button" className="toast-close-btn" onClick={() => setToast(null)} aria-label="Close toast">
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="database">Database</label>
              <Select
                id="database"
                options={databases}
                value={selectedDatabase}
                onChange={setSelectedDatabase}
                placeholder="Select database..."
                styles={customSelectStyles}
                isSearchable
                isLoading={isFetchingDatabases}
              />
            </div>

            <div className="form-group">
              <label htmlFor="username">Username</label>
              <div className="input-with-icon">
                <User size={18} className="input-icon" />
                <input
                  type="text"
                  id="username"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <div className="flex-row justify-between">
                <label htmlFor="password">Password</label>
                {/* <Link to="/reset-password" className="reset-password">Reset password?</Link> */}
              </div>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input
                  type="password"
                  id="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* <div className="form-options">
              <label className="checkbox-container">
                <input type="checkbox" />
                <span className="checkmark"></span>
                Remember me
              </label>
            </div> */}

            <button
              type="submit"
              className={`login-btn ${isLoading ? 'loading' : ''}`}
              disabled={isLoading || !selectedDatabase}
            >
              {isLoading ? (
                <span className="spinner"></span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* <div className="login-footer">
            <p>Don't have an account? <Link to="/signup">Sign up</Link></p>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default Login;
