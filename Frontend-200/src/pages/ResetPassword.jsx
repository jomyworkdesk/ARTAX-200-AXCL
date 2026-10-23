import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, RefreshCw, UserCheck, ShieldCheck, X } from 'lucide-react';
import { useSnackbar } from '../components/Snackbar';
import { API_BASE_URL, apiFetch } from '../services/apiService';
import '../Styles/Login.css';

const ResetPassword = () => {
  const navigate = useNavigate();
  const snackbar = useSnackbar();

  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isIdentityVerified, setIsIdentityVerified] = useState(false);
  const [toast, setToast] = useState(null);

  const isLengthValid = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const passwordsMatch = newPassword !== '' && newPassword === confirmNewPassword;
  const canSubmitPassword =
    isIdentityVerified &&
    isLengthValid &&
    hasUpperCase &&
    hasNumber &&
    passwordsMatch;

  useEffect(() => {
    if (toast?.type !== 'success') {
      return undefined;
    }

    const timer = setTimeout(() => {
      setToast(null);
    }, 3000);

    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    setIsIdentityVerified(false);
    setNewPassword('');
    setConfirmNewPassword('');
  }, [username, firstName, displayName]);

  const showToast = (type, message) => {
    setToast({ type, message });
  };

  const handleVerifyDetails = async () => {
    setToast(null);

    if (!username.trim() || !firstName.trim() || !displayName.trim()) {
      showToast('error', 'Enter username, first name and display name to continue');
      return;
    }

    setIsVerifying(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/validate-reset-details`, {
        method: 'POST',
        auth: false,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          UserName: username,
          FirstName: firstName,
          DisplayName: displayName
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to verify details');
      }

      setIsIdentityVerified(true);
      showToast('success', 'Details verified. You can now set a new password.');
    } catch (verifyError) {
      setIsIdentityVerified(false);
      showToast('error', verifyError.message || 'Unable to verify details');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setToast(null);

    if (!isIdentityVerified) {
      snackbar.error('Validation failed');
      return;
    }

    if (!isLengthValid || !hasUpperCase || !hasNumber) {
      showToast('error', 'Password does not meet all security requirements');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showToast('error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/reset-password`, {
        method: 'POST',
        auth: false,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          UserName: username,
          FirstName: firstName,
          DisplayName: displayName,
          Password: newPassword
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to reset password');
      }

      showToast('success', 'Password updated successfully. Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (resetError) {
      showToast('error', resetError.message || 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-branding-panel">
        <div className="branding-content">
          <h1 className="branding-title">Security Center</h1>
          <p className="branding-description">
            Securely maintain your access to the ARTAX system. Update your credentials regularly to ensure the safety of your data.
          </p>
        </div>

        <div
          className="login-branding-footer"
          style={{
            position: 'absolute',
            bottom: '32px',
            zIndex: 3,
            opacity: 0.8,
            fontSize: '0.9rem'
          }}
        >
          <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
            QUALITY • PASSION • INTEGRITY AT WORK
          </span>
        </div>

        <div className="branding-bg-overlay"></div>
      </div>

      <div className="login-form-panel" style={{ padding: '20px 40px' }}>
        <div className="login-form-wrapper">
          <div className="login-header">
            <img src="/logo1.png" alt="ARTAX" className="login-logo" />
            <h2 className="login-title">Reset Password</h2>
          </div>

          <form className="login-form" onSubmit={handleResetPassword} style={{ gap: '16px' }}>
            {toast && (
              <div className={`toast-message ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
                <span>{toast.message}</span>
                <button type="button" className="toast-close-btn" onClick={() => setToast(null)} aria-label="Close toast">
                  <X size={16} />
                </button>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="username">Username</label>
              <div className="input-with-icon">
                <UserCheck size={18} className="input-icon" />
                <input
                  type="text"
                  id="username"
                  placeholder="Agent Name"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
                marginTop: '4px'
              }}
            >
              <div className="form-group">
                <label htmlFor="firstName">First Name</label>
                <div className="input-with-icon">
                  <UserCheck size={18} className="input-icon" />
                  <input
                    type="text"
                    id="firstName"
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="displayName">Display Name</label>
                <div className="input-with-icon">
                  <UserCheck size={18} className="input-icon" />
                  <input
                    type="text"
                    id="displayName"
                    placeholder="Display Name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>
            </div>

            {!isIdentityVerified && (
              <button
                type="button"
                className={`login-btn ${isVerifying ? 'loading' : ''}`}
                disabled={isVerifying || isLoading}
                onClick={handleVerifyDetails}
                style={{ marginTop: '4px' }}
              >
                {isVerifying ? (
                  <span className="spinner"></span>
                ) : (
                  <>
                    <span>Verify Details</span>
                    <UserCheck size={18} />
                  </>
                )}
              </button>
            )}

            {isIdentityVerified && (
              <>
                <div className="form-group" style={{ marginTop: '8px' }}>
                  <label htmlFor="newPassword">New Password</label>
                  <div className="input-with-icon">
                    <Lock size={18} className="input-icon" />
                    <input
                      type="password"
                      id="newPassword"
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isLoading}
                      required
                    />
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '6px 12px',
                      marginTop: '8px',
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: isLengthValid ? '#22c55e' : 'inherit'
                      }}
                    >
                      <ShieldCheck size={14} /> At least 8 characters
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: hasNumber ? '#22c55e' : 'inherit'
                      }}
                    >
                      <ShieldCheck size={14} /> At least one number
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        color: hasUpperCase ? '#22c55e' : 'inherit'
                      }}
                    >
                      <ShieldCheck size={14} /> At least one uppercase letter
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="confirmNewPassword">Confirm New Password</label>
                  <div className="input-with-icon">
                    <Lock size={18} className="input-icon" />
                    <input
                      type="password"
                      id="confirmNewPassword"
                      placeholder="Confirm new password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      style={{
                        borderColor:
                          confirmNewPassword && newPassword !== confirmNewPassword
                            ? '#ef4444'
                            : undefined
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className={`login-btn ${isLoading ? 'loading' : ''}`}
                  disabled={isLoading || !canSubmitPassword}
                  style={{ marginTop: '8px' }}
                >
                  {isLoading ? (
                    <span className="spinner"></span>
                  ) : (
                    <>
                      <span>Change Password</span>
                      <RefreshCw size={18} />
                    </>
                  )}
                </button>
              </>
            )}
          </form>

          <div className="login-footer">
            <p>
              Remember your password? <Link to="/login">Back to Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
