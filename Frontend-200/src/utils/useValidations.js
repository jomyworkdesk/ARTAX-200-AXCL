/**
 * Validation utilities with snackbar notifications
 * Use these functions for consistent validation throughout the application
 */

export const useValidations = (snackbar) => {
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      snackbar.error('Email is required');
      return false;
    }
    if (!emailRegex.test(email)) {
      snackbar.error('Please enter a valid email address');
      return false;
    }
    return true;
  };

  const validatePassword = (password, minLength = 8) => {
    if (!password) {
      snackbar.error('Password is required');
      return false;
    }
    if (password.length < minLength) {
      snackbar.error(`Password must be at least ${minLength} characters`);
      return false;
    }
    return true;
  };

  const validateRequired = (value, fieldName) => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      snackbar.error(`${fieldName} is required`);
      return false;
    }
    return true;
  };

  const validatePhoneNumber = (phone) => {
    const phoneRegex = /^[\d\s+\-()]+$/;
    if (!phone) {
      snackbar.error('Phone number is required');
      return false;
    }
    if (!phoneRegex.test(phone)) {
      snackbar.error('Please enter a valid phone number');
      return false;
    }
    return true;
  };

  const validateFileSize = (file, maxSizeMB = 5) => {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (!file) {
      snackbar.error('File is required');
      return false;
    }
    if (file.size > maxSizeBytes) {
      snackbar.error(`File size must not exceed ${maxSizeMB}MB`);
      return false;
    }
    return true;
  };

  const validateFileType = (file, allowedTypes = []) => {
    if (!file) {
      snackbar.error('File is required');
      return false;
    }
    if (!allowedTypes.includes(file.type)) {
      snackbar.error(`File type not allowed. Accepted types: ${allowedTypes.join(', ')}`);
      return false;
    }
    return true;
  };

  const validateDateRange = (startDate, endDate) => {
    if (!startDate || !endDate) {
      snackbar.error('Both start and end dates are required');
      return false;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      snackbar.error('Start date must be before end date');
      return false;
    }
    return true;
  };

  const validateMinimumSelection = (selectedItems, minCount, itemName = 'items') => {
    if (selectedItems.length < minCount) {
      snackbar.error(`Please select at least ${minCount} ${itemName}`);
      return false;
    }
    return true;
  };

  const validateNumber = (value, fieldName, options = {}) => {
    const { min, max } = options;
    if (value === null || value === undefined || value === '') {
      snackbar.error(`${fieldName} is required`);
      return false;
    }
    const num = Number(value);
    if (isNaN(num)) {
      snackbar.error(`${fieldName} must be a valid number`);
      return false;
    }
    if (min !== undefined && num < min) {
      snackbar.error(`${fieldName} must be at least ${min}`);
      return false;
    }
    if (max !== undefined && num > max) {
      snackbar.error(`${fieldName} must not exceed ${max}`);
      return false;
    }
    return true;
  };

  const validateURL = (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      snackbar.error('Please enter a valid URL');
      return false;
    }
  };

  const showSuccess = (message) => {
    snackbar.success(message);
  };

  const showError = (message) => {
    snackbar.error(message);
  };

  const showWarning = (message) => {
    snackbar.warning(message);
  };

  const showInfo = (message) => {
    snackbar.info(message);
  };

  return {
    validateEmail,
    validatePassword,
    validateRequired,
    validatePhoneNumber,
    validateFileSize,
    validateFileType,
    validateDateRange,
    validateMinimumSelection,
    validateNumber,
    validateURL,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
};
