import { useEffect, useState, useRef } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { Database, User, Sun, Moon, LogOut, Settings as SettingsIcon, Menu, X } from 'lucide-react';
import { logoutSession } from '../../services/sessionService';
import { API_BASE_URL, apiFetch } from '../../services/apiService';
import { getSessionItem } from '../../services/sessionStorageService';
import './Header.css';

const MAIN_NAV_ITEMS = [
  { route: '/', label: 'Overview', end: true },
  { route: '/invoices', label: 'Invoices' },
  { route: '/creditnote', label: 'CreditNote' },
  { route: '/purchase', label: 'Purchase' },
  { route: '/ap-creditnote', label: 'Purchase Return' },
  { route: '/issues/errors', label: 'Issues', matchPrefix: '/issues', legacyRoutes: ['/errors', '/failed'] },
  { route: '/configure/master', label: 'Configure', matchPrefix: '/configure' },
  { route: '/logs', label: 'Log File' }
];

const ISSUES_NAV_ITEMS = [
  { route: '/issues/errors', label: 'Errors', legacyRoutes: ['/errors'] },
  { route: '/issues/failed', label: 'Failed', legacyRoutes: ['/failed'] }
];

const CONFIGURE_NAV_ITEMS = [
  { route: '/configure/master', label: 'Master' },
  { route: '/configure/seller', label: 'Seller' },
  { route: '/configure/buyer', label: 'Buyer' }
];

