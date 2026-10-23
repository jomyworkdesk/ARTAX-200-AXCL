import { API_BASE_URL, getAuthHeaders } from './apiService';
import { clearSessionItems, getSessionItem } from './sessionStorageService';

const getLogoutPayload = () => {
  const sessionId = getSessionItem('SessionId');
  const agentId = getSessionItem('AgentId');
  const databaseName = getSessionItem('DatabaseName');

  return {
    ...(sessionId ? { SessionId: sessionId } : {}),
    ...(agentId ? { AgentId: agentId } : {}),
    ...(databaseName ? { DatabaseName: databaseName } : {})
  };
};

export const clearSessionStorage = () => {
  clearSessionItems();
};

export const logoutSession = async ({ keepalive = false } = {}) => {
  const payload = getLogoutPayload();

  if (!payload.SessionId) {
    clearSessionStorage();
    return;
  }

  try {
    await fetch(`${API_BASE_URL}/login-log/logout`, {
      method: 'PUT',
      keepalive,
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });
  } finally {
    clearSessionStorage();
  }
};

export const logoutSessionOnClose = () => {
  const payload = getLogoutPayload();

  if (!payload.SessionId) {
    clearSessionStorage();
    return;
  }

  const body = JSON.stringify(payload);
  const sent = navigator.sendBeacon?.(`${API_BASE_URL}/login-log/logout`, body);

  if (!sent) {
    fetch(`${API_BASE_URL}/login-log/logout`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8'
      },
      body
    }).catch(() => {
      // The page is closing, so there is no reliable place to surface failures.
    });
  }

  clearSessionStorage();
};
