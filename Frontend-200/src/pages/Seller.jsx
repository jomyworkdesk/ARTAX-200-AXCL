import React, { useCallback, useEffect, useRef, useState } from 'react';
import Select from 'react-select';
import { useSnackbar } from '../components/Snackbar';
import { useValidations } from '../utils/useValidations';
import { apiUrl } from '../config/api';
import './Seller.css';

const initialFormData = {
  orgId: null,
  sellerName: '',
  electronicAddress: '',
  electronicSchemeIdentifier: null,
  sellerIdentifier: '',
  schemeIdentifier: null,
  legalRegistrationIdentifier: '',
  legalSchemeIdentifier: null,
  vatIdentifier: '',
  vatSchemeCode: 'VAT',
  tradingName: '',
  addressLine1: '',
  addressLine2: '',
  addressLine3: '',
  city: '',
  countrySubdivision: null,
  postCode: '',
  countryCode: null,
  legalRegistrationType: null,
  // Conditional Fields
  commercialTradeLicense: '',
  authorityName: '',
  emiratesId: '',
  passport: '',
  passportIssuingCountryCode: null,
  cabinetDecision: '',
  // Contact Fields
  contactPoint: '',
  contactNumber: '',
  contactEmail: ''
};

const emptyDropdownOptions = {
  electronicSchemeIdentifiers: [],
  schemeIdentifiers: [],
  legalSchemeIdentifiers: [],
  countrySubdivisions: [],
  countryCodes: [],
  legalRegistrationTypes: [],
  passportIssuingCountryCodes: []
};

const findOption = (options, value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  return options.find((option) => String(option.value) === String(value)) || null;
};

const legalRegistrationTypeValues = {
  TL: 'Commercial/Trade license',
  EID: 'Emirates ID',
  PAS: 'Passport',
  CD: 'Cabinet Decision'
};

const getLegalRegistrationTypeKey = (option) => {
  const text = `${option?.label || ''} ${option?.value || ''}`.toLowerCase();

  if (text.includes('trade') || text.includes('license') || text.includes('tl')) return 'TL';
  if (text.includes('emirates') || text.includes('eid')) return 'EID';
  if (text.includes('passport') || text.includes('pas')) return 'PAS';
  if (text.includes('cabinet') || text.includes('decision') || text.includes('cd')) return 'CD';

  return '';
};

const findLegalRegistrationTypeOption = (options, value) => {
  const directMatch = findOption(options, value);
  if (directMatch) return directMatch;

  const expectedValue = legalRegistrationTypeValues[value];
  return expectedValue ? findOption(options, expectedValue) : null;
};

const getLegalRegistrationTypeValue = (option) =>
  option ? getLegalRegistrationTypeKey(option) || option.value : null;

const normalizeLegalRegistrationTypeOptions = (options) =>
  options.map((option) => {
    const code = getLegalRegistrationTypeKey(option) || option.value;
    return {
      ...option,
      value: code,
      label: legalRegistrationTypeValues[code] || option.label
    };
  });

const normalizeDropdownOptions = (options) => ({
  ...options,
  legalRegistrationTypes: normalizeLegalRegistrationTypeOptions(options.legalRegistrationTypes || [])
});

const mapSellerToForm = (seller, options) => ({
  ...initialFormData,
  orgId: seller?.orgId ?? null,
  sellerName: seller?.sellerName || '',
  electronicAddress: seller?.electronicAddress || '',
  electronicSchemeIdentifier: findOption(options.electronicSchemeIdentifiers, seller?.electronicSchemeIdentifier),
  sellerIdentifier: seller?.sellerIdentifier || '',
  schemeIdentifier: findOption(options.schemeIdentifiers, seller?.schemeIdentifier),
  legalRegistrationIdentifier: seller?.legalRegistrationIdentifier || '',
  legalSchemeIdentifier: findOption(options.legalSchemeIdentifiers, seller?.legalSchemeIdentifier),
  vatIdentifier: seller?.vatIdentifier || '',
  vatSchemeCode: seller?.vatSchemeCode || 'VAT',
  tradingName: seller?.tradingName || '',
  addressLine1: seller?.addressLine1 || '',
  addressLine2: seller?.addressLine2 || '',
  addressLine3: seller?.addressLine3 || '',
  city: seller?.city || '',
  countrySubdivision: findOption(options.countrySubdivisions, seller?.countrySubdivision),
  postCode: seller?.postCode || '',
  countryCode: findOption(options.countryCodes, seller?.countryCode),
  legalRegistrationType: findLegalRegistrationTypeOption(options.legalRegistrationTypes, seller?.legalRegistrationType),
  commercialTradeLicense: seller?.commercialTradeLicense || '',
  authorityName: seller?.authorityName || '',
  emiratesId: seller?.emiratesId || '',
  passport: seller?.passport || '',
  passportIssuingCountryCode: findOption(options.passportIssuingCountryCodes, seller?.passportIssuingCountryCode),
  cabinetDecision: seller?.cabinetDecision || '',
  contactPoint: seller?.contactPoint || '',
  contactNumber: seller?.contactNumber || '',
  contactEmail: seller?.contactEmail || ''
});

