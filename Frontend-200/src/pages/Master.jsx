import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { API_BASE_URL, apiFetch } from '../services/apiService';
import './Master.css';

const CONFIGURE_API_URL = `${API_BASE_URL}/configure`;

const Configure = () => {
  const [masters, setMasters] = useState({ stateMaster: false, countryMaster: false, paymentMaster: false, generalLedgerMaster: false, accountReceivableMaster: false, accountPayableMaster: false, otherInvoiceTypeMaster: false, electronicAddressSchemeMaster: false, objectIdentifierMaster: false, invoiceTransactionMaster: false, creditNoteReasonMaster: false, chargesMaster: false, tddScopeMaster: false, rcmTypeMaster: false, currencyMaster: false, unitMaster: false, vatMaster: false, exemptReasonMaster: false });

  // State Master
  const [stateTableData, setStateTableData] = useState([]);
  const [stateDropdownOptions, setStateDropdownOptions] = useState([]);
  const [allStateOptions, setAllStateOptions] = useState([]);
  const [isStateEditing, setIsStateEditing] = useState(false);
  const [stateSelections, setStateSelections] = useState({});

  // Country Master
  const [countryTableData, setCountryTableData] = useState([]);
  const [countryDropdownOptions, setCountryDropdownOptions] = useState([]);
  const [allCountryOptions, setAllCountryOptions] = useState([]);
  const [isCountryEditing, setIsCountryEditing] = useState(false);
  const [countrySelections, setCountrySelections] = useState({});

  // Payment Master
  const [paymentTableData, setPaymentTableData] = useState([]);
  const [paymentDropdownOptions, setPaymentDropdownOptions] = useState([]);
  const [allPaymentOptions, setAllPaymentOptions] = useState([]);
  const [isPaymentEditing, setIsPaymentEditing] = useState(false);
  const [paymentSelections, setPaymentSelections] = useState({});

  // Invoice Type Master
  const [invoiceTypeTableData, setInvoiceTypeTableData] = useState([]);
  const [invoiceTypeDropdownOptions, setInvoiceTypeDropdownOptions] = useState([]);
  const [allInvoiceTypeOptions, setAllInvoiceTypeOptions] = useState([]);
  const [invoiceTypeGroupEditing, setInvoiceTypeGroupEditing] = useState({ 4: false, 5: false, 6: false, other: false });
  const [invoiceTypeSelections, setInvoiceTypeSelections] = useState({});

  // Electronic Address Scheme Master
  const [electronicAddressSchemeTableData, setElectronicAddressSchemeTableData] = useState([]);
  const [electronicAddressSchemeDropdownOptions, setElectronicAddressSchemeDropdownOptions] = useState([]);
  const [allElectronicAddressSchemeOptions, setAllElectronicAddressSchemeOptions] = useState([]);
  const [isElectronicAddressSchemeEditing, setIsElectronicAddressSchemeEditing] = useState(false);
  const [electronicAddressSchemeSelections, setElectronicAddressSchemeSelections] = useState({});

  // Object Identifier Master
  const [objectIdentifierTableData, setObjectIdentifierTableData] = useState([]);
  const [objectIdentifierDropdownOptions, setObjectIdentifierDropdownOptions] = useState([]);
  const [allObjectIdentifierOptions, setAllObjectIdentifierOptions] = useState([]);
  const [isObjectIdentifierEditing, setIsObjectIdentifierEditing] = useState(false);
  const [objectIdentifierSelections, setObjectIdentifierSelections] = useState({});

  // Invoice Transaction Master
  const [invoiceTransactionTableData, setInvoiceTransactionTableData] = useState([]);
  const [invoiceTransactionDropdownOptions, setInvoiceTransactionDropdownOptions] = useState([]);
  const [allInvoiceTransactionOptions, setAllInvoiceTransactionOptions] = useState([]);
  const [isInvoiceTransactionEditing, setIsInvoiceTransactionEditing] = useState(false);
  const [invoiceTransactionSelections, setInvoiceTransactionSelections] = useState({});

  // Credit Note Reason Master
  const [creditNoteReasonTableData, setCreditNoteReasonTableData] = useState([]);
  const [creditNoteReasonDropdownOptions, setCreditNoteReasonDropdownOptions] = useState([]);
  const [allCreditNoteReasonOptions, setAllCreditNoteReasonOptions] = useState([]);
  const [isCreditNoteReasonEditing, setIsCreditNoteReasonEditing] = useState(false);
  const [creditNoteReasonSelections, setCreditNoteReasonSelections] = useState({});

  // Charges Master
  const [chargesTableData, setChargesTableData] = useState([]);
  const [chargesDropdownOptions, setChargesDropdownOptions] = useState([]);
  const [allChargesOptions, setAllChargesOptions] = useState([]);
  const [isChargesEditing, setIsChargesEditing] = useState(false);
  const [chargesSelections, setChargesSelections] = useState({});

  // TDD Scope Master
  const [tddScopeTableData, setTddScopeTableData] = useState([]);
  const [tddScopeDropdownOptions, setTddScopeDropdownOptions] = useState([]);
  const [allTddScopeOptions, setAllTddScopeOptions] = useState([]);
  const [isTddScopeEditing, setIsTddScopeEditing] = useState(false);
  const [tddScopeSelections, setTddScopeSelections] = useState({});

  // Rcm Type Master
  const [rcmTypeTableData, setRcmTypeTableData] = useState([]);
  const [rcmTypeDropdownOptions, setRcmTypeDropdownOptions] = useState([]);
  const [allRcmTypeOptions, setAllRcmTypeOptions] = useState([]);
  const [isRcmTypeEditing, setIsRcmTypeEditing] = useState(false);
  const [rcmTypeSelections, setRcmTypeSelections] = useState({});

    // Exempt Reason Master
  const [exemptReasonTableData, setExemptReasonTableData] = useState([]);
  const [exemptReasonDropdownOptions, setExemptReasonDropdownOptions] = useState([]);
  const [allExemptReasonOptions, setAllExemptReasonOptions] = useState([]);
  const [isExemptReasonEditing, setIsExemptReasonEditing] = useState(false);
  const [exemptReasonSelections, setExemptReasonSelections] = useState({});

  // Currency Master

  const [currencyTableData, setCurrencyTableData] = useState([]);
  const [currencyDropdownOptions, setCurrencyDropdownOptions] = useState([]);
  const [allCurrencyOptions, setAllCurrencyOptions] = useState([]);
  const [isCurrencyEditing, setIsCurrencyEditing] = useState(false);
  const [currencySelections, setCurrencySelections] = useState({});

  // Unit Master
  const [unitTableData, setUnitTableData] = useState([]);
  const [unitDropdownOptions, setUnitDropdownOptions] = useState([]);
  const [allUnitOptions, setAllUnitOptions] = useState([]);
  const [isUnitEditing, setIsUnitEditing] = useState(false);
  const [unitSelections, setUnitSelections] = useState({});

  // VAT Master
  const [vatTableData, setVatTableData] = useState([]);
  const [vatDropdownOptions, setVatDropdownOptions] = useState([]);
  const [allVatOptions, setAllVatOptions] = useState([]);
  const [isVatEditing, setIsVatEditing] = useState(false);
  const [vatSelections, setVatSelections] = useState({});

  const fetchMasters = async () => {
    try {
      const response = await apiFetch(`${CONFIGURE_API_URL}/masters`);
      const result = await response.json();
      if (result.success) {
        setMasters(result.data);
      }
    } catch (error) {
      console.error('Error fetching masters:', error);
    }
  };

  const fetchStateMapping = async () => {
    try {
      const response = await apiFetch(`${CONFIGURE_API_URL}/state-mapping`);
      const result = await response.json();
      if (result.success) {
        setStateTableData(result.data.tableData);
        setStateDropdownOptions(result.data.dropdownOptions);
        setAllStateOptions(result.data.allEMStates || []);
        const initialSelections = {};
        result.data.tableData.forEach(item => {
          if (item.mappedTo) {
            initialSelections[item.id] = item.mappedTo;
          }
        });
        setStateSelections(initialSelections);
      }
    } catch (error) {
      console.error('Error fetching state mapping:', error);
    }
  };

  const fetchCountryMapping = async () => {
    try {
      const response = await apiFetch(`${CONFIGURE_API_URL}/country-mapping`);
      const result = await response.json();
      if (result.success) {
        setCountryTableData(result.data.tableData);
        setCountryDropdownOptions(result.data.dropdownOptions);
        setAllCountryOptions(result.data.allEMCountries || []);
        const initialSelections = {};
        result.data.tableData.forEach(item => {
          if (item.mappedTo) {
            initialSelections[item.id] = item.mappedTo;
          }
        });
        setCountrySelections(initialSelections);
      }
    } catch (error) {
      console.error('Error fetching country mapping:', error);
    }
  };

  const fetchPaymentMapping = async () => {
    try {
      const response = await apiFetch(`${CONFIGURE_API_URL}/payment-mapping`);
      const result = await response.json();
      if (result.success) {
        setPaymentTableData(result.data.tableData);
        setPaymentDropdownOptions(result.data.dropdownOptions);
        setAllPaymentOptions(result.data.allEMPaymentTypes || []);
        const initialSelections = {};
        result.data.tableData.forEach(item => {
          if (item.mappedTo) {
            initialSelections[item.id] = item.mappedTo;
          }
        });
        setPaymentSelections(initialSelections);
      }
    } catch (error) {
      console.error('Error fetching payment mapping:', error);
    }
  };

  const fetchInvoiceTypeMapping = async () => {
    try {
      const response = await apiFetch(`${CONFIGURE_API_URL}/invoice-type-mapping`);
      const result = await response.json();
      if (result.success) {
        setInvoiceTypeTableData(result.data.tableData);
        setInvoiceTypeDropdownOptions(result.data.dropdownOptions);
        setAllInvoiceTypeOptions(result.data.allEMInvoiceTypes || []);
        const initialSelections = {};
        result.data.tableData.forEach(item => {
          if (item.mappedTo) {
            initialSelections[item.id] = item.mappedTo;
          }
        });
        setInvoiceTypeSelections(initialSelections);
      }
    } catch (error) {
      console.error('Error fetching invoice type mapping:', error);
    }
  };

  const fetchElectronicAddressSchemeMapping = async () => {
    try {
      const response = await apiFetch(`${CONFIGURE_API_URL}/electronic-address-scheme-mapping`);
      const result = await response.json();
      if (result.success) {
        setElectronicAddressSchemeTableData(result.data.tableData);
        setElectronicAddressSchemeDropdownOptions(result.data.dropdownOptions);
        setAllElectronicAddressSchemeOptions(result.data.allEMElectronicAddressSchemes || []);
        const initialSelections = {};
        result.data.tableData.forEach(item => {
          if (item.mappedTo) {
            initialSelections[item.id] = item.mappedTo;
          }
        });
        setElectronicAddressSchemeSelections(initialSelections);
      }
    } catch (error) {
      console.error('Error fetching electronic address scheme mapping:', error);
    }
  };

  const fetchObjectIdentifierMapping = async () => {
    try {
      const response = await apiFetch(`${CONFIGURE_API_URL}/object-identifier-mapping`);
      const result = await response.json();
      if (result.success) {
        setObjectIdentifierTableData(result.data.tableData);
        setObjectIdentifierDropdownOptions(result.data.dropdownOptions);
        setAllObjectIdentifierOptions(result.data.allEMObjectIdentifiers || []);
        const initialSelections = {};
        result.data.tableData.forEach(item => {
          if (item.mappedTo) {
            initialSelections[item.id] = item.mappedTo;
          }
        });
        setObjectIdentifierSelections(initialSelections);
      }
    } catch (error) {
      console.error('Error fetching object identifier mapping:', error);
    }
  };

  const fetchInvoiceTransactionMapping = async () => {
    try {
      const response = await apiFetch(`${CONFIGURE_API_URL}/invoice-transaction-mapping`);
      const result = await response.json();
      if (result.success) {
        setInvoiceTransactionTableData(result.data.tableData);
        setInvoiceTransactionDropdownOptions(result.data.dropdownOptions);
        setAllInvoiceTransactionOptions(result.data.allEMInvoiceTransactionTypes || []);
        const initialSelections = {};
        result.data.tableData.forEach(item => {
          if (item.mappedTo) {
            initialSelections[item.id] = item.mappedTo;
          }
        });
        setInvoiceTransactionSelections(initialSelections);
      }
    } catch (error) {
      console.error('Error fetching invoice transaction mapping:', error);
    }
  };

  const fetchCreditNoteReasonMapping = async () => {
    try {
      const response = await apiFetch(`${CONFIGURE_API_URL}/credit-note-reason-mapping`);
      const result = await response.json();
      if (result.success) {
        setCreditNoteReasonTableData(result.data.tableData);
        setCreditNoteReasonDropdownOptions(result.data.dropdownOptions);
        setAllCreditNoteReasonOptions(result.data.allEMCreditNoteReasons || []);
        const initialSelections = {};
        result.data.tableData.forEach(item => {
          if (item.mappedTo) {
            initialSelections[item.id] = item.mappedTo;
          }
        });
        setCreditNoteReasonSelections(initialSelections);
      }
    } catch (error) {
      console.error('Error fetching credit note reason mapping:', error);
    }
  };

  const fetchChargesMapping = async () => {
    try {
      const response = await apiFetch(`${CONFIGURE_API_URL}/charges-mapping`);
      const result = await response.json();
      if (result.success) {
        setChargesTableData(result.data.tableData);
        setChargesDropdownOptions(result.data.dropdownOptions);
        setAllChargesOptions(result.data.allEMChargeCodes || []);
        const initialSelections = {};
        result.data.tableData.forEach(item => {
          if (item.mappedTo) {
            initialSelections[item.id] = item.mappedTo;
          }
        });
        setChargesSelections(initialSelections);
      }
    } catch (error) {
      console.error('Error fetching charges mapping:', error);
    }
  };

  const fetchTddScopeMapping = async () => {
    try {
      const response = await apiFetch(`${CONFIGURE_API_URL}/tdd-scope-mapping`);
      const result = await response.json();
      if (result.success) {
        setTddScopeTableData(result.data.tableData);
        setTddScopeDropdownOptions(result.data.dropdownOptions);
        setAllTddScopeOptions(result.data.allEMTddScopes || []);
        const initialSelections = {};
        result.data.tableData.forEach(item => {
          if (item.mappedTo) {
            initialSelections[item.id] = item.mappedTo;
          }
        });
        setTddScopeSelections(initialSelections);
      }
    } catch (error) {
      console.error('Error fetching TDD scope mapping:', error);
    }
  };

  const fetchRcmTypeMapping = async () => {
    try {
      const response = await apiFetch(`${CONFIGURE_API_URL}/rcm-type-mapping`);
      const result = await response.json();
      if (result.success) {
        setRcmTypeTableData(result.data.tableData);
        setRcmTypeDropdownOptions(result.data.dropdownOptions);
        setAllRcmTypeOptions(result.data.allEMGoodsServiceTypes || []);
        const initialSelections = {};
        result.data.tableData.forEach(item => {
          if (item.mappedTo) {
            initialSelections[item.id] = item.mappedTo;
          }
        });
        setRcmTypeSelections(initialSelections);
      }
    } catch (error) {
      console.error('Error fetching Rcm type mapping:', error);
    }
  };

    const fetchExemptReasonMapping = async () => {
    try {
      const response = await apiFetch(`${CONFIGURE_API_URL}/exempt-reason-mapping`);
      const result = await response.json();
      if (result.success) {
        setExemptReasonTableData(result.data.tableData);
        setExemptReasonDropdownOptions(result.data.dropdownOptions);
        setAllExemptReasonOptions(result.data.allEMVATExemptionReasons || []);
        const initialSelections = {};
        result.data.tableData.forEach(item => {
          if (item.mappedTo) {
            initialSelections[item.id] = item.mappedTo;
          }
        });
        setExemptReasonSelections(initialSelections);
      }
    } catch (error) {
      console.error('Error fetching exempt reason mapping:', error);
    }
  };

  const fetchCurrencyMapping = async () => {
    try {
      const response = await apiFetch(`${CONFIGURE_API_URL}/currency-mapping`);
      const result = await response.json();
      if (result.success) {
        setCurrencyTableData(result.data.tableData);
        setCurrencyDropdownOptions(result.data.dropdownOptions);
        setAllCurrencyOptions(result.data.allEMCurrencies || []);
        const initialSelections = {};
        result.data.tableData.forEach(item => {
          if (item.mappedTo) {
            initialSelections[item.id] = item.mappedTo;
          }
        });
        setCurrencySelections(initialSelections);
      }
    } catch (error) {
      console.error('Error fetching currency mapping:', error);
    }
  };

  const fetchUnitMapping = async () => {
    try {
      const response = await apiFetch(`${CONFIGURE_API_URL}/unit-mapping`);
      const result = await response.json();
      if (result.success) {
        setUnitTableData(result.data.tableData);
        setUnitDropdownOptions(result.data.dropdownOptions);
        setAllUnitOptions(result.data.allEMUnits || []);
        const initialSelections = {};
        result.data.tableData.forEach(item => {
          if (item.mappedTo) {
            initialSelections[item.id] = item.mappedTo;
          }
        });
        setUnitSelections(initialSelections);
      }
    } catch (error) {
      console.error('Error fetching unit mapping:', error);
    }
  };


  const fetchVatMapping = async () => {
    try {
      const response = await apiFetch(`${CONFIGURE_API_URL}/vat-mapping`);
      const result = await response.json();
      if (result.success) {
        setVatTableData(result.data.tableData);
        setVatDropdownOptions(result.data.dropdownOptions);
        setAllVatOptions(result.data.allEMVat || []);
        const initialSelections = {};
        result.data.tableData.forEach(item => {
          if (item.mappedTo) {
            initialSelections[item.id] = item.mappedTo;
          }
        });
        setVatSelections(initialSelections);
      }
    } catch (error) {
      console.error('Error fetching VAT mapping:', error);
    }
  };

  useEffect(() => {
    fetchMasters();
    fetchStateMapping();
    fetchCountryMapping();
    fetchPaymentMapping();
    fetchInvoiceTypeMapping();
    fetchElectronicAddressSchemeMapping();
    fetchObjectIdentifierMapping();
    fetchInvoiceTransactionMapping();
    fetchCreditNoteReasonMapping();
    fetchChargesMapping();
    fetchTddScopeMapping();
    fetchRcmTypeMapping();
    fetchExemptReasonMapping();
    fetchCurrencyMapping();
    fetchUnitMapping();
    fetchVatMapping();
  }, []);

  const toggleMaster = async (type, currentValue) => {
    const newValue = !currentValue;
    // Optimistic UI update
    if (type === 'State Master') {
      setMasters(prev => ({ ...prev, stateMaster: newValue }));
    } else if (type === 'Country Master') {
      setMasters(prev => ({ ...prev, countryMaster: newValue }));
    } else if (type === 'Payment Master') {
      setMasters(prev => ({ ...prev, paymentMaster: newValue }));
    // } else if (type === 'General Ledger Type Master') {
    //   setMasters(prev => ({ ...prev, generalLedgerMaster: newValue }));
    // } else if (type === 'Account Receivable Type Master') {
    //   setMasters(prev => ({ ...prev, accountReceivableMaster: newValue }));
    // } else if (type === 'Account Payable Type Master') {
    //   setMasters(prev => ({ ...prev, accountPayableMaster: newValue }));
    } else if (type === 'Invoice Type Master') {
      setMasters(prev => ({ ...prev, otherInvoiceTypeMaster: newValue }));
    } else if (type === 'Electronic Address Scheme Master') {
      setMasters(prev => ({ ...prev, electronicAddressSchemeMaster: newValue }));
    } else if (type === 'Object Identifier Master') {
      setMasters(prev => ({ ...prev, objectIdentifierMaster: newValue }));
    } else if (type === 'Invoice Transaction Master') {
      setMasters(prev => ({ ...prev, invoiceTransactionMaster: newValue }));
    } else if (type === 'Credit Note Reason Master') {
      setMasters(prev => ({ ...prev, creditNoteReasonMaster: newValue }));
    } else if (type === 'Charges Master') {
      setMasters(prev => ({ ...prev, chargesMaster: newValue }));
    } else if (type === 'TDD Scope Master') {
      setMasters(prev => ({ ...prev, tddScopeMaster: newValue }));
    } else if (type === 'Rcm Type Master') {
      setMasters(prev => ({ ...prev, rcmTypeMaster: newValue }));
      } else if (type === 'Exempt Reason Master') {
      setMasters(prev => ({ ...prev, exemptReasonMaster: newValue }));
    } else if (type === 'Unit Master') {
      setMasters(prev => ({ ...prev, unitMaster: newValue }));
    } else if (type === 'Vat Master') {
      setMasters(prev => ({ ...prev, vatMaster: newValue }));
    } else if (type === 'Currency Master') {
      setMasters(prev => ({ ...prev, currencyMaster: newValue }));
    }

    try {
      await apiFetch(`${CONFIGURE_API_URL}/masters`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, isActive: newValue })
      });
    } catch (error) {
      console.error('Error updating master:', error);
      // Revert on error
      if (type === 'State Master') {
        setMasters(prev => ({ ...prev, stateMaster: currentValue }));
      } else if (type === 'Country Master') {
        setMasters(prev => ({ ...prev, countryMaster: currentValue }));
      } else if (type === 'Payment Master') {
        setMasters(prev => ({ ...prev, paymentMaster: currentValue }));
      // } else if (type === 'General Ledger Type Master') {
      //   setMasters(prev => ({ ...prev, generalLedgerMaster: currentValue }));
      // } else if (type === 'Account Receivable Type Master') {
      //   setMasters(prev => ({ ...prev, accountReceivableMaster: currentValue }));
      // } else if (type === 'Account Payable Type Master') {
      //   setMasters(prev => ({ ...prev, accountPayableMaster: currentValue }));
      } else if (type === 'Invoice Type Master') {
        setMasters(prev => ({ ...prev, otherInvoiceTypeMaster: currentValue }));
      } else if (type === 'Electronic Address Scheme Master') {
        setMasters(prev => ({ ...prev, electronicAddressSchemeMaster: currentValue }));
      } else if (type === 'Object Identifier Master') {
        setMasters(prev => ({ ...prev, objectIdentifierMaster: currentValue }));
      } else if (type === 'Invoice Transaction Master') {
        setMasters(prev => ({ ...prev, invoiceTransactionMaster: currentValue }));
      } else if (type === 'Credit Note Reason Master') {
        setMasters(prev => ({ ...prev, creditNoteReasonMaster: currentValue }));
      } else if (type === 'Charges Master') {
        setMasters(prev => ({ ...prev, chargesMaster: currentValue }));
      } else if (type === 'TDD Scope Master') {
        setMasters(prev => ({ ...prev, tddScopeMaster: currentValue }));
      } else if (type === 'Rcm Type Master') {
        setMasters(prev => ({ ...prev, rcmTypeMaster: currentValue }));
        } else if (type === 'Exempt Reason Master') {
        setMasters(prev => ({ ...prev, exemptReasonMaster: currentValue }));
      } else if (type === 'Unit Master') {
        setMasters(prev => ({ ...prev, unitMaster: currentValue }));
      } else if (type === 'Vat Master') {
        setMasters(prev => ({ ...prev, vatMaster: currentValue }));
      } else if (type === 'Currency Master') {
        setMasters(prev => ({ ...prev, currencyMaster: currentValue }));
      }
    }
  };

  const handleStateSelectionChange = (id, selectedOption) => {
    setStateSelections(prev => {
      const newSelections = { ...prev };
      if (!selectedOption || !selectedOption.value || selectedOption.value === 'none') {
        newSelections[id] = null;
      } else {
        newSelections[id] = selectedOption.value;
      }
      return newSelections;
    });
  };

  const handleCountrySelectionChange = (id, selectedOption) => {
    setCountrySelections(prev => {
      const newSelections = { ...prev };
      if (!selectedOption || !selectedOption.value || selectedOption.value === 'none') {
        newSelections[id] = null;
      } else {
        newSelections[id] = selectedOption.value;
      }
      return newSelections;
    });
  };

  const handlePaymentSelectionChange = (id, selectedOption) => {
    setPaymentSelections(prev => {
      const newSelections = { ...prev };
      if (!selectedOption || !selectedOption.value || selectedOption.value === 'none') {
        newSelections[id] = null;
      } else {
        newSelections[id] = parseInt(selectedOption.value, 10);
      }
      return newSelections;
    });
  };

  const handleInvoiceTypeSelectionChange = (id, selectedOption) => {
    setInvoiceTypeSelections(prev => {
      const newSelections = { ...prev };
      if (!selectedOption || !selectedOption.value || selectedOption.value === 'none') {
        newSelections[id] = null;
      } else {
        newSelections[id] = parseInt(selectedOption.value, 10);
      }
      return newSelections;
    });
  };

  const handleElectronicAddressSchemeSelectionChange = (id, selectedOption) => {
    setElectronicAddressSchemeSelections(prev => {
      const newSelections = { ...prev };
      if (!selectedOption || !selectedOption.value || selectedOption.value === 'none') {
        newSelections[id] = null;
      } else {
        newSelections[id] = parseInt(selectedOption.value, 10);
      }
      return newSelections;
    });
  };

  const handleObjectIdentifierSelectionChange = (id, selectedOption) => {
    setObjectIdentifierSelections(prev => {
      const newSelections = { ...prev };
      if (!selectedOption || !selectedOption.value || selectedOption.value === 'none') {
        newSelections[id] = null;
      } else {
        newSelections[id] = parseInt(selectedOption.value, 10);
      }
      return newSelections;
    });
  };

  const getInvoiceTypeGroupRows = (moduleId) => {
    if (moduleId === 'other') {
      return invoiceTypeTableData.filter(row => ![4, 5, 6].includes(row.iModule));
    }
    return invoiceTypeTableData.filter(row => row.iModule === moduleId);
  };

  const saveInvoiceTypeMappingByGroup = async (moduleId) => {
    try {
      const groupRows = getInvoiceTypeGroupRows(moduleId);
      const mappings = groupRows.map(row => ({
        AutoIndex: invoiceTypeSelections[row.id] || 0,
        Mapping: String(row.id)
      }));

      const response = await apiFetch(`${CONFIGURE_API_URL}/invoice-type-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings })
      });
      const result = await response.json();
      if (result.success) {
        setInvoiceTypeGroupEditing(prev => ({ ...prev, [moduleId]: false }));
        // Add a small delay to ensure database transaction completes
        setTimeout(() => {
          fetchInvoiceTypeMapping();
        }, 500);
      }
    } catch (error) {
      console.error('Error saving invoice type mapping:', error);
    }
  };

  const cancelInvoiceTypeGroupEdit = (moduleId) => {
    setInvoiceTypeGroupEditing(prev => ({ ...prev, [moduleId]: false }));
    fetchInvoiceTypeMapping();
  };

  const handleInvoiceTransactionSelectionChange = (id, selectedOption) => {
    setInvoiceTransactionSelections(prev => {
      const newSelections = { ...prev };
      if (!selectedOption || !selectedOption.value || selectedOption.value === 'none') {
        newSelections[id] = null;
      } else {
        newSelections[id] = parseInt(selectedOption.value, 10);
      }
      return newSelections;
    });
  };

  const handleCreditNoteReasonSelectionChange = (id, selectedOption) => {
    setCreditNoteReasonSelections(prev => {
      const newSelections = { ...prev };
      if (!selectedOption || !selectedOption.value || selectedOption.value === 'none') {
        newSelections[id] = null;
      } else {
        newSelections[id] = parseInt(selectedOption.value, 10);
      }
      return newSelections;
    });
  };

  const handleChargesSelectionChange = (id, selectedOption) => {
    setChargesSelections(prev => {
      const newSelections = { ...prev };
      if (!selectedOption || !selectedOption.value || selectedOption.value === 'none') {
        newSelections[id] = null;
      } else {
        newSelections[id] = parseInt(selectedOption.value, 10);
      }
      return newSelections;
    });
  };

  const handleTddScopeSelectionChange = (id, selectedOption) => {
    setTddScopeSelections(prev => {
      const newSelections = { ...prev };
      if (!selectedOption || !selectedOption.value || selectedOption.value === 'none') {
        newSelections[id] = null;
      } else {
        newSelections[id] = parseInt(selectedOption.value, 10);
      }
      return newSelections;
    });
  };

  const handleRcmTypeSelectionChange = (id, selectedOption) => {
    setRcmTypeSelections(prev => {
      const newSelections = { ...prev };
      if (!selectedOption || !selectedOption.value || selectedOption.value === 'none') {
        newSelections[id] = null;
      } else {
        newSelections[id] = parseInt(selectedOption.value, 10);
      }
      return newSelections;
    });
  };

   const handleExemptReasonSelectionChange = (id, selectedOption) => {
    setExemptReasonSelections(prev => {
      const newSelections = { ...prev };
      if (!selectedOption || !selectedOption.value || selectedOption.value === 'none') {
        newSelections[id] = null;
      } else {
        newSelections[id] = parseInt(selectedOption.value, 10);
      }
      return newSelections;
    });
  };

  const handleCurrencySelectionChange = (id, selectedOption) => {
    setCurrencySelections(prev => {
      const newSelections = { ...prev };
      if (!selectedOption || !selectedOption.value || selectedOption.value === 'none') {
        newSelections[id] = null;
      } else {
        newSelections[id] = parseInt(selectedOption.value, 10);
      }
      return newSelections;
    });
  };

  const handleUnitSelectionChange = (id, selectedOption) => {
    setUnitSelections(prev => {
      const newSelections = { ...prev };
      if (!selectedOption || !selectedOption.value || selectedOption.value === 'none') {
        newSelections[id] = null;
      } else {
        newSelections[id] = parseInt(selectedOption.value, 10);
      }
      return newSelections;
    });
  };

  const handleVatSelectionChange = (id, selectedOption) => {
    setVatSelections(prev => {
      const newSelections = { ...prev };
      if (!selectedOption || !selectedOption.value || selectedOption.value === 'none') {
        newSelections[id] = null;
      } else {
        newSelections[id] = parseInt(selectedOption.value, 10);
      }
      return newSelections;
    });
  };

  const saveStateMapping = async () => {
    try {
      const mappings = Object.keys(stateSelections).map(id => ({
        AutoIndex: stateSelections[id] || 0,
        Mapping: id
      }));

      const response = await apiFetch(`${CONFIGURE_API_URL}/state-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings })
      });
      const result = await response.json();
      if (result.success) {
        setIsStateEditing(false);
        fetchStateMapping(); // refresh data
      }
    } catch (error) {
      console.error('Error saving state mapping:', error);
    }
  };

  const saveCountryMapping = async () => {
    try {
      const mappings = Object.keys(countrySelections).map(id => ({
        AutoIndex: countrySelections[id] || 0,
        Mapping: id
      }));

      const response = await apiFetch(`${CONFIGURE_API_URL}/country-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings })
      });
      const result = await response.json();
      if (result.success) {
        setIsCountryEditing(false);
        fetchCountryMapping();
      }
    } catch (error) {
      console.error('Error saving country mapping:', error);
    }
  };

  const savePaymentMapping = async () => {
    try {
      const mappings = Object.keys(paymentSelections).map(id => ({
        AutoIndex: paymentSelections[id] || 0,
        Mapping: id // Keep as string since it's varchar
      }));

      const response = await apiFetch(`${CONFIGURE_API_URL}/payment-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings })
      });
      const result = await response.json();
      if (result.success) {
        setIsPaymentEditing(false);
        fetchPaymentMapping();
      }
    } catch (error) {
      console.error('Error saving payment mapping:', error);
    }
  };

  const saveInvoiceTransactionMapping = async () => {
    try {
      const mappings = Object.keys(invoiceTransactionSelections).map(id => ({
        AutoIndex: invoiceTransactionSelections[id] || 0,
        Mapping: id // Keep as string since it's varchar
      }));

      const response = await apiFetch(`${CONFIGURE_API_URL}/invoice-transaction-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings })
      });
      const result = await response.json();
      if (result.success) {
        setIsInvoiceTransactionEditing(false);
        fetchInvoiceTransactionMapping();
      }
    } catch (error) {
      console.error('Error saving invoice transaction mapping:', error);
    }
  };

  const saveElectronicAddressSchemeMapping = async () => {
    try {
      const mappings = Object.keys(electronicAddressSchemeSelections).map(id => ({
        AutoIndex: electronicAddressSchemeSelections[id] || 0,
        Mapping: id
      }));

      const response = await apiFetch(`${CONFIGURE_API_URL}/electronic-address-scheme-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings })
      });
      const result = await response.json();
      if (result.success) {
        setIsElectronicAddressSchemeEditing(false);
        fetchElectronicAddressSchemeMapping();
      }
    } catch (error) {
      console.error('Error saving electronic address scheme mapping:', error);
    }
  };

  const saveObjectIdentifierMapping = async () => {
    try {
      const mappings = Object.keys(objectIdentifierSelections).map(id => ({
        AutoIndex: objectIdentifierSelections[id] || 0,
        Mapping: id
      }));

      const response = await apiFetch(`${CONFIGURE_API_URL}/object-identifier-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings })
      });
      const result = await response.json();
      if (result.success) {
        setIsObjectIdentifierEditing(false);
        fetchObjectIdentifierMapping();
      }
    } catch (error) {
      console.error('Error saving object identifier mapping:', error);
    }
  };

  const saveCreditNoteReasonMapping = async () => {
    try {
      const mappings = Object.keys(creditNoteReasonSelections).map(id => ({
        AutoIndex: creditNoteReasonSelections[id] || 0,
        Mapping: id
      }));

      const response = await apiFetch(`${CONFIGURE_API_URL}/credit-note-reason-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings })
      });
      const result = await response.json();
      if (result.success) {
        setIsCreditNoteReasonEditing(false);
        fetchCreditNoteReasonMapping();
      }
    } catch (error) {
      console.error('Error saving credit note reason mapping:', error);
    }
  };

  const saveChargesMapping = async () => {
    try {
      const mappings = Object.keys(chargesSelections).map(id => ({
        AutoIndex: chargesSelections[id] || 0,
        Mapping: id
      }));

      const response = await apiFetch(`${CONFIGURE_API_URL}/charges-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings })
      });
      const result = await response.json();
      if (result.success) {
        setIsChargesEditing(false);
        fetchChargesMapping();
      }
    } catch (error) {
      console.error('Error saving charges mapping:', error);
    }
  };

  const saveTddScopeMapping = async () => {
    try {
      const mappings = Object.keys(tddScopeSelections).map(id => ({
        AutoIndex: tddScopeSelections[id] || 0,
        Mapping: id
      }));

      const response = await apiFetch(`${CONFIGURE_API_URL}/tdd-scope-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings })
      });
      const result = await response.json();
      if (result.success) {
        setIsTddScopeEditing(false);
        fetchTddScopeMapping();
      }
    } catch (error) {
      console.error('Error saving TDD scope mapping:', error);
    }
  };

  const saveRcmTypeMapping = async () => {
    try {
      const mappings = Object.keys(rcmTypeSelections).map(id => ({
        AutoIndex: rcmTypeSelections[id] || 0,
        Mapping: id
      }));

      const response = await apiFetch(`${CONFIGURE_API_URL}/rcm-type-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings })
      });
      const result = await response.json();
      if (result.success) {
        setIsRcmTypeEditing(false);
        fetchRcmTypeMapping();
      }
    } catch (error) {
      console.error('Error saving Rcm type mapping:', error);
    }
  };

   const saveExemptReasonMapping = async () => {
    try {
      const mappings = Object.keys(exemptReasonSelections).map(id => ({
        AutoIndex: exemptReasonSelections[id] || 0,
        Mapping: id
      }));

      const response = await apiFetch(`${CONFIGURE_API_URL}/exempt-reason-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings })
      });
      const result = await response.json();
      if (result.success) {
        setIsExemptReasonEditing(false);
        fetchExemptReasonMapping();
      }
    } catch (error) {
      console.error('Error saving exempt reason mapping:', error);
    }
  };


  const saveUnitMapping = async () => {
    try {
      const mappings = Object.keys(unitSelections).map(id => ({
        AutoIndex: unitSelections[id] || 0,
        Mapped: parseInt(id, 10)
      }));

      const response = await apiFetch(`${CONFIGURE_API_URL}/unit-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings })
      });
      const result = await response.json();
      if (result.success) {
        setIsUnitEditing(false);
        fetchUnitMapping(); // refresh data
      }
    } catch (error) {
      console.error('Error saving unit mapping:', error);
    }
  };

  const saveCurrencyMapping = async () => {
    try {
      const mappings = Object.keys(currencySelections).map(id => ({
        AutoIndex: currencySelections[id] || 0,
        Mapped: parseInt(id, 10)
      }));

      const response = await apiFetch(`${CONFIGURE_API_URL}/currency-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings })
      });
      const result = await response.json();
      if (result.success) {
        setIsCurrencyEditing(false);
        fetchCurrencyMapping(); // refresh data
      }
    } catch (error) {
      console.error('Error saving currency mapping:', error);
    }
  };

  const saveVatMapping = async () => {
    try {
      const mappings = Object.keys(vatSelections).map(id => ({
        AutoIndex: vatSelections[id] || 0,
        Mapped: parseInt(id, 10)
      }));

      const response = await apiFetch(`${CONFIGURE_API_URL}/vat-mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings })
      });
      const result = await response.json();
      if (result.success) {
        setIsVatEditing(false);
        fetchVatMapping();
      }
    } catch (error) {
      console.error('Error saving VAT mapping:', error);
    }
  };

  const getSelectOptions = (options, currentSelection, allSelections, allDataOptions) => {
    // Filter out options that are already selected by OTHER rows
    const selectedValues = Object.values(allSelections).filter(val => val !== null);
    const availableOptions = options.filter(opt => !selectedValues.includes(opt.AutoIndex));

    const formattedOptions = availableOptions.map(opt => ({
      value: opt.AutoIndex,
      label: opt.DisplayName
    }));

    formattedOptions.unshift({ value: 'none', label: 'None' });

    if (currentSelection && currentSelection !== 'none') {
      const exists = formattedOptions.find(o => o.value === currentSelection);
      if (!exists) {
        // Find name from all data
        const originalOpt = allDataOptions.find(o => o.AutoIndex === currentSelection);
        if (originalOpt) {
          formattedOptions.splice(1, 0, { value: currentSelection, label: originalOpt.DisplayName });
        }
      }
    }

    return formattedOptions;
  };

  const getSelectValue = (currentSelection, options) => {
    if (currentSelection === null || currentSelection === undefined) return null;
    if (currentSelection === 0) return options.find(o => o.value === 'none') || null;
    return options.find(o => o.value === currentSelection) || null;
  };

  // Custom styles for react-select
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: '32px',
      fontSize: '0.85rem',
      borderRadius: '6px',
      borderColor: state.isFocused ? 'var(--primary)' : 'var(--border-color)',
      backgroundColor: 'var(--bg-surface)',
      boxShadow: state.isFocused ? '0 0 0 1px var(--primary)' : 'none',
      '&:hover': {
        borderColor: 'var(--primary)'
      }
    }),
    valueContainer: (base) => ({
      ...base,
      padding: '0 8px'
    }),
    singleValue: (base) => ({
      ...base,
      color: 'var(--text-primary)'
    }),
    input: (base) => ({
      ...base,
      color: 'var(--text-primary)'
    }),
    placeholder: (base) => ({
      ...base,
      color: 'var(--text-muted)'
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-md)'
    }),
    option: (base, state) => ({
      ...base,
      fontSize: '0.85rem',
      backgroundColor: state.isSelected
        ? 'var(--primary)'
        : state.isFocused
          ? 'var(--bg-surface-hover)'
          : 'var(--bg-surface)',
      color: state.isSelected ? '#ffffff' : 'var(--text-primary)',
      cursor: 'pointer'
    }),
    dropdownIndicator: (base) => ({
      ...base,
      color: 'var(--text-secondary)',
      '&:hover': {
        color: 'var(--text-primary)'
      }
    }),
    clearIndicator: (base) => ({
      ...base,
      color: 'var(--text-secondary)',
      '&:hover': {
        color: 'var(--error)'
      }
    }),
    indicatorSeparator: (base) => ({
      ...base,
      backgroundColor: 'var(--border-color)'
    }),
    menuPortal: (base) => ({
      ...base,
      zIndex: 9999
    })
  };

  return (
    <div className="configure-page fade-in">
      <div className="configure-header">
        <h1>Master Configuration</h1>
      </div>

      <div className="configure-tables-container">

        {/* STATE MASTER TABLE */}
        <div className="configure-card">
          <div className="card-header">
            <h2>State Master</h2>
            {masters.stateMaster && (
              <div className="card-actions">
                {!isStateEditing ? (
                  <button className="btn-edit" onClick={() => setIsStateEditing(true)}>Edit</button>
                ) : (
                  <>
                    <button className="btn-cancel" onClick={() => { setIsStateEditing(false); fetchStateMapping(); }}>Cancel</button>
                    <button className="btn-save" onClick={saveStateMapping}>Save</button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="toggle-row">
            <span>Do you have State?</span>
            <button
              className={`toggle-btn ${masters.stateMaster ? 'active' : ''}`}
              onClick={() => toggleMaster('State Master', masters.stateMaster)}
            >
              <div className="toggle-slider"></div>
            </button>
            <span className="toggle-label">{masters.stateMaster ? 'Yes' : 'No'}</span>
          </div>

          {masters.stateMaster && (
            <div className="table-wrapper">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>SlNo</th>
                    <th>Existing Master</th>
                    <th>Status</th>
                    <th>Mapped Master</th>
                  </tr>
                </thead>
                <tbody>
                  {stateTableData.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td>{row.description}</td>
                      <td>
                        <span className={`status-badge ${row.status || stateSelections[row.id] ? 'mapped' : 'not-mapped'}`}>
                          {row.status || stateSelections[row.id] ? 'Mapped' : 'Not Mapped'}
                        </span>
                      </td>
                      <td>
                        {isStateEditing ? (
                          <Select
                            options={getSelectOptions(stateDropdownOptions, stateSelections[row.id], stateSelections, allStateOptions)}
                            value={getSelectValue(stateSelections[row.id], getSelectOptions(stateDropdownOptions, stateSelections[row.id], stateSelections, allStateOptions))}
                            onChange={(option) => handleStateSelectionChange(row.id, option)}
                            isClearable={true}
                            isSearchable={true}
                            placeholder="Select mapping..."
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                          />
                        ) : (
                          <span>{row.mappedDisplayName || (stateSelections[row.id] && allStateOptions.find(o => o.AutoIndex === stateSelections[row.id])?.DisplayName) || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* COUNTRY MASTER TABLE */}
        <div className="configure-card">
          <div className="card-header">
            <h2>Country Master</h2>
            {masters.countryMaster && (
              <div className="card-actions">
                {!isCountryEditing ? (
                  <button className="btn-edit" onClick={() => setIsCountryEditing(true)}>Edit</button>
                ) : (
                  <>
                    <button className="btn-cancel" onClick={() => { setIsCountryEditing(false); fetchCountryMapping(); }}>Cancel</button>
                    <button className="btn-save" onClick={saveCountryMapping}>Save</button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="toggle-row">
            <span>Do you have Country?</span>
            <button
              className={`toggle-btn ${masters.countryMaster ? 'active' : ''}`}
              onClick={() => toggleMaster('Country Master', masters.countryMaster)}
            >
              <div className="toggle-slider"></div>
            </button>
            <span className="toggle-label">{masters.countryMaster ? 'Yes' : 'No'}</span>
          </div>

          {masters.countryMaster && (
            <div className="table-wrapper">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>SlNo</th>
                    <th>Existing Master</th>
                    <th>Status</th>
                    <th>Mapped Master</th>
                  </tr>
                </thead>
                <tbody>
                  {countryTableData.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td>{row.description}</td>
                      <td>
                        <span className={`status-badge ${row.status || countrySelections[row.id] ? 'mapped' : 'not-mapped'}`}>
                          {row.status || countrySelections[row.id] ? 'Mapped' : 'Not Mapped'}
                        </span>
                      </td>
                      <td>
                        {isCountryEditing ? (
                          <Select
                            options={getSelectOptions(countryDropdownOptions, countrySelections[row.id], countrySelections, allCountryOptions)}
                            value={getSelectValue(countrySelections[row.id], getSelectOptions(countryDropdownOptions, countrySelections[row.id], countrySelections, allCountryOptions))}
                            onChange={(option) => handleCountrySelectionChange(row.id, option)}
                            isClearable={true}
                            isSearchable={true}
                            placeholder="Select mapping..."
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                          />
                        ) : (
                          <span>{row.mappedDisplayName || (countrySelections[row.id] && allCountryOptions.find(o => o.AutoIndex === countrySelections[row.id])?.DisplayName) || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PAYMENT MASTER TABLE */}
        <div className="configure-card">
          <div className="card-header">
            <h2>Payment Master</h2>
            {masters.paymentMaster && (
              <div className="card-actions">
                {!isPaymentEditing ? (
                  <button className="btn-edit" onClick={() => setIsPaymentEditing(true)}>Edit</button>
                ) : (
                  <>
                    <button className="btn-cancel" onClick={() => { setIsPaymentEditing(false); fetchPaymentMapping(); }}>Cancel</button>
                    <button className="btn-save" onClick={savePaymentMapping}>Save</button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="toggle-row">
            <span>Do you have Payment Type?</span>
            <button
              className={`toggle-btn ${masters.paymentMaster ? 'active' : ''}`}
              onClick={() => toggleMaster('Payment Master', masters.paymentMaster)}
            >
              <div className="toggle-slider"></div>
            </button>
            <span className="toggle-label">{masters.paymentMaster ? 'Yes' : 'No'}</span>
          </div>

          {masters.paymentMaster && (
            <div className="table-wrapper">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>SlNo</th>
                    <th>Existing Master</th>
                    <th>Status</th>
                    <th>Mapped Master</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentTableData.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td>{row.description}</td>
                      <td>
                        <span className={`status-badge ${row.status || paymentSelections[row.id] ? 'mapped' : 'not-mapped'}`}>
                          {row.status || paymentSelections[row.id] ? 'Mapped' : 'Not Mapped'}
                        </span>
                      </td>
                      <td>
                        {isPaymentEditing ? (
                          <Select
                            options={getSelectOptions(paymentDropdownOptions, paymentSelections[row.id], paymentSelections, allPaymentOptions)}
                            value={getSelectValue(paymentSelections[row.id], getSelectOptions(paymentDropdownOptions, paymentSelections[row.id], paymentSelections, allPaymentOptions))}
                            onChange={(option) => handlePaymentSelectionChange(row.id, option)}
                            isClearable={true}
                            isSearchable={true}
                            placeholder="Select mapping..."
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                          />
                        ) : (
                          <span>{row.mappedDisplayName || (paymentSelections[row.id] && allPaymentOptions.find(o => o.AutoIndex === paymentSelections[row.id])?.DisplayName) || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* GENERAL LEDGER TYPE MASTER TABLE */}
        {/* <div className="configure-card">
          <div className="card-header">
            <h2>General Ledger Type Master</h2>
            {masters.generalLedgerMaster && (
              <div className="card-actions">
                {!invoiceTypeGroupEditing[4] ? (
                  <button className="btn-edit" onClick={() => setInvoiceTypeGroupEditing(prev => ({ ...prev, 4: true }))}>Edit</button>
                ) : (
                  <>
                    <button className="btn-cancel" onClick={() => cancelInvoiceTypeGroupEdit(4)}>Cancel</button>
                    <button className="btn-save" onClick={() => saveInvoiceTypeMappingByGroup(4)}>Save</button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="toggle-row">
            <span>Do you have General Ledger Type?</span>
            <button
              className={`toggle-btn ${masters.generalLedgerMaster ? 'active' : ''}`}
              onClick={() => toggleMaster('General Ledger Type Master', masters.generalLedgerMaster)}
            >
              <div className="toggle-slider"></div>
            </button>
            <span className="toggle-label">{masters.generalLedgerMaster ? 'Yes' : 'No'}</span>
          </div>

          {masters.generalLedgerMaster && (
            <div className="table-wrapper">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>SlNo</th>
                    <th>Existing Master</th>
                    <th>Status</th>
                    <th>Mapped Master</th>
                  </tr>
                </thead>
                <tbody>
                  {getInvoiceTypeGroupRows(4).map((row, index) => (
                    <tr key={`4-${row.id}`}>
                      <td>{index + 1}</td>
                      <td>{row.description}</td>
                      <td>
                        <span className={`status-badge ${row.status || invoiceTypeSelections[row.id] ? 'mapped' : 'not-mapped'}`}>
                          {row.status || invoiceTypeSelections[row.id] ? 'Mapped' : 'Not Mapped'}
                        </span>
                      </td>
                      <td>
                        {invoiceTypeGroupEditing[4] ? (
                          <Select
                            options={getSelectOptions(invoiceTypeDropdownOptions, invoiceTypeSelections[row.id], invoiceTypeSelections, allInvoiceTypeOptions)}
                            value={getSelectValue(invoiceTypeSelections[row.id], getSelectOptions(invoiceTypeDropdownOptions, invoiceTypeSelections[row.id], invoiceTypeSelections, allInvoiceTypeOptions))}
                            onChange={(option) => handleInvoiceTypeSelectionChange(row.id, option)}
                            isClearable={true}
                            isSearchable={true}
                            placeholder="Select mapping..."
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                          />
                        ) : (
                          <span>{row.mappedDisplayName || (invoiceTypeSelections[row.id] && allInvoiceTypeOptions.find(o => o.AutoIndex === invoiceTypeSelections[row.id])?.DisplayName) || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div> */}

        {/* ACCOUNT RECEIVABLE TYPE MASTER TABLE */}
        {/* <div className="configure-card">
          <div className="card-header">
            <h2>Account Receivable Type Master</h2>
            {masters.accountReceivableMaster && (
              <div className="card-actions">
                {!invoiceTypeGroupEditing[5] ? (
                  <button className="btn-edit" onClick={() => setInvoiceTypeGroupEditing(prev => ({ ...prev, 5: true }))}>Edit</button>
                ) : (
                  <>
                    <button className="btn-cancel" onClick={() => cancelInvoiceTypeGroupEdit(5)}>Cancel</button>
                    <button className="btn-save" onClick={() => saveInvoiceTypeMappingByGroup(5)}>Save</button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="toggle-row">
            <span>Do you have Account Receivable Type?</span>
            <button
              className={`toggle-btn ${masters.accountReceivableMaster ? 'active' : ''}`}
              onClick={() => toggleMaster('Account Receivable Type Master', masters.accountReceivableMaster)}
            >
              <div className="toggle-slider"></div>
            </button>
            <span className="toggle-label">{masters.accountReceivableMaster ? 'Yes' : 'No'}</span>
          </div>

          {masters.accountReceivableMaster && (
            <div className="table-wrapper">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>SlNo</th>
                    <th>Existing Master</th>
                    <th>Status</th>
                    <th>Mapped Master</th>
                  </tr>
                </thead>
                <tbody>
                  {getInvoiceTypeGroupRows(5).map((row, index) => (
                    <tr key={`5-${row.id}`}>
                      <td>{index + 1}</td>
                      <td>{row.description}</td>
                      <td>
                        <span className={`status-badge ${row.status || invoiceTypeSelections[row.id] ? 'mapped' : 'not-mapped'}`}>
                          {row.status || invoiceTypeSelections[row.id] ? 'Mapped' : 'Not Mapped'}
                        </span>
                      </td>
                      <td>
                        {invoiceTypeGroupEditing[5] ? (
                          <Select
                            options={getSelectOptions(invoiceTypeDropdownOptions, invoiceTypeSelections[row.id], invoiceTypeSelections, allInvoiceTypeOptions)}
                            value={getSelectValue(invoiceTypeSelections[row.id], getSelectOptions(invoiceTypeDropdownOptions, invoiceTypeSelections[row.id], invoiceTypeSelections, allInvoiceTypeOptions))}
                            onChange={(option) => handleInvoiceTypeSelectionChange(row.id, option)}
                            isClearable={true}
                            isSearchable={true}
                            placeholder="Select mapping..."
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                          />
                        ) : (
                          <span>{row.mappedDisplayName || (invoiceTypeSelections[row.id] && allInvoiceTypeOptions.find(o => o.AutoIndex === invoiceTypeSelections[row.id])?.DisplayName) || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div> */}

        {/* ACCOUNT PAYABLE TYPE MASTER TABLE */}
        {/* <div className="configure-card">
          <div className="card-header">
            <h2>Account Payable Type Master</h2>
            {masters.accountPayableMaster && (
              <div className="card-actions">
                {!invoiceTypeGroupEditing[6] ? (
                  <button className="btn-edit" onClick={() => setInvoiceTypeGroupEditing(prev => ({ ...prev, 6: true }))}>Edit</button>
                ) : (
                  <>
                    <button className="btn-cancel" onClick={() => cancelInvoiceTypeGroupEdit(6)}>Cancel</button>
                    <button className="btn-save" onClick={() => saveInvoiceTypeMappingByGroup(6)}>Save</button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="toggle-row">
            <span>Do you have Account Payable Type?</span>
            <button
              className={`toggle-btn ${masters.accountPayableMaster ? 'active' : ''}`}
              onClick={() => toggleMaster('Account Payable Type Master', masters.accountPayableMaster)}
            >
              <div className="toggle-slider"></div>
            </button>
            <span className="toggle-label">{masters.accountPayableMaster ? 'Yes' : 'No'}</span>
          </div>

          {masters.accountPayableMaster && (
            <div className="table-wrapper">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>SlNo</th>
                    <th>Existing Master</th>
                    <th>Status</th>
                    <th>Mapped Master</th>
                  </tr>
                </thead>
                <tbody>
                  {getInvoiceTypeGroupRows(6).map((row, index) => (
                    <tr key={`6-${row.id}`}>
                      <td>{index + 1}</td>
                      <td>{row.description}</td>
                      <td>
                        <span className={`status-badge ${row.status || invoiceTypeSelections[row.id] ? 'mapped' : 'not-mapped'}`}>
                          {row.status || invoiceTypeSelections[row.id] ? 'Mapped' : 'Not Mapped'}
                        </span>
                      </td>
                      <td>
                        {invoiceTypeGroupEditing[6] ? (
                          <Select
                            options={getSelectOptions(invoiceTypeDropdownOptions, invoiceTypeSelections[row.id], invoiceTypeSelections, allInvoiceTypeOptions)}
                            value={getSelectValue(invoiceTypeSelections[row.id], getSelectOptions(invoiceTypeDropdownOptions, invoiceTypeSelections[row.id], invoiceTypeSelections, allInvoiceTypeOptions))}
                            onChange={(option) => handleInvoiceTypeSelectionChange(row.id, option)}
                            isClearable={true}
                            isSearchable={true}
                            placeholder="Select mapping..."
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                          />
                        ) : (
                          <span>{row.mappedDisplayName || (invoiceTypeSelections[row.id] && allInvoiceTypeOptions.find(o => o.AutoIndex === invoiceTypeSelections[row.id])?.DisplayName) || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div> */}

        {/* OTHER INVOICE TYPE MASTER TABLE */}
       {/* <div className="configure-card">
          <div className="card-header">
            <h2>Invoice Type Master</h2>
            {masters.otherInvoiceTypeMaster && (
              <div className="card-actions">
                {!invoiceTypeGroupEditing['other'] ? (
                  <button className="btn-edit" onClick={() => setInvoiceTypeGroupEditing(prev => ({ ...prev, other: true }))}>Edit</button>
                ) : (
                  <>
                    <button className="btn-cancel" onClick={() => cancelInvoiceTypeGroupEdit('other')}>Cancel</button>
                    <button className="btn-save" onClick={() => saveInvoiceTypeMappingByGroup('other')}>Save</button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="toggle-row">
            <span>Do you have  Invoice Type?</span>
            <button
              className={`toggle-btn ${masters.otherInvoiceTypeMaster ? 'active' : ''}`}
              onClick={() => toggleMaster('Other Invoice Type Master', masters.otherInvoiceTypeMaster)}
            >
              <div className="toggle-slider"></div>
            </button>
            <span className="toggle-label">{masters.otherInvoiceTypeMaster ? 'Yes' : 'No'}</span>
          </div>

          {masters.otherInvoiceTypeMaster && (
            <div className="table-wrapper">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>SlNo</th>
                    <th>Existing Master</th>
                    <th>Status</th>
                    <th>Mapped Master</th>
                  </tr>
                </thead>
                <tbody>
                  {getInvoiceTypeGroupRows('other').map((row, index) => (
                    <tr key={`other-${row.id}`}>
                      <td>{index + 1}</td>
                      <td>{row.description}</td>
                      <td>
                        <span className={`status-badge ${row.status || invoiceTypeSelections[row.id] ? 'mapped' : 'not-mapped'}`}>
                          {row.status || invoiceTypeSelections[row.id] ? 'Mapped' : 'Not Mapped'}
                        </span>
                      </td>
                      <td>
                        {invoiceTypeGroupEditing['other'] ? (
                          <Select
                            options={getSelectOptions(invoiceTypeDropdownOptions, invoiceTypeSelections[row.id], invoiceTypeSelections, allInvoiceTypeOptions)}
                            value={getSelectValue(invoiceTypeSelections[row.id], getSelectOptions(invoiceTypeDropdownOptions, invoiceTypeSelections[row.id], invoiceTypeSelections, allInvoiceTypeOptions))}
                            onChange={(option) => handleInvoiceTypeSelectionChange(row.id, option)}
                            isClearable={true}
                            isSearchable={true}
                            placeholder="Select mapping..."
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                          />
                        ) : (
                          <span>{row.mappedDisplayName || (invoiceTypeSelections[row.id] && allInvoiceTypeOptions.find(o => o.AutoIndex === invoiceTypeSelections[row.id])?.DisplayName) || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ELECTRONIC ADDRESS SCHEME MASTER TABLE */}
        <div className="configure-card">
          <div className="card-header">
            <h2>Electronic Address Scheme Master</h2>
            {masters.electronicAddressSchemeMaster && (
              <div className="card-actions">
                {!isElectronicAddressSchemeEditing ? (
                  <button className="btn-edit" onClick={() => setIsElectronicAddressSchemeEditing(true)}>Edit</button>
                ) : (
                  <>
                    <button className="btn-cancel" onClick={() => { setIsElectronicAddressSchemeEditing(false); fetchElectronicAddressSchemeMapping(); }}>Cancel</button>
                    <button className="btn-save" onClick={saveElectronicAddressSchemeMapping}>Save</button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="toggle-row">
            <span>Do you have Electronic Address Scheme?</span>
            <button
              className={`toggle-btn ${masters.electronicAddressSchemeMaster ? 'active' : ''}`}
              onClick={() => toggleMaster('Electronic Address Scheme Master', masters.electronicAddressSchemeMaster)}
            >
              <div className="toggle-slider"></div>
            </button>
            <span className="toggle-label">{masters.electronicAddressSchemeMaster ? 'Yes' : 'No'}</span>
          </div>

          {masters.electronicAddressSchemeMaster && (
            <div className="table-wrapper">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>SlNo</th>
                    <th>Existing Master</th>
                    <th>Status</th>
                    <th>Mapped Master</th>
                  </tr>
                </thead>
                <tbody>
                  {electronicAddressSchemeTableData.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td>{row.description}</td>
                      <td>
                        <span className={`status-badge ${row.status || electronicAddressSchemeSelections[row.id] ? 'mapped' : 'not-mapped'}`}>
                          {row.status || electronicAddressSchemeSelections[row.id] ? 'Mapped' : 'Not Mapped'}
                        </span>
                      </td>
                      <td>
                        {isElectronicAddressSchemeEditing ? (
                          <Select
                            options={getSelectOptions(electronicAddressSchemeDropdownOptions, electronicAddressSchemeSelections[row.id], electronicAddressSchemeSelections, allElectronicAddressSchemeOptions)}
                            value={getSelectValue(electronicAddressSchemeSelections[row.id], getSelectOptions(electronicAddressSchemeDropdownOptions, electronicAddressSchemeSelections[row.id], electronicAddressSchemeSelections, allElectronicAddressSchemeOptions))}
                            onChange={(option) => handleElectronicAddressSchemeSelectionChange(row.id, option)}
                            isClearable={true}
                            isSearchable={true}
                            placeholder="Select mapping..."
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                          />
                        ) : (
                          <span>{row.mappedDisplayName || (electronicAddressSchemeSelections[row.id] && allElectronicAddressSchemeOptions.find(o => o.AutoIndex === electronicAddressSchemeSelections[row.id])?.DisplayName) || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* OBJECT IDENTIFIER MASTER TABLE 
        <div className="configure-card">
          <div className="card-header">
            <h2>Object Identifier Master</h2>
            {masters.objectIdentifierMaster && (
              <div className="card-actions">
                {!isObjectIdentifierEditing ? (
                  <button className="btn-edit" onClick={() => setIsObjectIdentifierEditing(true)}>Edit</button>
                ) : (
                  <>
                    <button className="btn-cancel" onClick={() => { setIsObjectIdentifierEditing(false); fetchObjectIdentifierMapping(); }}>Cancel</button>
                    <button className="btn-save" onClick={saveObjectIdentifierMapping}>Save</button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="toggle-row">
            <span>Do you have Object Identifier?</span>
            <button
              className={`toggle-btn ${masters.objectIdentifierMaster ? 'active' : ''}`}
              onClick={() => toggleMaster('Object Identifier Master', masters.objectIdentifierMaster)}
            >
              <div className="toggle-slider"></div>
            </button>
            <span className="toggle-label">{masters.objectIdentifierMaster ? 'Yes' : 'No'}</span>
          </div>

          {masters.objectIdentifierMaster && (
            <div className="table-wrapper">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>SlNo</th>
                    <th>Existing Master</th>
                    <th>Status</th>
                    <th>Mapped Master</th>
                  </tr>
                </thead>
                <tbody>
                  {objectIdentifierTableData.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td>{row.description}</td>
                      <td>
                        <span className={`status-badge ${row.status || objectIdentifierSelections[row.id] ? 'mapped' : 'not-mapped'}`}>
                          {row.status || objectIdentifierSelections[row.id] ? 'Mapped' : 'Not Mapped'}
                        </span>
                      </td>
                      <td>
                        {isObjectIdentifierEditing ? (
                          <Select
                            options={getSelectOptions(objectIdentifierDropdownOptions, objectIdentifierSelections[row.id], objectIdentifierSelections, allObjectIdentifierOptions)}
                            value={getSelectValue(objectIdentifierSelections[row.id], getSelectOptions(objectIdentifierDropdownOptions, objectIdentifierSelections[row.id], objectIdentifierSelections, allObjectIdentifierOptions))}
                            onChange={(option) => handleObjectIdentifierSelectionChange(row.id, option)}
                            isClearable={true}
                            isSearchable={true}
                            placeholder="Select mapping..."
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                          />
                        ) : (
                          <span>{row.mappedDisplayName || (objectIdentifierSelections[row.id] && allObjectIdentifierOptions.find(o => o.AutoIndex === objectIdentifierSelections[row.id])?.DisplayName) || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        */}

        {/* INVOICE TRANSACTION MASTER TABLE */}
        <div className="configure-card">
          <div className="card-header">
            <h2>Invoice Transaction Master</h2>
            {masters.invoiceTransactionMaster && (
              <div className="card-actions">
                {!isInvoiceTransactionEditing ? (
                  <button className="btn-edit" onClick={() => setIsInvoiceTransactionEditing(true)}>Edit</button>
                ) : (
                  <>
                    <button className="btn-cancel" onClick={() => { setIsInvoiceTransactionEditing(false); fetchInvoiceTransactionMapping(); }}>Cancel</button>
                    <button className="btn-save" onClick={saveInvoiceTransactionMapping}>Save</button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="toggle-row">
            <span>Do you have Invoice Transaction Type?</span>
            <button
              className={`toggle-btn ${masters.invoiceTransactionMaster ? 'active' : ''}`}
              onClick={() => toggleMaster('Invoice Transaction Master', masters.invoiceTransactionMaster)}
            >
              <div className="toggle-slider"></div>
            </button>
            <span className="toggle-label">{masters.invoiceTransactionMaster ? 'Yes' : 'No'}</span>
          </div>

          {masters.invoiceTransactionMaster && (
            <div className="table-wrapper">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>SlNo</th>
                    <th>Existing Master</th>
                    <th>Status</th>
                    <th>Mapped Master</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceTransactionTableData.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td>{row.description}</td>
                      <td>
                        <span className={`status-badge ${row.status || invoiceTransactionSelections[row.id] ? 'mapped' : 'not-mapped'}`}>
                          {row.status || invoiceTransactionSelections[row.id] ? 'Mapped' : 'Not Mapped'}
                        </span>
                      </td>
                      <td>
                        {isInvoiceTransactionEditing ? (
                          <Select
                            options={getSelectOptions(invoiceTransactionDropdownOptions, invoiceTransactionSelections[row.id], invoiceTransactionSelections, allInvoiceTransactionOptions)}
                            value={getSelectValue(invoiceTransactionSelections[row.id], getSelectOptions(invoiceTransactionDropdownOptions, invoiceTransactionSelections[row.id], invoiceTransactionSelections, allInvoiceTransactionOptions))}
                            onChange={(option) => handleInvoiceTransactionSelectionChange(row.id, option)}
                            isClearable={true}
                            isSearchable={true}
                            placeholder="Select mapping..."
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                          />
                        ) : (
                          <span>{row.mappedDisplayName || (invoiceTransactionSelections[row.id] && allInvoiceTransactionOptions.find(o => o.AutoIndex === invoiceTransactionSelections[row.id])?.DisplayName) || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* CREDIT NOTE REASON MASTER TABLE */}
        <div className="configure-card">
          <div className="card-header">
            <h2>Credit Note Reason Master</h2>
            {masters.creditNoteReasonMaster && (
              <div className="card-actions">
                {!isCreditNoteReasonEditing ? (
                  <button className="btn-edit" onClick={() => setIsCreditNoteReasonEditing(true)}>Edit</button>
                ) : (
                  <>
                    <button className="btn-cancel" onClick={() => { setIsCreditNoteReasonEditing(false); fetchCreditNoteReasonMapping(); }}>Cancel</button>
                    <button className="btn-save" onClick={saveCreditNoteReasonMapping}>Save</button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="toggle-row">
            <span>Do you have Credit Note Reason?</span>
            <button
              className={`toggle-btn ${masters.creditNoteReasonMaster ? 'active' : ''}`}
              onClick={() => toggleMaster('Credit Note Reason Master', masters.creditNoteReasonMaster)}
            >
              <div className="toggle-slider"></div>
            </button>
            <span className="toggle-label">{masters.creditNoteReasonMaster ? 'Yes' : 'No'}</span>
          </div>

          {masters.creditNoteReasonMaster && (
            <div className="table-wrapper">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>SlNo</th>
                    <th>Existing Master</th>
                    <th>Status</th>
                    <th>Mapped Master</th>
                  </tr>
                </thead>
                <tbody>
                  {creditNoteReasonTableData.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td>{row.description}</td>
                      <td>
                        <span className={`status-badge ${row.status || creditNoteReasonSelections[row.id] ? 'mapped' : 'not-mapped'}`}>
                          {row.status || creditNoteReasonSelections[row.id] ? 'Mapped' : 'Not Mapped'}
                        </span>
                      </td>
                      <td>
                        {isCreditNoteReasonEditing ? (
                          <Select
                            options={getSelectOptions(creditNoteReasonDropdownOptions, creditNoteReasonSelections[row.id], creditNoteReasonSelections, allCreditNoteReasonOptions)}
                            value={getSelectValue(creditNoteReasonSelections[row.id], getSelectOptions(creditNoteReasonDropdownOptions, creditNoteReasonSelections[row.id], creditNoteReasonSelections, allCreditNoteReasonOptions))}
                            onChange={(option) => handleCreditNoteReasonSelectionChange(row.id, option)}
                            isClearable={true}
                            isSearchable={true}
                            placeholder="Select mapping..."
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                          />
                        ) : (
                          <span>{row.mappedDisplayName || (creditNoteReasonSelections[row.id] && allCreditNoteReasonOptions.find(o => o.AutoIndex === creditNoteReasonSelections[row.id])?.DisplayName) || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* CHARGES MASTER TABLE */}
        <div className="configure-card">
          <div className="card-header">
            <h2>Charges Master</h2>
            {masters.chargesMaster && (
              <div className="card-actions">
                {!isChargesEditing ? (
                  <button className="btn-edit" onClick={() => setIsChargesEditing(true)}>Edit</button>
                ) : (
                  <>
                    <button className="btn-cancel" onClick={() => { setIsChargesEditing(false); fetchChargesMapping(); }}>Cancel</button>
                    <button className="btn-save" onClick={saveChargesMapping}>Save</button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="toggle-row">
            <span>Do you have Charges?</span>
            <button
              className={`toggle-btn ${masters.chargesMaster ? 'active' : ''}`}
              onClick={() => toggleMaster('Charges Master', masters.chargesMaster)}
            >
              <div className="toggle-slider"></div>
            </button>
            <span className="toggle-label">{masters.chargesMaster ? 'Yes' : 'No'}</span>
          </div>

          {masters.chargesMaster && (
            <div className="table-wrapper">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>SlNo</th>
                    <th>Existing Master</th>
                    <th>Status</th>
                    <th>Mapped Master</th>
                  </tr>
                </thead>
                <tbody>
                  {chargesTableData.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td>{row.description}</td>
                      <td>
                        <span className={`status-badge ${row.status || chargesSelections[row.id] ? 'mapped' : 'not-mapped'}`}>
                          {row.status || chargesSelections[row.id] ? 'Mapped' : 'Not Mapped'}
                        </span>
                      </td>
                      <td>
                        {isChargesEditing ? (
                          <Select
                            options={getSelectOptions(chargesDropdownOptions, chargesSelections[row.id], chargesSelections, allChargesOptions)}
                            value={getSelectValue(chargesSelections[row.id], getSelectOptions(chargesDropdownOptions, chargesSelections[row.id], chargesSelections, allChargesOptions))}
                            onChange={(option) => handleChargesSelectionChange(row.id, option)}
                            isClearable={true}
                            isSearchable={true}
                            placeholder="Select mapping..."
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                          />
                        ) : (
                          <span>{row.mappedDisplayName || (chargesSelections[row.id] && allChargesOptions.find(o => o.AutoIndex === chargesSelections[row.id])?.DisplayName) || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* TDD SCOPE MASTER TABLE */}
        <div className="configure-card">
          <div className="card-header">
            <h2>TDD Scope Master</h2>
            {masters.tddScopeMaster && (
              <div className="card-actions">
                {!isTddScopeEditing ? (
                  <button className="btn-edit" onClick={() => setIsTddScopeEditing(true)}>Edit</button>
                ) : (
                  <>
                    <button className="btn-cancel" onClick={() => { setIsTddScopeEditing(false); fetchTddScopeMapping(); }}>Cancel</button>
                    <button className="btn-save" onClick={saveTddScopeMapping}>Save</button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="toggle-row">
            <span>Do you have TDD Scope?</span>
            <button
              className={`toggle-btn ${masters.tddScopeMaster ? 'active' : ''}`}
              onClick={() => toggleMaster('TDD Scope Master', masters.tddScopeMaster)}
            >
              <div className="toggle-slider"></div>
            </button>
            <span className="toggle-label">{masters.tddScopeMaster ? 'Yes' : 'No'}</span>
          </div>

          {masters.tddScopeMaster && (
            <div className="table-wrapper">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>SlNo</th>
                    <th>Existing Master</th>
                    <th>Status</th>
                    <th>Mapped Master</th>
                  </tr>
                </thead>
                <tbody>
                  {tddScopeTableData.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td>{row.description}</td>
                      <td>
                        <span className={`status-badge ${row.status || tddScopeSelections[row.id] ? 'mapped' : 'not-mapped'}`}>
                          {row.status || tddScopeSelections[row.id] ? 'Mapped' : 'Not Mapped'}
                        </span>
                      </td>
                      <td>
                        {isTddScopeEditing ? (
                          <Select
                            options={getSelectOptions(tddScopeDropdownOptions, tddScopeSelections[row.id], tddScopeSelections, allTddScopeOptions)}
                            value={getSelectValue(tddScopeSelections[row.id], getSelectOptions(tddScopeDropdownOptions, tddScopeSelections[row.id], tddScopeSelections, allTddScopeOptions))}
                            onChange={(option) => handleTddScopeSelectionChange(row.id, option)}
                            isClearable={true}
                            isSearchable={true}
                            placeholder="Select mapping..."
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                          />
                        ) : (
                          <span>{row.mappedDisplayName || (tddScopeSelections[row.id] && allTddScopeOptions.find(o => o.AutoIndex === tddScopeSelections[row.id])?.DisplayName) || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RCM TYPE MASTER TABLE */}
        <div className="configure-card">
          <div className="card-header">
            <h2>Rcm Type Master</h2>
            {masters.rcmTypeMaster && (
              <div className="card-actions">
                {!isRcmTypeEditing ? (
                  <button className="btn-edit" onClick={() => setIsRcmTypeEditing(true)}>Edit</button>
                ) : (
                  <>
                    <button className="btn-cancel" onClick={() => { setIsRcmTypeEditing(false); fetchRcmTypeMapping(); }}>Cancel</button>
                    <button className="btn-save" onClick={saveRcmTypeMapping}>Save</button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="toggle-row">
            <span>Do you have Rcm Type?</span>
            <button
              className={`toggle-btn ${masters.rcmTypeMaster ? 'active' : ''}`}
              onClick={() => toggleMaster('Rcm Type Master', masters.rcmTypeMaster)}
            >
              <div className="toggle-slider"></div>
            </button>
            <span className="toggle-label">{masters.rcmTypeMaster ? 'Yes' : 'No'}</span>
          </div>

          {masters.rcmTypeMaster && (
            <div className="table-wrapper">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>SlNo</th>
                    <th>Existing Master</th>
                    <th>Status</th>
                    <th>Mapped Master</th>
                  </tr>
                </thead>
                <tbody>
                  {rcmTypeTableData.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td>{row.description}</td>
                      <td>
                        <span className={`status-badge ${row.status || rcmTypeSelections[row.id] ? 'mapped' : 'not-mapped'}`}>
                          {row.status || rcmTypeSelections[row.id] ? 'Mapped' : 'Not Mapped'}
                        </span>
                      </td>
                      <td>
                        {isRcmTypeEditing ? (
                          <Select
                            options={getSelectOptions(rcmTypeDropdownOptions, rcmTypeSelections[row.id], rcmTypeSelections, allRcmTypeOptions)}
                            value={getSelectValue(rcmTypeSelections[row.id], getSelectOptions(rcmTypeDropdownOptions, rcmTypeSelections[row.id], rcmTypeSelections, allRcmTypeOptions))}
                            onChange={(option) => handleRcmTypeSelectionChange(row.id, option)}
                            isClearable={true}
                            isSearchable={true}
                            placeholder="Select mapping..."
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                          />
                        ) : (
                          <span>{row.mappedDisplayName || (rcmTypeSelections[row.id] && allRcmTypeOptions.find(o => o.AutoIndex === rcmTypeSelections[row.id])?.DisplayName) || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

          {/* Exempt Reason MASTER TABLE */}
        <div className="configure-card">
          <div className="card-header">
            <h2>Exempt Reason Master</h2>
            {masters.exemptReasonMaster && (
              <div className="card-actions">
                {!isExemptReasonEditing ? (
                  <button className="btn-edit" onClick={() => setIsExemptReasonEditing(true)}>Edit</button>
                ) : (
                  <>
                    <button className="btn-cancel" onClick={() => { setIsExemptReasonEditing(false); fetchExemptReasonMapping(); }}>Cancel</button>
                    <button className="btn-save" onClick={saveExemptReasonMapping}>Save</button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="toggle-row">
            <span>Do you have Exempt Reason?</span>
            <button
              className={`toggle-btn ${masters.exemptReasonMaster ? 'active' : ''}`}
              onClick={() => toggleMaster('Exempt Reason Master', masters.exemptReasonMaster)}
            >
              <div className="toggle-slider"></div>
            </button>
            <span className="toggle-label">{masters.exemptReasonMaster ? 'Yes' : 'No'}</span>
          </div>

          {masters.exemptReasonMaster && (
            <div className="table-wrapper">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>SlNo</th>
                    <th>Existing Master</th>
                    <th>Status</th>
                    <th>Mapped Master</th>
                  </tr>
                </thead>
                <tbody>
                  {exemptReasonTableData.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td>{row.description}</td>
                      <td>
                        <span className={`status-badge ${row.status || exemptReasonSelections[row.id] ? 'mapped' : 'not-mapped'}`}>
                          {row.status || exemptReasonSelections[row.id] ? 'Mapped' : 'Not Mapped'}
                        </span>
                      </td>
                      <td>
                        {isExemptReasonEditing ? (
                          <Select
                            options={getSelectOptions(exemptReasonDropdownOptions, exemptReasonSelections[row.id], exemptReasonSelections, allExemptReasonOptions)}
                            value={getSelectValue(exemptReasonSelections[row.id], getSelectOptions(exemptReasonDropdownOptions, exemptReasonSelections[row.id], exemptReasonSelections, allExemptReasonOptions))}
                            onChange={(option) => handleExemptReasonSelectionChange(row.id, option)}
                            isClearable={true}
                            isSearchable={true}
                            placeholder="Select mapping..."
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                          />
                        ) : (
                          <span>{row.mappedDisplayName || (exemptReasonSelections[row.id] && allExemptReasonOptions.find(o => o.AutoIndex === exemptReasonSelections[row.id])?.DisplayName) || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Currency MASTER TABLE */}
        <div className="configure-card">
          <div className="card-header">
            <h2>Foreign Currency Master</h2>
            {masters.currencyMaster && (
              <div className="card-actions">
                {!isCurrencyEditing ? (
                  <button className="btn-edit" onClick={() => setIsCurrencyEditing(true)}>Edit</button>
                ) : (
                  <>
                    <button className="btn-cancel" onClick={() => { setIsCurrencyEditing(false); fetchCurrencyMapping(); }}>Cancel</button>
                    <button className="btn-save" onClick={saveCurrencyMapping}>Save</button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="toggle-row">
            <span>Do you have Foreign Currency?</span>
            <button
              className={`toggle-btn ${masters.currencyMaster ? 'active' : ''}`}
              onClick={() => toggleMaster('Currency Master', masters.currencyMaster)}
            >
              <div className="toggle-slider"></div>
            </button>
            <span className="toggle-label">{masters.currencyMaster ? 'Yes' : 'No'}</span>
          </div>

          {masters.currencyMaster && (
            <div className="table-wrapper">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>SlNo</th>
                    <th>Existing Master</th>
                    <th>Status</th>
                    <th>Mapped Master</th>
                  </tr>
                </thead>
                <tbody>
                  {currencyTableData.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td>{row.description}</td>
                      <td>
                        <span className={`status-badge ${row.status || currencySelections[row.id] ? 'mapped' : 'not-mapped'}`}>
                          {row.status || currencySelections[row.id] ? 'Mapped' : 'Not Mapped'}
                        </span>
                      </td>
                      <td>
                        {isCurrencyEditing ? (
                          <Select
                            options={getSelectOptions(currencyDropdownOptions, currencySelections[row.id], currencySelections, allCurrencyOptions)}
                            value={getSelectValue(currencySelections[row.id], getSelectOptions(currencyDropdownOptions, currencySelections[row.id], currencySelections, allCurrencyOptions))}
                            onChange={(option) => handleCurrencySelectionChange(row.id, option)}
                            isClearable={true}
                            isSearchable={true}
                            placeholder="Select mapping..."
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                          />
                        ) : (
                          <span>{row.mappedDisplayName || (currencySelections[row.id] && allCurrencyOptions.find(o => o.AutoIndex === currencySelections[row.id])?.DisplayName) || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>


        {/* UNIT MASTER TABLE */}
        <div className="configure-card">
          <div className="card-header">
            <h2>Unit Master</h2>
            {masters.unitMaster && (
              <div className="card-actions">
                {!isUnitEditing ? (
                  <button className="btn-edit" onClick={() => setIsUnitEditing(true)}>Edit</button>
                ) : (
                  <>
                    <button className="btn-cancel" onClick={() => { setIsUnitEditing(false); fetchUnitMapping(); }}>Cancel</button>
                    <button className="btn-save" onClick={saveUnitMapping}>Save</button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="toggle-row">
            <span>Do you have Unit?</span>
            <button
              className={`toggle-btn ${masters.unitMaster ? 'active' : ''}`}
              onClick={() => toggleMaster('Unit Master', masters.unitMaster)}
            >
              <div className="toggle-slider"></div>
            </button>
            <span className="toggle-label">{masters.unitMaster ? 'Yes' : 'No'}</span>
          </div>

          {masters.unitMaster && (
            <div className="table-wrapper">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>SlNo</th>
                    <th>Existing Master</th>
                    <th>Status</th>
                    <th>Mapped Master</th>
                  </tr>
                </thead>
                <tbody>
                  {unitTableData.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td>{row.description}</td>
                      <td>
                        <span className={`status-badge ${row.status || unitSelections[row.id] ? 'mapped' : 'not-mapped'}`}>
                          {row.status || unitSelections[row.id] ? 'Mapped' : 'Not Mapped'}
                        </span>
                      </td>
                      <td>
                        {isUnitEditing ? (
                          <Select
                            options={getSelectOptions(unitDropdownOptions, unitSelections[row.id], unitSelections, allUnitOptions)}
                            value={getSelectValue(unitSelections[row.id], getSelectOptions(unitDropdownOptions, unitSelections[row.id], unitSelections, allUnitOptions))}
                            onChange={(option) => handleUnitSelectionChange(row.id, option)}
                            isClearable={true}
                            isSearchable={true}
                            placeholder="Select mapping..."
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                          />
                        ) : (
                          <span>{row.mappedDisplayName || (unitSelections[row.id] && allUnitOptions.find(o => o.AutoIndex === unitSelections[row.id])?.DisplayName) || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* VAT MASTER TABLE */}
        <div className="configure-card">
          <div className="card-header">
            <h2>VAT Master</h2>
            {masters.vatMaster && (
              <div className="card-actions">
                {!isVatEditing ? (
                  <button className="btn-edit" onClick={() => setIsVatEditing(true)}>Edit</button>
                ) : (
                  <>
                    <button className="btn-cancel" onClick={() => { setIsVatEditing(false); fetchVatMapping(); }}>Cancel</button>
                    <button className="btn-save" onClick={saveVatMapping}>Save</button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="toggle-row">
            <span>Do you have VAT?</span>
            <button
              className={`toggle-btn ${masters.vatMaster ? 'active' : ''}`}
              onClick={() => toggleMaster('Vat Master', masters.vatMaster)}
            >
              <div className="toggle-slider"></div>
            </button>
            <span className="toggle-label">{masters.vatMaster ? 'Yes' : 'No'}</span>
          </div>

          {masters.vatMaster && (
            <div className="table-wrapper">
              <table className="mapping-table">
                <thead>
                  <tr>
                    <th>SlNo</th>
                    <th>Existing Master</th>
                    <th>Status</th>
                    <th>Mapped Master</th>
                  </tr>
                </thead>
                <tbody>
                  {vatTableData.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td>{row.description}</td>
                      <td>
                        <span className={`status-badge ${row.status || vatSelections[row.id] ? 'mapped' : 'not-mapped'}`}>
                          {row.status || vatSelections[row.id] ? 'Mapped' : 'Not Mapped'}
                        </span>
                      </td>
                      <td>
                        {isVatEditing ? (
                          <Select
                            options={getSelectOptions(vatDropdownOptions, vatSelections[row.id], vatSelections, allVatOptions)}
                            value={getSelectValue(vatSelections[row.id], getSelectOptions(vatDropdownOptions, vatSelections[row.id], vatSelections, allVatOptions))}
                            onChange={(option) => handleVatSelectionChange(row.id, option)}
                            isClearable={true}
                            isSearchable={true}
                            placeholder="Select mapping..."
                            styles={selectStyles}
                            menuPortalTarget={document.body}
                          />
                        ) : (
                          <span>{row.mappedDisplayName || (vatSelections[row.id] && allVatOptions.find(o => o.AutoIndex === vatSelections[row.id])?.DisplayName) || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>



      </div>
    </div>
  );
};

export default Configure;
