# Snackbar Notification System

A global, reusable snackbar notification system for displaying validation errors, success messages, warnings, and info messages throughout the ARTAX application.

## Features

- **Global State Management**: Uses React Context for centralized notification management
- **Auto-dismiss**: Notifications automatically disappear after 4 seconds (configurable)
- **Multiple Types**: Success, Error, Info, and Warning variants
- **Position**: Fixed at top-right corner of the screen
- **Smooth Animations**: Slide-in and slide-out animations
- **Close Button**: Manual dismiss option for each notification
- **Responsive**: Works on mobile and desktop screens

## Setup

The SnackbarProvider is already configured in `App.jsx` and wraps the entire application, so you can use snackbars anywhere in your components.

## Usage

### Basic Usage with Hook

```jsx
import { useSnackbar } from '../components/Snackbar';

function MyComponent() {
  const snackbar = useSnackbar();

  const handleClick = () => {
    snackbar.success('Operation completed successfully!');
  };

  return <button onClick={handleClick}>Click Me</button>;
}
```

### Available Methods

```jsx
const snackbar = useSnackbar();

// Show success message (auto-dismisses in 4 seconds)
snackbar.success('Invoice sent successfully!');

// Show error message
snackbar.error('Failed to send invoice');

// Show info message
snackbar.info('Processing your request...');

// Show warning message
snackbar.warning('This action cannot be undone');

// Custom duration (in milliseconds)
// Pass 0 to disable auto-dismiss
snackbar.success('Persistent message', 0);

// Dismiss after 10 seconds
snackbar.info('Custom duration', 10000);
```

## Using Validations Hook

For consistent validation messages across the app, use the `useValidations` hook:

```jsx
import { useSnackbar } from '../components/Snackbar';
import { useValidations } from '../utils/useValidations';

function MyForm() {
  const snackbar = useSnackbar();
  const validations = useValidations(snackbar);
  const [email, setEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validation will automatically show error snackbar
    if (!validations.validateEmail(email)) {
      return;
    }

    // Proceed with submission
    snackbar.success('Form submitted!');
  };

  return (
    <form onSubmit={handleSubmit}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />
      <button type="submit">Submit</button>
    </form>
  );
}
```

## Available Validation Functions

### String Validations
- `validateEmail(email)` - Validates email format
- `validateRequired(value, fieldName)` - Checks if value is not empty
- `validateURL(url)` - Validates URL format

### Password & Security
- `validatePassword(password, minLength = 8)` - Validates password strength

### Contact Info
- `validatePhoneNumber(phone)` - Validates phone number format

### Files
- `validateFileSize(file, maxSizeMB = 5)` - Check file size limit
- `validateFileType(file, allowedTypes = [])` - Check file type

### Numeric
- `validateNumber(value, fieldName, options = {})` - Validates numbers with optional min/max
  ```jsx
  validations.validateNumber(age, 'Age', { min: 18, max: 120 });
  ```

### Date & Range
- `validateDateRange(startDate, endDate)` - Check date range validity

### Collections
- `validateMinimumSelection(selectedItems, minCount, itemName)` - Ensure minimum selections
  ```jsx
  validations.validateMinimumSelection(selectedInvoices, 1, 'invoices');
  ```

### Message Shortcuts
- `showSuccess(message)` - Quickly show success message
- `showError(message)` - Quickly show error message
- `showWarning(message)` - Quickly show warning message
- `showInfo(message)` - Quickly show info message

## Examples

### Example 1: Form Validation
```jsx
import { useSnackbar } from '../components/Snackbar';
import { useValidations } from '../utils/useValidations';

function ClientForm() {
  const snackbar = useSnackbar();
  const validations = useValidations(snackbar);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    name: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate all fields
    if (!validations.validateRequired(formData.name, 'Name')) return;
    if (!validations.validateEmail(formData.email)) return;
    if (!validations.validatePhoneNumber(formData.phone)) return;

    // All validations passed
    snackbar.success('Client information saved!');
    // Submit form...
  };

  return (
    <form onSubmit={handleSubmit}>
      <input 
        value={formData.name}
        onChange={(e) => setFormData({...formData, name: e.target.value})}
        placeholder="Name"
      />
      <input 
        value={formData.email}
        onChange={(e) => setFormData({...formData, email: e.target.value})}
        placeholder="Email"
      />
      <input 
        value={formData.phone}
        onChange={(e) => setFormData({...formData, phone: e.target.value})}
        placeholder="Phone"
      />
      <button type="submit">Save</button>
    </form>
  );
}
```

### Example 2: Bulk Actions with Selection
```jsx
import { useSnackbar } from '../components/Snackbar';
import { useValidations } from '../utils/useValidations';

function InvoiceList() {
  const snackbar = useSnackbar();
  const validations = useValidations(snackbar);
  const [selectedInvoices, setSelectedInvoices] = useState(new Set());

  const handleSendInvoices = () => {
    // Validate minimum selection
    if (!validations.validateMinimumSelection(
      Array.from(selectedInvoices), 
      1, 
      'invoices'
    )) {
      return;
    }

    // Proceed with sending
    snackbar.info(`Sending ${selectedInvoices.size} invoices...`);
    // Submit...
    snackbar.success('Invoices sent successfully!');
  };

  return (
    <>
      <button onClick={handleSendInvoices} disabled={selectedInvoices.size === 0}>
        Send ({selectedInvoices.size})
      </button>
    </>
  );
}
```

### Example 3: File Upload
```jsx
import { useSnackbar } from '../components/Snackbar';
import { useValidations } from '../utils/useValidations';

function FileUpload() {
  const snackbar = useSnackbar();
  const validations = useValidations(snackbar);

  const handleFileChange = (e) => {
    const file = e.target.files[0];

    // Validate file size
    if (!validations.validateFileSize(file, 10)) return;

    // Validate file type
    if (!validations.validateFileType(file, ['application/pdf', 'application/json'])) return;

    snackbar.success('File ready to upload!');
  };

  return <input type="file" onChange={handleFileChange} />;
}
```

## Styling

The snackbar has predefined styles for different types:

- **Success**: Green background with checkmark icon
- **Error**: Red background with alert icon
- **Info**: Blue background with info icon
- **Warning**: Yellow background with warning icon

All notifications appear at the top-right corner and automatically disappear after 4 seconds (default).

## Best Practices

1. **Use Specific Messages**: Be clear and specific about what happened
   ❌ `snackbar.error('Error')`
   ✅ `snackbar.error('Failed to send invoice: Invoice already sent')`

2. **Use Appropriate Types**:
   - `success`: Operation completed successfully
   - `error`: Operation failed or validation failed
   - `warning`: Caution needed, but operation may continue
   - `info`: Informational messages

3. **Keep Messages Short**: Notifications should be brief and scannable
   ❌ `snackbar.success('Your invoices have been successfully sent to all the recipients')`
   ✅ `snackbar.success('Invoices sent successfully')`

4. **Use Validations Hook for Forms**: Ensures consistent error messaging
   
5. **Don't Overuse**: Avoid notification spam. Use only when necessary

## Customization

To change auto-dismiss duration globally, modify the `SnackbarContext.jsx`:

```jsx
const showSnackbar = useCallback((type, message, duration = 4000) => {
  // Change 4000 to your preferred duration in milliseconds
});
```

To change position from top-right, modify `Snackbar.css`:

```css
.snackbar-container {
  top: 20px;      /* Change vertical position */
  right: 20px;    /* Change horizontal position */
  /* Use 'left' instead of 'right' for left-aligned */
}
```
