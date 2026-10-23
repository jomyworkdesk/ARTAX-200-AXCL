import { Navigate, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { clearSessionItems, getSessionItem } from '../services/sessionStorageService';
import '../Styles/ArtaxPortal.css';

const ArtaxPortal = () => {
  const navigate = useNavigate();
  const token = getSessionItem('ArtaxPortalToken');
  const displayName = getSessionItem('ArtaxPortalName');
  const userName = getSessionItem('ArtaxPortalUserName');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const handleSignOut = () => {
    clearSessionItems();
    navigate('/login', { replace: true });
  };

  return (
    <div className="artax-portal-page">
      <header className="artax-portal-header">
        <div className="artax-portal-brand">
          <img src="/logo1.png" alt="ARTAX" className="artax-portal-logo" />
          <div>
            <p className="artax-portal-kicker">Welcome,</p>
            <h1>{displayName || userName || 'Artax Portal'}</h1>
          </div>
        </div>
        <button type="button" className="artax-portal-signout" onClick={handleSignOut} title="Sign out">
          <LogOut size={18} />
          <span>Sign out</span>
        </button>
      </header>

      <main className="artax-portal-main">
        <section className="artax-portal-panel">
          <p className="artax-portal-kicker">Artax Portal</p>
          <h2>Cloud access is active</h2>
        </section>
      </main>
    </div>
  );
};

export default ArtaxPortal;
