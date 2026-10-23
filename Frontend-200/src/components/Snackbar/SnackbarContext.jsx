import React, { createContext, useState, useCallback } from 'react';
import Snackbar from './Snackbar';

export const SnackbarContext = createContext();

export const SnackbarProvider = ({ children }) => {
  const [snackbars, setSnackbars] = useState([]);

  const showSnackbar = useCallback((type, message, duration = 4000) => {
    const id = Date.now() + Math.random();
    
    setSnackbars((prev) => [...prev, { id, type, message, duration }]);

    // Auto remove after duration
    if (duration) {
      setTimeout(() => {
        removeSnackbar(id);
      }, duration);
    }

    return id;
  }, []);

  const removeSnackbar = useCallback((id) => {
    setSnackbars((prev) => prev.filter((snackbar) => snackbar.id !== id));
  }, []);

  const value = {
    showSnackbar,
    removeSnackbar,
    success: (message, duration) => showSnackbar('success', message, duration),
    error: (message, duration) => showSnackbar('error', message, duration),
    info: (message, duration) => showSnackbar('info', message, duration),
    warning: (message, duration) => showSnackbar('warning', message, duration),
  };

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <div className="snackbar-container">
        {snackbars.map((snackbar) => (
          <Snackbar
            key={snackbar.id}
            id={snackbar.id}
            type={snackbar.type}
            message={snackbar.message}
            autoCloseDuration={snackbar.duration}
            onClose={() => removeSnackbar(snackbar.id)}
          />
        ))}
      </div>
    </SnackbarContext.Provider>
  );
};
