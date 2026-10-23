import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Select from 'react-select';
import { useSnackbar } from '../components/Snackbar';
import { useValidations } from '../utils/useValidations';
import { apiUrl } from '../config/api';
import './BuyerForm.css';

const initialFormData = {
  id: '',
  idCust: '',
  buyerName: '',
  electronicAddress: '',
  buyerIdentifier: '',
  legalRegistrationIdentifier: '',
  legalSchemeIdentifier: null,
  vatIdentifier: '',
  tradingName: '',
  addressLine1: '',
  addressLine2: '',
  addressLine3: '',
  city: '',
  postCode: '',
  countrySubdivision: null,
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

const mapBuyerToForm = (buyer, options) => {
  if (!buyer) return initialFormData;
  return {
    ...initialFormData,
    id: buyer.id,
    idCust: buyer.idCust || buyer.id || '',
    buyerName: buyer.buyerName || '',
    electronicAddress: buyer.electronicAddress || '',
    buyerIdentifier: buyer.buyerIdentifier || '',
    legalRegistrationIdentifier: buyer.legalRegistrationIdentifier || '',
    legalSchemeIdentifier: findOption(options.legalSchemeIdentifiers, buyer.legalSchemeIdentifier),
    vatIdentifier: buyer.vatIdentifier || '',
    tradingName: buyer.tradingName || '',
    addressLine1: buyer.addressLine1 || '',
    addressLine2: buyer.addressLine2 || '',
    addressLine3: buyer.addressLine3 || '',
    city: buyer.city || '',
    countrySubdivision: findOption(options.countrySubdivisions, buyer.countrySubdivision),
    postCode: buyer.postCode || '',
    countryCode: findOption(options.countryCodes, buyer.countryCode),
    legalRegistrationType: findLegalRegistrationTypeOption(options.legalRegistrationTypes, buyer.legalRegistrationType),
    commercialTradeLicense: buyer.commercialTradeLicense || '',
    authorityName: buyer.authorityName || '',
    emiratesId: buyer.emiratesId || '',
    passport: buyer.passport || '',
    passportIssuingCountryCode: findOption(options.passportIssuingCountryCodes, buyer.passportIssuingCountryCode),
    cabinetDecision: buyer.cabinetDecision || '',
    contactPoint: buyer.contactPoint || '',
    contactNumber: buyer.contactNumber || '',
    contactEmail: buyer.contactEmail || ''
  };
};

const BuyerForm = ({ buyer = null, onSave, onCancel }) => {
  const navigate = useNavigate();
  const { idCust: routeIdCust } = useParams();
  const snackbar = useSnackbar();
  const snackbarRef = useRef(snackbar);
  snackbarRef.current = snackbar;
  const validations = useValidations(snackbar);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [dropdownOptions, setDropdownOptions] = useState(emptyDropdownOptions);
  const [savedFormData, setSavedFormData] = useState(() => mapBuyerToForm(buyer, emptyDropdownOptions));
  const [formData, setFormData] = useState(() => mapBuyerToForm(buyer, emptyDropdownOptions));

  const legalRegistrationTypeKey = getLegalRegistrationTypeKey(formData.legalRegistrationType);

  const fetchBuyerDetails = useCallback(async () => {
    const idCust = buyer?.idCust || buyer?.id || routeIdCust;
    if (!idCust) return;

    setIsLoading(true);
    try {
      const response = await fetch(apiUrl(`/api/configure/buyer/${encodeURIComponent(idCust)}`));
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to load buyer details');
      }

      const options = normalizeDropdownOptions({ ...emptyDropdownOptions, ...(result.data?.options || {}) });
      const nextFormData = mapBuyerToForm(result.data?.buyer, options);
      setDropdownOptions(options);
      setFormData(nextFormData);
      setSavedFormData(nextFormData);
      setIsEditing(false);
    } catch (error) {
      console.error('Error fetching buyer:', error);
      snackbarRef.current.error('Failed to load buyer details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [buyer, routeIdCust]);

  const handleBackToList = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    navigate('/configure/buyer');
  };

  useEffect(() => {
    fetchBuyerDetails();
  }, [fetchBuyerDetails]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, selectedOption) => {
    setFormData(prev => ({ ...prev, [name]: selectedOption }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEditing) return;

    // Basic Validations
    if (!validations.validateRequired(formData.buyerName, 'Buyer Name')) return;
    if (!validations.validateRequired(formData.idCust, 'Buyer Customer')) return;
    if (formData.contactEmail && !validations.validateEmail(formData.contactEmail)) return;
    if (formData.contactNumber && !validations.validatePhoneNumber(formData.contactNumber)) return;

    // Conditional Validations based on Legal Registration Type
    const regType = legalRegistrationTypeKey;
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
      const response = await fetch(apiUrl('/api/configure/buyer'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idCust: formData.idCust,
          buyerName: formData.buyerName,
          tradingName: formData.tradingName,
          addressLine1: formData.addressLine1,
          addressLine2: formData.addressLine2,
          addressLine3: formData.addressLine3,
          city: formData.city,
          postCode: formData.postCode,
          contactPoint: formData.contactPoint,
          contactNumber: formData.contactNumber,
          contactEmail: formData.contactEmail,
          electronicAddress: formData.electronicAddress,
          buyerIdentifier: formData.buyerIdentifier,
          legalRegistrationIdentifier: formData.legalRegistrationIdentifier,
          legalSchemeIdentifier: formData.legalSchemeIdentifier?.value ?? null,
          vatIdentifier: formData.vatIdentifier,
          countrySubdivision: formData.countrySubdivision?.value ?? null,
          countryCode: formData.countryCode?.value ?? null,
          legalRegistrationType: getLegalRegistrationTypeValue(formData.legalRegistrationType),
          commercialTradeLicense: formData.commercialTradeLicense,
          authorityName: formData.authorityName,
          emiratesId: formData.emiratesId,
          passport: formData.passport,
          passportIssuingCountryCode: formData.passportIssuingCountryCode?.value ?? null,
          cabinetDecision: formData.cabinetDecision
        })
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to save buyer details');
      }

      const options = normalizeDropdownOptions({ ...emptyDropdownOptions, ...(result.data?.options || dropdownOptions) });
      const savedData = mapBuyerToForm(result.data?.buyer, options);
      setDropdownOptions(options);
      setFormData(savedData);
      setSavedFormData(savedData);

      if (onSave) {
        onSave(savedData);
      }

      setIsEditing(false);
      snackbar.success('Buyer details updated successfully!');
    } catch (error) {
      console.error('Error saving buyer:', error);
      snackbar.error('Failed to save buyer details. Please try again.');
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
    <div className="buyer-page fade-in">
      <div className="buyer-header-container">
        <div className="seller-header-titles">
          <h1>Buyer Configuration</h1>
          <p className="seller-subtitle">{isLoading ? 'Loading Buyer details...' : 'View and update your Buyer details and registration information.'}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {!isEditing && (
            <button className="btn-edit" onClick={() => setIsEditing(true)} disabled={isLoading}>
              Edit Details
            </button>
          )}
          <button
            type="button"
            className="btn-cancel"
            onClick={handleBackToList}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', margin: 0 }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Back to List
          </button>
        </div>
      </div>

      <form className={`buyer-form ${!isEditing ? 'read-only' : ''}`} onSubmit={handleSubmit}>

        {/* SECTION: General Information */}
        <div className="form-section">
          <h2 className="section-title">General Information</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Buyer Name <span className="required">*</span></label>
              <input type="text" name="buyerName" value={formData.buyerName} onChange={handleInputChange} placeholder="Enter Buyer Name" className="form-input" disabled={!isEditing} />
            </div>
            {/* <div className="form-group">
              <label>Buyer Trading Name</label>
              <input type="text" name="tradingName" value={formData.tradingName} onChange={handleInputChange} placeholder="Enter Trading Name" className="form-input" disabled={!isEditing} />
            </div> */}
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
              <label>Buyer Identifier</label>
              <input type="text" name="buyerIdentifier" value={formData.buyerIdentifier} onChange={handleInputChange} placeholder="Enter Buyer Identifier" className="form-input" disabled={!isEditing} />
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
              <label>Scheme Identifier</label>
              <Select options={dropdownOptions.legalSchemeIdentifiers} value={formData.legalSchemeIdentifier} onChange={(opt) => handleSelectChange('legalSchemeIdentifier', opt)} styles={selectStyles} placeholder="Select Legal Scheme" isClearable isSearchable isDisabled={!isEditing} />
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
          <div className="buyer-actions slide-down">
            <button type="button" className="btn-cancel" onClick={() => {
              setIsEditing(false);
              setFormData(savedFormData);
            }} disabled={isSubmitting}>
              Cancel Edits
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

export default BuyerForm;
