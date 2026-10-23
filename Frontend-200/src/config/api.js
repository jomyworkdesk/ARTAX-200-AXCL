import { API_BASE_ROOT } from '../services/apiService';

export const apiUrl = (path) => `${API_BASE_ROOT}${path.startsWith('/') ? path : `/${path}`}`;
