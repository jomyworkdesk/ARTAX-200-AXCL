import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, UserPlus, ShieldCheck, X } from 'lucide-react';
import Select from 'react-select';
import { API_BASE_URL, apiFetch } from '../services/apiService';
import '../Styles/Login.css';

const Signup = () => {
  const navigate = useNavigate();
  const [databases, setDatabases] = useState([]);
  const [selectedDatabase, setSelectedDatabase] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingDatabases, setIsFetchingDatabases] = useState(false);
  const [isFetchingUsers, setIsFetchingUsers] = useState(false);
  const [toast, setToast] = useState(null);

  // Password validation logic
  const isLengthValid = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  useEffect(() => {
    if (toast?.type !== 'success') {
      return undefined;
    }

    const timer = setTimeout(() => {
      setToast(null);
    }, 3000);

    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (type, message) => {
    setToast({ type, message });
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

        setDatabases((data.data || []).map((database) => ({
          value: database.name,
          label: database.name
        })));
      } catch (fetchError) {
        showToast('error', fetchError.message || 'Failed to load database list');
      } finally {
        setIsFetchingDatabases(false);
      }
    };

    fetchDatabases();
  }, []);

  useEffect(() => {
    if (!selectedDatabase) {
      setUsers([]);
      setSelectedUser(null);
      return;
    }

    const fetchAgents = async () => {
      setIsFetchingUsers(true);
      setSelectedUser(null);
      try {
        const response = await apiFetch(
          `${API_BASE_URL}/agents?DatabaseName=${encodeURIComponent(selectedDatabase.value)}`,
          { auth: false }
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Failed to fetch agents');
        }

        const formattedUsers = (data.data || []).map((agent) => ({
          value: agent.idAgents,
          label: agent.UserName
        }));

        setUsers(formattedUsers);
      } catch (fetchError) {
        showToast('error', fetchError.message || 'Failed to load agents list');
      } finally {
        setIsFetchingUsers(false);
      }
    };

    fetchAgents();
  }, [selectedDatabase]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setToast(null);

    if (!selectedDatabase) {
      showToast('error', 'Please select a database');
      return;
    }
    if (!selectedUser) {
      showToast('error', 'Please select a username');
      return;
    }
    if (!isLengthValid || !hasUpperCase || !hasNumber) {
      showToast('error', 'Password does not meet all security requirements');
      return;
    }
    if (password !== confirmPassword) {
      showToast('error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        auth: false,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          DatabaseName: selectedDatabase.value,
          AgentId: selectedUser.value,
          UserName: selectedUser.label,
          Password: password
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to create signup');
      }

      showToast('success', 'Account created successfully');
      setTimeout(() => navigate('/login'), 3000);
    } catch (signupError) {
      showToast('error', signupError.message || 'Unable to create account');
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
      {/* Branding Panel */}
      <div className="login-branding-panel">
        <div className="branding-content">
          {/* <div className="brand-logo-large">
            <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff' }}>S<span style={{color: '#22c55e'}}>C</span></span>
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

      {/* Form Panel */}
      <div className="login-form-panel">
        <div className="login-form-wrapper">
          <div className="login-header">
            <img src="/logo1.png" alt="ARTAX" className="login-logo" />

            <h2 className="login-title">Create Account</h2>
            <p className="login-subtitle">Set up your credentials to begin</p>
          </div>

          <form className="login-form" onSubmit={handleSignup}>
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
              <div className="label-with-action">
                <label htmlFor="username">Select Username</label>
                <span className="reset-notice">Username not found, Reset required...</span>
              </div>
              <Select
                id="username"
                options={users}
                value={selectedUser}
                onChange={setSelectedUser}
                placeholder="Search username..."
                styles={customSelectStyles}
                isSearchable
                isLoading={isFetchingUsers}
                isDisabled={!selectedDatabase}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Create Password</label>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: isLengthValid ? '#22c55e' : 'inherit' }}>
                  <ShieldCheck size={16} /> At least 8 characters
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasUpperCase ? '#22c55e' : 'inherit' }}>
                  <ShieldCheck size={16} /> At least one uppercase letter
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: hasNumber ? '#22c55e' : 'inherit' }}>
                  <ShieldCheck size={16} /> At least one number
                </div>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '8px' }}>
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input
                  type="password"
                  id="confirmPassword"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={{ borderColor: confirmPassword && password !== confirmPassword ? '#ef4444' : undefined }}
                />
              </div>
            </div>

            <button
              type="submit"
              className={`login-btn ${isLoading ? 'loading' : ''}`}
              disabled={isLoading || !selectedDatabase}
              style={{ marginTop: '16px' }}
            >
              {isLoading ? (
                <span className="spinner"></span>
              ) : (
                <>
                  <span>Create Account</span>
                  <UserPlus size={18} />
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p>Already have an account? <Link to="/login">Sign in here</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Signup;