const Seller = () => {
  const snackbar = useSnackbar();
  const snackbarRef = useRef(snackbar);
  snackbarRef.current = snackbar;
  const validations = useValidations(snackbar);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [savedFormData, setSavedFormData] = useState(null);
  const [dropdownOptions, setDropdownOptions] = useState(emptyDropdownOptions);

  // Form State
  const [formData, setFormData] = useState(initialFormData);
  const legalRegistrationTypeKey = getLegalRegistrationTypeKey(formData.legalRegistrationType);

  const fetchSellerDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(apiUrl('/api/configure/seller'));
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to load seller details');
      }

      const options = normalizeDropdownOptions({ ...emptyDropdownOptions, ...(result.data?.options || {}) });
      const nextFormData = mapSellerToForm(result.data?.seller, options);
      setDropdownOptions(options);
      setFormData(nextFormData);
      setSavedFormData(nextFormData);
    } catch (error) {
      console.error('Error fetching seller:', error);
      snackbarRef.current.error('Failed to load seller details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSellerDetails();
  }, [fetchSellerDetails]);

  const handleCancel = () => {
    if (savedFormData) {
      setFormData(savedFormData);
    }
    setIsEditing(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, selectedOption) => {
    setFormData(prev => ({ ...prev, [name]: selectedOption }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!isEditing) return;

    // Basic Validations
    if (!validations.validateRequired(formData.sellerName, 'Seller Name')) return;
    if (formData.orgId === null || formData.orgId === undefined || formData.orgId === '') {
      snackbar.error('Seller Organization is required');
      return;
    }
    if (formData.contactEmail && !validations.validateEmail(formData.contactEmail)) return;
    if (formData.contactNumber && !validations.validatePhoneNumber(formData.contactNumber)) return;

    // Conditional Validations based on Legal Registration Type
    const regType = getLegalRegistrationTypeKey(formData.legalRegistrationType);
    if (regType === 'TL') {
      if (!validations.validateRequired(formData.commercialTradeLicense, 'Commercial/Trade License')) return;
      if (!validations.validateRequired(formData.authorityName, 'Authority Name')) return;
    } else if (regType === 'EID') {
      if (!validations.validateRequired(formData.emiratesId, 'Emirates ID')) return;
    } else if (regType === 'PAS') {
      if (!validations.validateRequired(formData.passport, 'Passport')) return;
      if (!validations.validateRequired(formData.passportIssuingCountryCode?.value, 'Passport Issuing Country')) return;
    } else if (regType === 'CD') {
      if (!validations.validateRequired(formData.cabinetDecision, 'Cabinet Decision')) return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(apiUrl('/api/configure/seller'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: formData.orgId,
          sellerName: formData.sellerName,
          vatIdentifier: formData.vatIdentifier,
          tradingName: formData.tradingName,
          addressLine1: formData.addressLine1,
          addressLine2: formData.addressLine2,
          addressLine3: formData.addressLine3,
          city: formData.city,
          postCode: formData.postCode,
          contactPoint: formData.contactPoint,
          contactNumber: formData.contactNumber,
          electronicAddress: formData.electronicAddress,
          electronicSchemeIdentifier: formData.electronicSchemeIdentifier?.value ?? null,
          sellerIdentifier: formData.sellerIdentifier,
          schemeIdentifier: formData.schemeIdentifier?.value ?? null,
          legalRegistrationIdentifier: formData.legalRegistrationIdentifier,
          legalSchemeIdentifier: formData.legalSchemeIdentifier?.value ?? null,
          vatSchemeCode: formData.vatSchemeCode,
          countrySubdivision: formData.countrySubdivision?.value ?? null,
          countryCode: formData.countryCode?.value ?? null,
          legalRegistrationType: getLegalRegistrationTypeValue(formData.legalRegistrationType),
          commercialTradeLicense: formData.commercialTradeLicense,
          authorityName: formData.authorityName,
          emiratesId: formData.emiratesId,
          passport: formData.passport,
          passportIssuingCountryCode: formData.passportIssuingCountryCode?.value ?? null,
          cabinetDecision: formData.cabinetDecision,
          contactEmail: formData.contactEmail
        })
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to update seller details');
      }

      const options = normalizeDropdownOptions({ ...emptyDropdownOptions, ...(result.data?.options || dropdownOptions) });
      const nextFormData = mapSellerToForm(result.data?.seller, options);
      setDropdownOptions(options);
      setFormData(nextFormData);
      setSavedFormData(nextFormData);
      snackbar.success('Seller details updated successfully!');
      setIsEditing(false); // Switch back to read-only after success
    } catch (error) {
      console.error('Error updating seller:', error);
      snackbar.error('Failed to update seller details. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Custom styles for react-select
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: '40px',
      fontSize: '0.9rem',
      borderRadius: '8px',
      borderColor: state.isFocused ? 'var(--primary)' : 'var(--border-color)',
      backgroundColor: isEditing ? 'var(--bg-surface)' : 'var(--bg-surface-hover)',
      boxShadow: state.isFocused && isEditing ? '0 0 0 1px var(--primary)' : 'none',
      cursor: isEditing ? 'pointer' : 'not-allowed',
      '&:hover': {
        borderColor: isEditing ? 'var(--primary)' : 'var(--border-color)'
      }
    }),
    valueContainer: (base) => ({ ...base, padding: '0 12px' }),
    singleValue: (base) => ({ ...base, color: isEditing ? 'var(--text-primary)' : 'var(--text-secondary)' }),
    input: (base) => ({ ...base, color: 'var(--text-primary)' }),
    placeholder: (base) => ({ ...base, color: 'var(--text-muted)' }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-md)',
      zIndex: 10
    }),
    option: (base, state) => ({
      ...base,
      fontSize: '0.9rem',
      backgroundColor: state.isSelected ? 'var(--primary)' : state.isFocused ? 'var(--bg-surface-hover)' : 'var(--bg-surface)',
      color: state.isSelected ? '#ffffff' : 'var(--text-primary)',
      cursor: 'pointer'
    })
  };

  return (
    <div className="seller-page fade-in">
      <div className="seller-header-container">
        <div className="seller-header-titles">
          <h1>Seller Configuration</h1>
          <p className="seller-subtitle">{isLoading ? 'Loading seller details...' : 'View and update your seller details and registration information.'}</p>
        </div>
        {!isEditing && (
          <button className="btn-edit" onClick={() => setIsEditing(true)} disabled={isLoading}>
            Edit Details
          </button>
        )}
      </div>

      <form className={`seller-form ${!isEditing ? 'read-only' : ''}`} onSubmit={handleUpdate}>

        {/* SECTION: General Information */}
        <div className="form-section">
          <h2 className="section-title">General Information</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Seller Name <span className="required">*</span></label>
              <input type="text" name="sellerName" value={formData.sellerName} onChange={handleInputChange} placeholder="Enter Seller Name" className="form-input" disabled={!isEditing} />
            </div>
            <div className="form-group">
              <label>Seller Trading Name</label>
              <input type="text" name="tradingName" value={formData.tradingName} onChange={handleInputChange} placeholder="Enter Trading Name" className="form-input" disabled={!isEditing} />
            </div>
            <div className="form-group">
              <label>VAT Identifier</label>
              <input type="text" name="vatIdentifier" value={formData.vatIdentifier} onChange={handleInputChange} placeholder="Enter VAT Identifier" className="form-input" disabled={!isEditing} />
            </div>
          </div>
        </div>

        {/* SECTION: Identifiers & Legal Registration */}
        <div className="form-section">
          <h2 className="section-title">Identifiers & Legal Registration</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Seller Identifier</label>
              <input type="text" name="sellerIdentifier" value={formData.sellerIdentifier} onChange={handleInputChange} placeholder="Enter Seller Identifier" className="form-input" disabled={!isEditing} />
            </div>
            
            <div className="form-group">
              <label>Electronic Address</label>
              <input type="text" name="electronicAddress" value={formData.electronicAddress} onChange={handleInputChange} placeholder="Enter Electronic Address" className="form-input" disabled={!isEditing} />
            </div>
           
          
            <div className="form-group">
              <label>Legal Registration Identifier</label>
              <input type="text" name="legalRegistrationIdentifier" value={formData.legalRegistrationIdentifier} onChange={handleInputChange} placeholder="Enter Legal Identifier" className="form-input" disabled={!isEditing} />
            </div>

              <div className="form-group">
              <label>VAT Scheme Code</label>
              <input type="text" name="vatSchemeCode" value={formData.vatSchemeCode} onChange={handleInputChange} placeholder="Enter VAT Scheme Code" className="form-input" disabled={!isEditing} />
            </div>
            <div className="scheme-identifiers-row">
              <div className="form-group">
                <label>Legal Scheme Identifier</label>
                <Select options={dropdownOptions.legalSchemeIdentifiers} value={formData.legalSchemeIdentifier} onChange={(opt) => handleSelectChange('legalSchemeIdentifier', opt)} styles={selectStyles} placeholder="Select Legal Scheme" isClearable isSearchable isDisabled={!isEditing} />
              </div>
              <div className="form-group">
                <label>Seller Scheme Identifier</label>
                <Select options={dropdownOptions.schemeIdentifiers} value={formData.schemeIdentifier} onChange={(opt) => handleSelectChange('schemeIdentifier', opt)} styles={selectStyles} placeholder="Select Scheme Identifier" isClearable isSearchable isDisabled={!isEditing} />
              </div>
              <div className="form-group">
                <label>Electronic Scheme Identifier</label>
                <Select options={dropdownOptions.electronicSchemeIdentifiers} value={formData.electronicSchemeIdentifier} onChange={(opt) => handleSelectChange('electronicSchemeIdentifier', opt)} styles={selectStyles} placeholder="Select Electronic Scheme" isClearable isSearchable isDisabled={!isEditing} />
              </div>
            </div>

            <div className="form-group full-width divider"></div>

            <div className="form-group">
              <label>Legal Registration Type</label>
              <Select options={dropdownOptions.legalRegistrationTypes} value={formData.legalRegistrationType} onChange={(opt) => handleSelectChange('legalRegistrationType', opt)} styles={selectStyles} placeholder="Select Registration Type" isClearable isSearchable isDisabled={!isEditing} />
            </div>

            {/* Conditional Fields: TL */}
            {legalRegistrationTypeKey === 'TL' && (
              <>
                <div className="form-group slide-down">
                  <label>Commercial/Trade License <span className="required">*</span></label>
                  <input type="text" name="commercialTradeLicense" value={formData.commercialTradeLicense} onChange={handleInputChange} placeholder="Enter Trade License" className="form-input" disabled={!isEditing} />
                </div>
                <div className="form-group slide-down">
                  <label>Authority Name <span className="required">*</span></label>
                  <input type="text" name="authorityName" value={formData.authorityName} onChange={handleInputChange} placeholder="Enter Authority Name" className="form-input" disabled={!isEditing} />
                </div>
              </>
            )}

            {/* Conditional Fields: EID */}
            {legalRegistrationTypeKey === 'EID' && (
              <div className="form-group slide-down">
                <label>Emirates ID <span className="required">*</span></label>
                <input type="text" name="emiratesId" value={formData.emiratesId} onChange={handleInputChange} placeholder="Enter Emirates ID" className="form-input" disabled={!isEditing} />
              </div>
            )}

            {/* Conditional Fields: PAS */}
            {legalRegistrationTypeKey === 'PAS' && (
              <>
                <div className="form-group slide-down">
                  <label>Passport <span className="required">*</span></label>
                  <input type="text" name="passport" value={formData.passport} onChange={handleInputChange} placeholder="Enter Passport Number" className="form-input" disabled={!isEditing} />
                </div>
                <div className="form-group slide-down">
                  <label>Passport Issuing Country Code <span className="required">*</span></label>
                  <Select options={dropdownOptions.passportIssuingCountryCodes} value={formData.passportIssuingCountryCode} onChange={(opt) => handleSelectChange('passportIssuingCountryCode', opt)} styles={selectStyles} placeholder="Select Country Code" isClearable isSearchable isDisabled={!isEditing} />
                </div>
              </>
            )}

            {/* Conditional Fields: CD */}
            {legalRegistrationTypeKey === 'CD' && (
              <div className="form-group slide-down">
                <label>Cabinet Decision <span className="required">*</span></label>
                <input type="text" name="cabinetDecision" value={formData.cabinetDecision} onChange={handleInputChange} placeholder="Enter Cabinet Decision" className="form-input" disabled={!isEditing} />
              </div>
            )}
          </div>
        </div>

        {/* SECTION: Address & Contact Details */}
        <div className="form-section">
          <h2 className="section-title">Address & Contact Details</h2>
          <div className="form-grid">
            <div className="form-group half-width">
              <label>Address Line 1</label>
              <input type="text" name="addressLine1" value={formData.addressLine1} onChange={handleInputChange} placeholder="Enter Address Line 1" className="form-input" disabled={!isEditing} />
            </div>
            <div className="form-group">
              <label>Address Line 2</label>
              <input type="text" name="addressLine2" value={formData.addressLine2} onChange={handleInputChange} placeholder="Enter Address Line 2" className="form-input" disabled={!isEditing} />
            </div>
            <div className="form-group">
              <label>Address Line 3</label>
              <input type="text" name="addressLine3" value={formData.addressLine3} onChange={handleInputChange} placeholder="Enter Address Line 3" className="form-input" disabled={!isEditing} />
            </div>
            <div className="form-group">
              <label>City</label>
              <input type="text" name="city" value={formData.city} onChange={handleInputChange} placeholder="Enter City" className="form-input" disabled={!isEditing} />
            </div>
            <div className="form-group">
              <label>Post Code</label>
              <input type="text" name="postCode" value={formData.postCode} onChange={handleInputChange} placeholder="Enter Post Code" className="form-input" disabled={!isEditing} />
            </div>
            <div className="form-group">
              <label>Country Subdivision</label>
              <Select options={dropdownOptions.countrySubdivisions} value={formData.countrySubdivision} onChange={(opt) => handleSelectChange('countrySubdivision', opt)} styles={selectStyles} placeholder="Select Subdivision" isClearable isSearchable isDisabled={!isEditing} />
            </div>
            <div className="form-group">
              <label>Country Code</label>
              <Select options={dropdownOptions.countryCodes} value={formData.countryCode} onChange={(opt) => handleSelectChange('countryCode', opt)} styles={selectStyles} placeholder="Select Country Code" isClearable isSearchable isDisabled={!isEditing} />
            </div>

                        <div className="form-group full-width divider"></div>

            <div className="form-group">
              <label>Contact Person</label>
              <input type="text" name="contactPoint" value={formData.contactPoint} onChange={handleInputChange} placeholder="Enter Contact Person" className="form-input" disabled={!isEditing} />
            </div>
            <div className="form-group">
              <label>Contact Number</label>
              <input type="text" name="contactNumber" value={formData.contactNumber} onChange={handleInputChange} placeholder="Enter Contact Number" className="form-input" disabled={!isEditing} />
            </div>
            <div className="form-group">
              <label>Contact Email</label>
              <input type="email" name="contactEmail" value={formData.contactEmail} onChange={handleInputChange} placeholder="Enter Contact Email" className="form-input" disabled={!isEditing} />
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="seller-actions slide-down">
            <button type="button" className="btn-cancel" onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-update" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : 'Update Details'}
            </button>
          </div>
        )}

      </form>
    </div>
  );
};

export default Seller;
