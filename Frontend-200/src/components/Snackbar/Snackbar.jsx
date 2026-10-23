import React, { useEffect } from 'react';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';
import './Snackbar.css';

const Snackbar = ({ id, type, message, onClose, autoCloseDuration = 4000 }) => {
  useEffect(() => {
    if (autoCloseDuration) {
      const timer = setTimeout(onClose, autoCloseDuration);
      return () => clearTimeout(timer);
    }
  }, [autoCloseDuration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={20} className="snackbar-icon" />;
      case 'error':
        return <AlertCircle size={20} className="snackbar-icon" />;
      case 'info':
        return <Info size={20} className="snackbar-icon" />;
      default:
        return null;
    }
  };

  return (
    <div className={`snackbar snackbar-${type}`}>
      <div className="snackbar-content">
        {getIcon()}
        <span className="snackbar-message">{message}</span>
      </div>
      <button
        className="snackbar-close"
        onClick={onClose}
        aria-label="Close notification"
      >
        <X size={18} />
      </button>
    </div>
  );
};

export default Snackbar;
