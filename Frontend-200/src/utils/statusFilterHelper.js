/**
 * Status Filter Helper Utilities
 * Provides consistent status filtering and label mapping across all pages
 */

// Status Constants
export const STATUS_CODES = {
  PENDING: 1,
  SENT: 2,
  SUCCESS: 3,
  FAILED: 4
};

// Status values to filter by (excluding SENT)
export const FILTERABLE_STATUSES = [
  STATUS_CODES.PENDING,
  STATUS_CODES.SUCCESS,
  STATUS_CODES.FAILED
];

// Status label mapping
export const STATUS_LABELS = {
  1: 'Pending',
  2: 'Sent',
  3: 'Success',
  4: 'Failed',
  'Pending': 'Pending',
  'Sent': 'Sent',
  'Success': 'Success',
  'Failed': 'Failed',
  'Received': 'Success',
  'Error': 'Failed'
};

// Reverse mapping for API (tab name to status code)
export const TAB_TO_STATUS_CODE = {
  'All': 'all',
  'Pending': 1,
  'Success': 3,
  'Failed': 4
};

/**
 * Convert numeric status to display label
 * @param {number|string} status - Status code (1, 2, 3, 4) or label
 * @returns {string} Display label (Pending, Sent, Success, Failed)
 */
export const getStatusLabel = (status) => {
  if (status === 1 || status === '1') return 'Pending';
  if (status === 2 || status === '2') return 'Sent';
  if (status === 3 || status === '3') return 'Success';
  if (status === 4 || status === '4') return 'Failed';
  
  // Handle existing labels
  if (STATUS_LABELS[status]) return STATUS_LABELS[status];
  
  return status || 'Pending';
};

/**
 * Get the CSS badge class for a status
 * @param {number|string} status - Status code or label
 * @returns {string} Badge type (success, warning, error, neutral)
 */
export const getStatusBadgeClass = (status) => {
  const normalizedStatus = getStatusLabel(status);
  const badgeMap = {
    'Delivered': 'success',
    'Sent': 'warning',
    'Pending': 'neutral',
    'Success': 'success',
    'Failed': 'error',
    'Processing': 'warning'
  };
  return badgeMap[normalizedStatus] || 'neutral';
};

/**
 * Filter data array by status (client-side filtering)
 * @param {Array} data - Array of data items
 * @param {number|string} filterStatus - Status to filter by ('all' or status code)
 * @param {string} statusKey - Key name for status field in data items (default: 'Status')
 * @returns {Array} Filtered data
 */
export const filterDataByStatus = (data, filterStatus, statusKey = 'Status') => {
  if (!Array.isArray(data)) return [];
  
  // 'all' or undefined means show all data
  if (filterStatus === 'all' || filterStatus === 'All' || !filterStatus) {
    return data;
  }
  
  // Filter by specific status code
  return data.filter(item => {
    const itemStatus = item[statusKey];
    return Number(itemStatus) === Number(filterStatus);
  });
};

/**
 * Get status tabs configuration
 * @param {Object} counts - Object with status counts (e.g., {pending: 5, success: 10, failed: 2})
 * @returns {Array} Array of tab objects with id, label, count
 */
export const getStatusTabs = (counts = {}) => {
  return [
    { id: 'All', label: 'All', count: counts.total || 0 },
    { id: 'Pending', label: 'Pending', count: counts.pending || 0 },
    { id: 'Success', label: 'Success', count: counts.success || counts.received || 0 },
    { id: 'Failed', label: 'Failed', count: counts.failed || counts.error || 0 }
  ];
};

/**
 * Map tab ID to API type parameter
 * @param {string} tabId - Tab ID (All, Pending, Success, Failed)
 * @returns {string} API type parameter
 */
export const mapTabToApiType = (tabId) => {
  const mapping = {
    'All': 'all',
    'Pending': 'pending',
    'Success': 'success',
    'Failed': 'failed'
  };
  return mapping[tabId] || 'all';
};

/**
 * Get icon data for status tabs
 * @param {string} tabId - Tab ID
 * @returns {Object} Icon configuration (component name and size)
 */
export const getStatusTabIconConfig = (tabId) => {
  const iconMap = {
    'Sent': { name: 'Send', size: 16 },
    'Success': { name: 'CheckCircle', size: 16 },
    'Failed': { name: 'AlertTriangle', size: 16 },
    'Pending': { name: 'Clock', size: 16 }
  };
  return iconMap[tabId] || null;
};

export default {
  STATUS_CODES,
  FILTERABLE_STATUSES,
  STATUS_LABELS,
  TAB_TO_STATUS_CODE,
  getStatusLabel,
  getStatusBadgeClass,
  filterDataByStatus,
  getStatusTabs,
  mapTabToApiType,
  getStatusTabIconConfig
};
