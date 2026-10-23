import { getSessionItem } from './sessionStorageService';

const trimTrailingSlashes = (value) => String(value || '').replace(/\/+$/, '');

export const API_BASE_ROOT = trimTrailingSlashes(
  import.meta.env.VITE_API_URL
);

export const API_BASE_URL = `${API_BASE_ROOT}/api`;

export const getAuthHeaders = () => {
  const token = getSessionItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const apiFetch = (url, options = {}) => {
  const includeAuth = options.auth !== false;
  const { auth, ...fetchOptions } = options;

  return fetch(url, {
    ...fetchOptions,
    headers: {
      ...(includeAuth ? getAuthHeaders() : {}),
      ...(fetchOptions.headers || {})
    }
  });
};

export const validateSendConfiguration = async () => {
  const response = await apiFetch(`${API_BASE_URL}/configure/send-validation`);
  const data = await response.json().catch(() => ({}));
  const validation = data.data || data;

  if (!response.ok || validation.canSend === false) {
    const error = new Error(validation.message || data.message || 'Sending is not allowed');
    error.isSendValidationError = true;
    throw error;
  }

  return validation;
};
