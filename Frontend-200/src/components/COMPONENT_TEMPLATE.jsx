/**
 * Component Template with Snackbar Integration
 * Use this as a starting point for new components that need notifications and validations
 */

import { useState } from 'react';
import { useSnackbar } from '../components/Snackbar';
import { useValidations } from '../utils/useValidations';

const ComponentTemplate = () => {
  const snackbar = useSnackbar();
  const validations = useValidations(snackbar);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    // Add your form fields here
  });

  const [isLoading, setIsLoading] = useState(false);

  // Example: Form submission with validation
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate fields
      if (!validations.validateRequired(formData.name, 'Name')) {
        setIsLoading(false);
        return;
      }

      if (!validations.validateEmail(formData.email)) {
        setIsLoading(false);
        return;
      }

      // All validations passed - proceed with API call
      const response = await fetch('/api/endpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        validations.showSuccess('Operation completed successfully!');
        // Reset form or redirect
      } else {
        validations.showError(data.message || 'Operation failed');
      }
    } catch (error) {
      console.error(error);
      validations.showError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Example: Bulk action with selection validation
  const handleBulkAction = () => {
    // Example using validation for minimum selection
    // if (!validations.validateMinimumSelection(selectedItems, 1, 'items')) {
    //   return;
    // }
    snackbar.info('Processing bulk action...');
  };

  // Example: Simple success feedback
  const handleDelete = () => {
    snackbar.warning('This action cannot be undone');
    // Proceed with deletion
  };

  return (
    <div className="template-container">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter your name"
          />
        </div>

        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="Enter your email"
          />
        </div>

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Submit'}
        </button>
      </form>
    </div>
  );
};

export default ComponentTemplate;

/**
 * QUICK REFERENCE - Snackbar Usage Patterns
 * 
 * 1. SUCCESS MESSAGE
 *    snackbar.success('Invoice sent successfully!');
 * 
 * 2. ERROR MESSAGE
 *    snackbar.error('Failed to send invoice');
 * 
 * 3. INFO MESSAGE
 *    snackbar.info('Processing your request...');
 * 
 * 4. WARNING MESSAGE
 *    snackbar.warning('This action cannot be undone');
 * 
 * 5. CUSTOM DURATION
 *    snackbar.success('Message', 6000); // 6 seconds
 *    snackbar.info('Persistent', 0);    // Never auto-dismiss
 * 
 * 6. VALIDATION - EMAIL
 *    if (!validations.validateEmail(email)) return;
 * 
 * 7. VALIDATION - REQUIRED FIELD
 *    if (!validations.validateRequired(value, 'Field Name')) return;
 * 
 * 8. VALIDATION - PHONE NUMBER
 *    if (!validations.validatePhoneNumber(phone)) return;
 * 
 * 9. VALIDATION - FILE SIZE
 *    if (!validations.validateFileSize(file, 5)) return; // 5MB limit
 * 
 * 10. VALIDATION - MINIMUM SELECTION
 *     if (!validations.validateMinimumSelection(selectedItems, 1)) return;
 * 
 * 11. VALIDATION - DATE RANGE
 *     if (!validations.validateDateRange(startDate, endDate)) return;
 * 
 * 12. VALIDATION - NUMBER WITH RANGE
 *     if (!validations.validateNumber(age, 'Age', {min: 18, max: 120})) return;
 * 
 * 13. SHOW SUCCESS (Shortcut)
 *     validations.showSuccess('Saved successfully!');
 * 
 * 14. SHOW ERROR (Shortcut)
 *     validations.showError('Something went wrong');
 * 
 * 15. SHOW WARNING (Shortcut)
 *     validations.showWarning('This is important');
 * 
 * 16. SHOW INFO (Shortcut)
 *     validations.showInfo('Information for you');
 */