const Header = () => {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userName, setUserName] = useState(() => getSessionItem('UserName') || 'User');
  const [databaseName, setDatabaseName] = useState(() => getSessionItem('DatabaseName') || '');
  const [accessiblePages, setAccessiblePages] = useState([]);
  const dropdownRef = useRef(null);
  const mobileNavRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isConfigureRoute = location.pathname.startsWith('/configure');
  const isIssuesRoute = location.pathname.startsWith('/issues') || ['/errors', '/failed'].includes(location.pathname);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }

      if (mobileNavRef.current && !mobileNavRef.current.contains(event.target)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const syncSessionDetails = () => {
      setUserName(getSessionItem('UserName') || 'User');
      setDatabaseName(getSessionItem('DatabaseName') || '');
    };

    window.addEventListener('storage', syncSessionDetails);
    window.addEventListener('focus', syncSessionDetails);

    return () => {
      window.removeEventListener('storage', syncSessionDetails);
      window.removeEventListener('focus', syncSessionDetails);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadAccessiblePages = async () => {
      try {
        const response = await apiFetch(`${API_BASE_URL}/pages/access`);
        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.message || 'Unable to load page access');
        }

        if (isMounted) {
          setAccessiblePages(Array.isArray(payload.data) ? payload.data : []);
        }
      } catch (error) {
        console.error('Page access load error:', error);
        if (isMounted) {
          setAccessiblePages([]);
        }
      }
    };

    loadAccessiblePages();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  const accessibleRoutes = new Set(
    accessiblePages
      .map((page) => page.Route)
      .filter(Boolean)
  );

  const routeCandidates = (item) => [item.route, ...(item.legacyRoutes || [])].filter(Boolean);

  const canAccessNavItem = (item) => {
    if (routeCandidates(item).some((route) => accessibleRoutes.has(route))) {
      return true;
    }

    return item.matchPrefix
      ? [...accessibleRoutes].some((route) => route.startsWith(item.matchPrefix))
      : false;
  };

  const isActiveNavItem = (item, isActive) => {
    if (item.matchPrefix && location.pathname.startsWith(item.matchPrefix)) {
      return true;
    }

    if (item.legacyRoutes?.includes(location.pathname)) {
      return true;
    }

    return isActive;
  };

  const visibleIssuesNavItems = ISSUES_NAV_ITEMS.filter(canAccessNavItem);
  const visibleConfigureNavItems = CONFIGURE_NAV_ITEMS.filter(canAccessNavItem);
  const visibleMainNavItems = MAIN_NAV_ITEMS
    .filter(canAccessNavItem)
    .map((item) => (
      item.label === 'Issues' && visibleIssuesNavItems.length > 0
        ? { ...item, route: visibleIssuesNavItems[0].route }
        : item
    ));
  const canAccessSettings = accessibleRoutes.has('/settings');

  const handleLogout = async () => {
    try {
      await logoutSession();
    } catch (error) {
      console.error("Logout error:", error);
    }
    navigate('/login');
  };

  return (
    <header className="header">
      <div className="header-container">
        <div className="mobile-menu-wrapper" ref={mobileNavRef}>
          <button
            className="mobile-menu-btn"
            onClick={() => setIsMobileMenuOpen(prev => !prev)}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileMenuOpen}
            type="button"
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <nav className={`mobile-nav-links ${isMobileMenuOpen ? 'open' : ''}`}>
            {visibleMainNavItems.map((item) => (
              <NavLink
                key={item.route}
                to={item.route}
                end={item.end}
                className={({ isActive }) => {
                  const active = isActiveNavItem(item, isActive);
                  return active ? 'mobile-nav-link active' : 'mobile-nav-link';
                }}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Logo and Brand */}
        <Link to="/" className="brand">
          <img src="/logo1.png" alt="ART Gateway" className="brand-logo" />
        </Link>

        {/* Navigation Routes */}
        <nav className="nav-links">
          {visibleMainNavItems.map((item) => (
            <NavLink
              key={item.route}
              to={item.route}
              end={item.end}
              className={({ isActive }) => {
                const active = isActiveNavItem(item, isActive);
                return active ? 'nav-link active' : 'nav-link';
              }}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Actions & Profile */}
        <div className="header-actions">
          {databaseName && (
            <div className="database-badge" title={`Selected database: ${databaseName}`}>
              <Database size={16} />
              <span>{databaseName}</span>
            </div>
          )}

          <button className="theme-toggle-btn" onClick={toggleTheme} aria-label="Toggle Theme">
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div className="profile-section-wrapper" ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              className="profile-section"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              aria-label="Open user menu"
              aria-expanded={isProfileOpen}
              type="button"
            >
              <div className="profile-avatar">
                <User size={18} className="profile-icon" />
              </div>
              <span className="profile-initials">{userName}</span>
            </button>

            {isProfileOpen && (
              <div className="profile-dropdown">
                <div className="profile-dropdown-header">
                  <span className="profile-name">{userName}</span>
                  {databaseName && <span className="profile-database">Database: {databaseName}</span>}
                </div>
                <div className="profile-dropdown-divider"></div>
                {canAccessSettings && (
                  <Link to="/settings" className="profile-dropdown-item" onClick={() => setIsProfileOpen(false)}>
                    <SettingsIcon size={16} />
                    <span>Account Settings</span>
                  </Link>
                )}
                <button className="profile-dropdown-item mobile-theme-item" onClick={toggleTheme}>
                  {isDark ? <Sun size={16} /> : <Moon size={16} />}
                  <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                </button>
                <div className="profile-dropdown-divider"></div>
                <button className="profile-dropdown-item logout-btn" onClick={handleLogout}>
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {isConfigureRoute && visibleConfigureNavItems.length > 0 && (
        <div className="sub-navbar">
          <div className="sub-navbar-container">
            {visibleConfigureNavItems.map((item) => (
              <NavLink key={item.route} to={item.route} className={({ isActive }) => (isActive ? 'sub-nav-link active' : 'sub-nav-link')}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {isIssuesRoute && visibleIssuesNavItems.length > 0 && (
        <div className="sub-navbar">
          <div className="sub-navbar-container">
            {visibleIssuesNavItems.map((item) => (
              <NavLink
                key={item.route}
                to={item.route}
                className={({ isActive }) => (isActiveNavItem(item, isActive) ? 'sub-nav-link active' : 'sub-nav-link')}
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
