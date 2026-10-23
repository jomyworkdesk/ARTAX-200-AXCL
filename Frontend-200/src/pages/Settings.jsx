import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../Styles/Settings.css';
import {
  CalendarClock,
  CheckCircle,
  Clock,
  Edit,
  Eye,
  FileText,
  KeyRound,
  Layers,
  Play,
  Power,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  User,
  X
} from 'lucide-react';
import { useSnackbar } from '../components/Snackbar';
import { API_BASE_URL, apiFetch } from '../services/apiService';
import { getSessionItem } from '../services/sessionStorageService';

const emptyAutomationForm = {
  JobName: '',
  CronExpression: '',
  RunType: 'CRON',
  RunEverySeconds: '',
  RunAtTime: '',
  LastRunTime: '',
  NextRunTime: '',
  IsEnabled: true,
  Manual: false,
  Status: 'Active'
};

const emptyPasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
};

const emptyMailForm = {
  tomail: '',
  ccmail: ''
};

const SETTINGS_TABLE_MIN_ROWS = 6;

const ADMIN_TABS = [
  {
    key: 'web-logins',
    title: 'User Creation',
    description: 'Manage user login records and role assignment.',
    icon: KeyRound,
    searchPlaceholder: 'Search logins...',
    keyFields: ['AutoIndex'],
    columns: [
      { name: 'AutoIndex', label: 'Auto Index', type: 'number', generated: true },
      { name: 'UserName', label: 'User Name', type: 'text', required: true },
            { name: 'Password', label: 'Password', type: 'password', required: true, wide: false, hideInTable: true },

      {
        name: 'RoleId',
        label: 'Role',
        type: 'select',
        optionsKey: 'roles',
        valueField: 'RoleId',
        labelField: 'RoleName',
        displayField: 'RoleName',
        emptyLabel: 'No role'
      },
      { name: 'IsActive', label: 'Is Active', type: 'boolean', defaultValue: true, badge: true },
      { name: 'CreatedDate', label: 'Created Date', type: 'datetime', readonly: true },
      { name: 'ModifiedDate', label: 'Modified Date', type: 'datetime', readonly: true }
    ]
  },
  {
    key: 'role-page-access',
    title: 'Role Page Access',
    description: 'Control which roles can open each page.',
    icon: ShieldCheck,
    searchPlaceholder: 'Search access...',
    keyFields: ['RoleId', 'PageId'],
    columns: [
      { name: 'RoleId', label: 'Role Id', type: 'number', required: true },
      { name: 'PageId', label: 'Page Id', type: 'number', required: true },
      { name: 'HasAccess', label: 'Has Access', type: 'boolean', defaultValue: true, badge: true }
    ]
  },
  {
    key: 'roles',
    title: 'User Roles',
    description: 'Manage application role records.',
    icon: Users,
    searchPlaceholder: 'Search roles...',
    keyFields: ['RoleId'],
    columns: [
      { name: 'RoleId', label: 'Role Id', type: 'number', generated: true },
      { name: 'RoleName', label: 'Role Name', type: 'text', required: true },
      { name: 'Description', label: 'Description', type: 'textarea' },
      { name: 'IsActive', label: 'Is Active', type: 'boolean', defaultValue: true, badge: true }
    ]
  },
  {
    key: 'pages',
    title: 'Pages',
    description: 'Manage application pages and routes.',
    icon: FileText,
    searchPlaceholder: 'Search pages...',
    keyFields: ['PageId'],
    columns: [
      { name: 'PageId', label: 'Page Id', type: 'number', generated: true },
      { name: 'PageName', label: 'Page Name', type: 'text', required: true },
      { name: 'MenuText', label: 'Menu Text', type: 'text' },
      { name: 'Route', label: 'Route', type: 'text', required: true },
      { name: 'SortOrder', label: 'Sort Order', type: 'number' },
      { name: 'IsActive', label: 'Is Active', type: 'boolean', defaultValue: true, badge: true }
    ]
  }
];

const getInitialAdminForm = (tab) =>
  tab.columns.reduce((form, column) => {
    if (column.generated || column.readonly) return form;
    form[column.name] = column.defaultValue ?? '';
    return form;
  }, {});

const normalizeAdminFormFromRow = (tab, row) =>
  tab.columns.reduce((form, column) => {
    form[column.name] = row?.[column.name] ?? column.defaultValue ?? '';
    return form;
  }, {});

const getAdminRowKey = (tab, row) =>
  tab.keyFields.map((field) => encodeURIComponent(row[field])).join(':');

const isTruthyValue = (value) =>
  value === true || value === 1 || String(value).toLowerCase() === 'true';

const formatAdminCellValue = (column, value) => {
  if (column.type === 'boolean') return isTruthyValue(value) ? 'Yes' : 'No';
  if (column.type === 'password' && value) return String(value).length > 18 ? `${String(value).slice(0, 18)}...` : 'Set';
  return value === undefined || value === null || value === '' ? '-' : String(value);
};

const getAdminCellDisplayValue = (column, row, lookupRowsByKey = {}) => {
  if (column.displayField && row?.[column.displayField]) {
    return row[column.displayField];
  }

  if (column.type === 'select' && column.optionsKey) {
    const value = row?.[column.name];
    const option = (lookupRowsByKey[column.optionsKey] || []).find((item) =>
      String(item[column.valueField]) === String(value)
    );

    if (option) {
      return option[column.labelField];
    }
  }

  return row?.[column.name];
};

const formatDateTimeParts = (value) => {
  if (!value) return null;

  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);

  if (!match) return { date: text, time: '' };

  const [, year, month, day, hourText, minute, second] = match;
  const hour24 = Number(hourText);
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  const time = `${String(hour12).padStart(2, '0')}:${minute}${second ? `:${second}` : ''} ${period}`;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const dateLabel = date.toLocaleDateString('en-AE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  return { date: dateLabel, time };
};

const DateTimeDisplay = ({ value }) => {
  const parts = formatDateTimeParts(value);

  if (!parts) {
    return <span className="settings-date-empty">Not scheduled</span>;
  }

  return (
    <span className="settings-date-display">
      <span className="settings-date-main">{parts.date}</span>
      {parts.time && <span className="settings-time-pill">{parts.time}</span>}
    </span>
  );
};

const normalizeRunType = (value) => String(value || 'CRON').toUpperCase();

const normalizeTimeInputValue = (value) => {
  if (!value) return '';

  const match = String(value).trim().match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return '';

  const [, hour, minute, second = '00'] = match;
  return `${hour.padStart(2, '0')}:${minute}:${second}`;
};

const normalizeFormValue = (setting = {}) => ({
  JobName: setting.JobName || '',
  CronExpression: setting.CronExpression || '',
  RunType: normalizeRunType(setting.RunType),
  RunEverySeconds: setting.RunEverySeconds ?? '',
  RunAtTime: normalizeTimeInputValue(setting.RunAtTime),
  LastRunTime: setting.LastRunTime || '',
  NextRunTime: setting.NextRunTime || '',
  IsEnabled: Boolean(setting.IsEnabled),
  Manual: Boolean(setting.Manual),
  Status: setting.Status || 'Active'
});

const getStatusBadgeClass = (status) => {
  const value = String(status || '').toLowerCase();
  if (value.includes('inactive')) return 'error';
  if (value.includes('active') || value.includes('success') || value.includes('running')) return 'success';
  if (value.includes('fail') || value.includes('error')) return 'error';
  if (value.includes('pause') || value.includes('pending')) return 'warning';
  return 'neutral';
};

const getAutomationQueueIndicatorClass = (setting) => {
  if (!isTruthyValue(setting?.IsQueue)) return 'red';
  return isTruthyValue(setting?.IsProcessing) ? 'green' : 'orange';
};

const formatClockTime = (value) => value.toLocaleTimeString('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true
});

const AutomationModal = ({
  mode,
  form,
  saving,
  running,
  onClose,
  onChange,
  onSubmit,
  onRunManual
}) => {
  const isView = mode === 'view';
  const runType = normalizeRunType(form.RunType);
  const isManual = runType === 'MANUAL';
  const isCron = runType === 'CRON';
  const isDaily = runType === 'DAILY';
  const isInterval = runType === 'INTERVAL';
  const title = mode === 'add'
    ? 'Add Automation'
    : mode === 'edit'
      ? 'Edit Automation'
      : 'Automation Details';

  const fieldProps = (name) => ({
    value: form[name],
    disabled: isView || saving,
    onChange: (event) => onChange(name, event.target.value)
  });

  return (
    <div className="settings-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="settings-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="settings-modal-header">
          <div>
            <h3>{title}</h3>
            <p>Configure job timing, status, and run history.</p>
          </div>
          <button className="settings-icon-btn" type="button" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <form className="automation-form" onSubmit={onSubmit}>
          <div className="automation-form-section">
            <span className="automation-section-title">Job</span>
            <div className="automation-form-grid">
              <label className="settings-field">
                <span>Job Name</span>
                <input
                  type="text"
                  placeholder=" Sync Job"
                  {...fieldProps('JobName')}
                  disabled={isView || mode === 'edit' || saving}
                />
              </label>

              <label className="settings-field">
                <span>Status</span>
                <select {...fieldProps('Status')}>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>

              <label className="settings-field">
                <span>Run Type</span>
                <select
                  {...fieldProps('RunType')}
                  onChange={(event) => onChange('RunType', event.target.value)}
                >
                  <option value="CRON">Cron</option>
                  <option value="INTERVAL">Interval</option>
                  <option value="DAILY">Daily</option>
                  <option value="MANUAL">Manual</option>
                </select>
              </label>

              {isCron && (
                <label className="settings-field">
                  <span>Cron Expression</span>
                  <input type="text" placeholder="*/5 * * * *" {...fieldProps('CronExpression')} />
                </label>
              )}

              {isDaily && (
                <label className="settings-field">
                  <span>Run At Time</span>
                  <input type="time" {...fieldProps('RunAtTime')} />
                </label>
              )}

              {isInterval && (
                <label className="settings-field">
                  <span>Run Every Seconds</span>
                  <input type="number" min="0" placeholder="300" {...fieldProps('RunEverySeconds')} />
                </label>
              )}

              {isManual && (
                <div className="settings-manual-callout">
                  <div>
                    <strong>Manual job</strong>
                    <span>Run on request.</span>
                  </div>
                  {mode !== 'add' && (
                    <button
                      className="primary-btn"
                      type="button"
                      onClick={onRunManual}
                      disabled={running}
                    >
                      <Play size={16} />
                      {running ? 'Running...' : 'Run'}
                    </button>
                  )}
                </div>
              )}



            </div>
          </div>

          <div className="automation-form-section">
            <span className="automation-section-title">Run History</span>
            <div className="automation-form-grid">
              <label className="settings-field">
                <span>Last Run Time</span>
                <div className="settings-readonly-value">
                  <DateTimeDisplay value={form.LastRunTime} />
                </div>
              </label>

              <label className="settings-field">
                <span>Next Run Time</span>
                <div className="settings-readonly-value">
                  <DateTimeDisplay value={form.NextRunTime} />
                </div>
              </label>
            </div>
          </div>

          <div className="settings-modal-actions">
            <button className="btn-secondary" type="button" onClick={onClose}>
              Cancel
            </button>
            {!isView && (
              <button className="primary-btn" type="submit" disabled={saving}>
                <CheckCircle size={16} />
                {saving ? 'Saving...' : 'Save Setting'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

const AdminSettingsModal = ({ tab, mode, form, saving, lookupRowsByKey = {}, onClose, onChange, onSubmit }) => {
  const isView = mode === 'view';
  const title = mode === 'add' ? `Add ${tab.title}` : mode === 'edit' ? `Edit ${tab.title}` : `${tab.title} Details`;

  const isFieldDisabled = (column) =>
    isView || saving || column.readonly || column.generated || (mode === 'edit' && tab.keyFields.includes(column.name));

  const renderField = (column) => {
    const disabled = isFieldDisabled(column);

    if (column.type === 'boolean') {
      return (
        <label className="settings-toggle-row" key={column.name}>
          <input
            type="checkbox"
            checked={isTruthyValue(form[column.name])}
            disabled={disabled}
            onChange={(event) => onChange(column.name, event.target.checked)}
          />
          <span>
            <strong>{column.label}</strong>
            <small>{isTruthyValue(form[column.name]) ? 'Enabled' : 'Disabled'}</small>
          </span>
        </label>
      );
    }

    if (column.type === 'textarea') {
      return (
        <label className="settings-field settings-field-wide" key={column.name}>
          <span>{column.label}</span>
          <textarea
            value={form[column.name] ?? ''}
            disabled={disabled}
            rows={3}
            onChange={(event) => onChange(column.name, event.target.value)}
          />
        </label>
      );
    }

    if (column.type === 'select') {
      const options = lookupRowsByKey[column.optionsKey] || [];
      const selectedValue = form[column.name] ?? '';
      const selectedExists = !selectedValue || options.some((option) =>
        String(option[column.valueField]) === String(selectedValue)
      );

      return (
        <label className={`settings-field ${column.wide ? 'settings-field-wide' : ''}`} key={column.name}>
          <span>{column.label}</span>
          <select
            value={selectedValue}
            disabled={disabled}
            onChange={(event) => onChange(column.name, event.target.value)}
          >
            <option value="">{column.emptyLabel || 'Select'}</option>
            {!selectedExists && (
              <option value={selectedValue}>
                {form[column.displayField] || selectedValue}
              </option>
            )}
            {options.map((option) => (
              <option key={option[column.valueField]} value={option[column.valueField]}>
                {option[column.labelField]}
              </option>
            ))}
          </select>
        </label>
      );
    }

    return (
      <label className={`settings-field ${column.wide ? 'settings-field-wide' : ''}`} key={column.name}>
        <span>{column.label}</span>
        <input
          type={column.type === 'password' ? 'password' : column.type === 'number' ? 'number' : 'text'}
          value={form[column.name] ?? ''}
          disabled={disabled}
          onChange={(event) => onChange(column.name, event.target.value)}
          autoComplete={column.type === 'password' ? 'new-password' : 'off'}
        />
      </label>
    );
  };

  return (
    <div className="settings-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="settings-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="settings-modal-header">
          <div>
            <h3>{title}</h3>
            <p>Review and maintain the selected settings row.</p>
          </div>
          <button className="settings-icon-btn" type="button" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <form className="automation-form" onSubmit={onSubmit}>
          <div className="automation-form-section">
            <span className="automation-section-title">Details</span>
            <div className="automation-form-grid">
              {tab.columns
                .filter((column) => mode !== 'add' || !column.generated)
                .map(renderField)}
            </div>
          </div>

          <div className="settings-modal-actions">
            <button className="btn-secondary" type="button" onClick={onClose}>
              Cancel
            </button>
            {!isView && (
              <button className="primary-btn" type="submit" disabled={saving}>
                <CheckCircle size={16} />
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

const Settings = () => {
  const snackbar = useSnackbar();
  const [activeTab, setActiveTab] = useState('profile');
  const [automationSettings, setAutomationSettings] = useState([]);
  const [loadingAutomation, setLoadingAutomation] = useState(false);
  const [savingAutomation, setSavingAutomation] = useState(false);
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [autoSendOn, setAutoSendOn] = useState(false);
  const [autoSendSaving, setAutoSendSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [mailSaving, setMailSaving] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const [mailForm, setMailForm] = useState(emptyMailForm);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalState, setModalState] = useState({ open: false, mode: 'view', setting: null });
  const [automationForm, setAutomationForm] = useState(emptyAutomationForm);
  const [adminRowsByTab, setAdminRowsByTab] = useState({});
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminModalState, setAdminModalState] = useState({ open: false, mode: 'view', row: null });
  const [adminForm, setAdminForm] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const roleLookupRequestedRef = useRef(false);
  const pageLookupRequestedRef = useRef(false);
  const [savingRoleAccessKeys, setSavingRoleAccessKeys] = useState(new Set());

  const activeAdminTab = useMemo(
    () => ADMIN_TABS.find((tab) => tab.key === activeTab) || null,
    [activeTab]
  );

  const adminRows = useMemo(
    () => (activeAdminTab ? adminRowsByTab[activeAdminTab.key] || [] : []),
    [activeAdminTab, adminRowsByTab]
  );

  const isRolePageAccessTab = activeAdminTab?.key === 'role-page-access';

  const roleRows = useMemo(
    () => adminRowsByTab.roles || [],
    [adminRowsByTab.roles]
  );

  const pageRows = useMemo(
    () => adminRowsByTab.pages || [],
    [adminRowsByTab.pages]
  );

  const rolePageAccessRows = useMemo(
    () => adminRowsByTab['role-page-access'] || [],
    [adminRowsByTab]
  );

  const rolePageAccessByKey = useMemo(() => {
    const accessMap = new Map();
    rolePageAccessRows.forEach((row) => {
      accessMap.set(`${row.RoleId}:${row.PageId}`, row);
    });
    return accessMap;
  }, [rolePageAccessRows]);

  const visibleAdminColumns = useMemo(
    () => activeAdminTab?.columns.filter((column) => !column.hideInTable) || [],
    [activeAdminTab]
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const fetchAutomationSettings = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoadingAutomation(true);
    }

    try {
      const response = await apiFetch(`${API_BASE_URL}/automation/cron-settings`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load automation settings');
      }

      setAutomationSettings(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('Automation settings fetch error:', error);
      if (!silent) {
        snackbar.error(error.message || 'Failed to load automation settings');
      }
    } finally {
      if (!silent) {
        setLoadingAutomation(false);
      }
    }
  }, [snackbar]);

  useEffect(() => {
    if (activeTab === 'automation') {
      fetchAutomationSettings();
    }
  }, [activeTab, fetchAutomationSettings]);

  useEffect(() => {
    if (activeTab !== 'automation') return;

    const timer = window.setInterval(() => {
      fetchAutomationSettings({ silent: true });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeTab, fetchAutomationSettings]);

  useEffect(() => {
    if (activeTab !== 'automation') return;

    const fetchAutoSend = async () => {
      try {
        const response = await apiFetch(`${API_BASE_URL}/configure/autosend`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to load auto send setting');
        }

        setAutoSendOn(Number(data.data?.autosend) === 1);
      } catch (error) {
        console.error('Auto send fetch error:', error);
        snackbar.error('Failed to load auto send setting');
      }
    };

    fetchAutoSend();
  }, [activeTab, snackbar]);

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/settings-profile`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load profile');
      }

      setProfileUser(data.data?.user || null);
      setMailForm({
        tomail: data.data?.mail?.tomail || '',
        ccmail: data.data?.mail?.ccmail || ''
      });
    } catch (error) {
      console.error('Profile fetch error:', error);
      snackbar.error(error.message || 'Failed to load profile');
    } finally {
      setProfileLoading(false);
    }
  }, [snackbar]);

  useEffect(() => {
    if (activeTab === 'profile') {
      fetchProfile();
    }
  }, [activeTab, fetchProfile]);

  const fetchAdminRows = useCallback(async (tab = activeAdminTab) => {
    if (!tab) return;

    setLoadingAdmin(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/settings-admin/${tab.key}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Failed to load ${tab.title}`);
      }

      setAdminRowsByTab((current) => ({
        ...current,
        [tab.key]: Array.isArray(data.data) ? data.data : []
      }));
    } catch (error) {
      console.error('Settings admin fetch error:', error);
      snackbar.error(error.message || `Failed to load ${tab.title}`);
    } finally {
      setLoadingAdmin(false);
    }
  }, [activeAdminTab, snackbar]);

  useEffect(() => {
    if (activeAdminTab) {
      setSearchQuery('');
      fetchAdminRows(activeAdminTab);

      if (activeAdminTab.key === 'web-logins' && !roleLookupRequestedRef.current) {
        roleLookupRequestedRef.current = true;
        const rolesTab = ADMIN_TABS.find((tab) => tab.key === 'roles');
        if (rolesTab) fetchAdminRows(rolesTab);
      }

      if (activeAdminTab.key === 'role-page-access') {
        if (!roleLookupRequestedRef.current) {
          roleLookupRequestedRef.current = true;
          const rolesTab = ADMIN_TABS.find((tab) => tab.key === 'roles');
          if (rolesTab) fetchAdminRows(rolesTab);
        }

        if (!pageLookupRequestedRef.current) {
          pageLookupRequestedRef.current = true;
          const pagesTab = ADMIN_TABS.find((tab) => tab.key === 'pages');
          if (pagesTab) fetchAdminRows(pagesTab);
        }
      }
    }
  }, [activeAdminTab, fetchAdminRows]);

  const filteredAutomationSettings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return automationSettings;

    return automationSettings.filter((setting) =>
      [
        setting.JobName,
        setting.CronExpression,
        setting.RunType,
        setting.Status
      ].some((value) => String(value || '').toLowerCase().includes(query))
    );
  }, [automationSettings, searchQuery]);

  const filteredAdminRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query || !activeAdminTab) return adminRows;

    return adminRows.filter((row) =>
      visibleAdminColumns.some((column) =>
        [row[column.name], column.displayField ? row[column.displayField] : null].some((value) =>
          String(value ?? '').toLowerCase().includes(query)
        )
      )
    );
  }, [activeAdminTab, adminRows, searchQuery, visibleAdminColumns]);

  const filteredRoleAccessPages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return pageRows;

    return pageRows.filter((page) =>
      [
        page.PageId,
        page.PageName,
        page.MenuText,
        page.Route
      ].some((value) => String(value ?? '').toLowerCase().includes(query))
    );
  }, [pageRows, searchQuery]);

  const automationFillerRowCount = !loadingAutomation && filteredAutomationSettings.length > 0
    ? Math.max(0, SETTINGS_TABLE_MIN_ROWS - filteredAutomationSettings.length)
    : 0;

  const adminFillerRowCount = !loadingAdmin && filteredAdminRows.length > 0
    ? Math.max(0, SETTINGS_TABLE_MIN_ROWS - filteredAdminRows.length)
    : 0;

  const roleAccessFillerRowCount =
    !loadingAdmin && roleRows.length > 0 && filteredRoleAccessPages.length > 0
      ? Math.max(0, SETTINGS_TABLE_MIN_ROWS - filteredRoleAccessPages.length)
      : 0;

  const openAutomationModal = (mode, setting = null) => {
    setAutomationForm(mode === 'add' ? emptyAutomationForm : normalizeFormValue(setting));
    setModalState({ open: true, mode, setting });
  };

  const closeAutomationModal = () => {
    if (savingAutomation) return;
    setModalState({ open: false, mode: 'view', setting: null });
  };

  const updateAutomationForm = (name, value) => {
    setAutomationForm((current) => {
      if (name !== 'RunType') {
        return { ...current, [name]: value };
      }

      const runType = normalizeRunType(value);
      return {
        ...current,
        RunType: runType,
        IsEnabled: runType !== 'MANUAL',
        Manual: runType === 'MANUAL' ? current.Manual : false
      };
    });
  };

  const validateAutomationForm = () => {
    if (!automationForm.JobName.trim()) {
      snackbar.error('Job name is required');
      return false;
    }

    if (automationForm.RunEverySeconds !== '' && Number(automationForm.RunEverySeconds) <= 0) {
      snackbar.error('Run every seconds must be greater than zero');
      return false;
    }

    const runType = normalizeRunType(automationForm.RunType);
    if (runType === 'CRON' && !automationForm.CronExpression.trim()) {
      snackbar.error('Cron expression is required');
      return false;
    }

    if (runType === 'DAILY' && !automationForm.RunAtTime) {
      snackbar.error('Run at time is required');
      return false;
    }

    if (runType === 'INTERVAL' && automationForm.RunEverySeconds === '') {
      snackbar.error('Run every seconds is required');
      return false;
    }

    return true;
  };

  const saveAutomationSetting = async (event) => {
    event.preventDefault();
    if (!validateAutomationForm()) return;

    const isEdit = modalState.mode === 'edit';
    const endpoint = isEdit
      ? `${API_BASE_URL}/automation/cron-settings/${modalState.setting.Id}`
      : `${API_BASE_URL}/automation/cron-settings`;

    const runType = normalizeRunType(automationForm.RunType);
    const payload = {
      JobName: automationForm.JobName,
      RunType: runType,
      IsEnabled: runType !== 'MANUAL',
      Manual: runType === 'MANUAL' ? automationForm.Manual : false,
      RunEverySeconds: runType === 'INTERVAL' ? Number(automationForm.RunEverySeconds) : null,
      CronExpression: runType === 'CRON' ? automationForm.CronExpression : null,
      RunAtTime: runType === 'DAILY' ? automationForm.RunAtTime : null,
      Status: automationForm.Status || null
    };

    setSavingAutomation(true);
    try {
      const response = await apiFetch(endpoint, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save automation setting');
      }

      snackbar.success(data.message || `Automation setting ${isEdit ? 'updated' : 'created'} successfully`);
      closeAutomationModal();
      await fetchAutomationSettings();
    } catch (error) {
      console.error('Automation settings save error:', error);
      snackbar.error(error.message || 'Failed to save automation setting');
    } finally {
      setSavingAutomation(false);
    }
  };

  const runManualAutomationSetting = async () => {
    const id = modalState.setting?.Id;
    if (!id) {
      snackbar.error('Save the manual automation setting before running it');
      return;
    }

    setRunningAutomation(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/automation/cron-settings/${id}/run`, {
        method: 'POST'
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to request manual run');
      }

      snackbar.success(data.message || 'Manual run requested');
      setAutomationForm((current) => normalizeFormValue(data.data || { ...current, Manual: true }));
      if (data.data) {
        setModalState((current) => ({ ...current, setting: data.data }));
      }
      await fetchAutomationSettings();
    } catch (error) {
      console.error('Manual automation run error:', error);
      snackbar.error(error.message || 'Failed to request manual run');
    } finally {
      setRunningAutomation(false);
    }
  };

  const toggleAutoSend = async () => {
    const next = !autoSendOn;
    setAutoSendOn(next);
    setAutoSendSaving(true);

    try {
      const response = await apiFetch(`${API_BASE_URL}/configure/autosend`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ autosend: next ? 1 : 2 })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update auto send setting');
      }

      setAutoSendOn(Number(data.data?.autosend) === 1);
      snackbar.success(`Auto send ${next ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Auto send update error:', error);
      setAutoSendOn(!next);
      snackbar.error(error.message || 'Failed to update auto send setting');
    } finally {
      setAutoSendSaving(false);
    }
  };

  const updatePasswordField = (name, value) => {
    setPasswordForm((current) => ({ ...current, [name]: value }));
  };

  const updateMailField = (name, value) => {
    setMailForm((current) => ({ ...current, [name]: value }));
  };

  const savePassword = async (event) => {
    event.preventDefault();

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      snackbar.error('All password fields are required');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      snackbar.error('New password must be at least 6 characters');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      snackbar.error('New password and confirm password do not match');
      return;
    }

    setPasswordSaving(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/settings-profile/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to change password');
      }

      setPasswordForm(emptyPasswordForm);
      snackbar.success(data.message || 'Password updated successfully');
      await fetchProfile();
    } catch (error) {
      console.error('Password update error:', error);
      snackbar.error(error.message || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const saveMailSettings = async (event) => {
    event.preventDefault();

    setMailSaving(true);
    try {
      const response = await apiFetch(`${API_BASE_URL}/settings-profile/mail`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(mailForm)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update mail settings');
      }

      setMailForm({
        tomail: data.data?.tomail || '',
        ccmail: data.data?.ccmail || ''
      });
      snackbar.success(data.message || 'Mail settings updated successfully');
    } catch (error) {
      console.error('Mail settings update error:', error);
      snackbar.error(error.message || 'Failed to update mail settings');
    } finally {
      setMailSaving(false);
    }
  };

  const openAdminModal = (mode, row = null) => {
    if (!activeAdminTab) return;

    setAdminForm(mode === 'add' ? getInitialAdminForm(activeAdminTab) : normalizeAdminFormFromRow(activeAdminTab, row));
    setAdminModalState({ open: true, mode, row });
  };

  const closeAdminModal = () => {
    if (savingAdmin) return;
    setAdminModalState({ open: false, mode: 'view', row: null });
  };

  const updateAdminForm = (name, value) => {
    setAdminForm((current) => ({ ...current, [name]: value }));
  };

  const validateAdminForm = () => {
    if (!activeAdminTab) return false;

    const requiredColumn = activeAdminTab.columns.find((column) =>
      column.required && adminModalState.mode !== 'view' && !String(adminForm[column.name] ?? '').trim()
    );

    if (requiredColumn) {
      snackbar.error(`${requiredColumn.label} is required`);
      return false;
    }

    return true;
  };

  const saveAdminRow = async (event) => {
    event.preventDefault();
    if (!activeAdminTab || !validateAdminForm()) return;

    const isEdit = adminModalState.mode === 'edit';
    const endpoint = isEdit
      ? `${API_BASE_URL}/settings-admin/${activeAdminTab.key}/${getAdminRowKey(activeAdminTab, adminModalState.row)}`
      : `${API_BASE_URL}/settings-admin/${activeAdminTab.key}`;

    setSavingAdmin(true);
    try {
      const response = await apiFetch(endpoint, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(adminForm)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save settings row');
      }

      snackbar.success(data.message || `Settings row ${isEdit ? 'updated' : 'created'} successfully`);
      closeAdminModal();
      await fetchAdminRows(activeAdminTab);
    } catch (error) {
      console.error('Settings admin save error:', error);
      snackbar.error(error.message || 'Failed to save settings row');
    } finally {
      setSavingAdmin(false);
    }
  };

  const fetchRolePageAccessMatrix = async () => {
    const roleAccessTab = ADMIN_TABS.find((tab) => tab.key === 'role-page-access');
    const rolesTab = ADMIN_TABS.find((tab) => tab.key === 'roles');
    const pagesTab = ADMIN_TABS.find((tab) => tab.key === 'pages');

    if (roleAccessTab) await fetchAdminRows(roleAccessTab);
    if (rolesTab) {
      roleLookupRequestedRef.current = true;
      await fetchAdminRows(rolesTab);
    }
    if (pagesTab) {
      pageLookupRequestedRef.current = true;
      await fetchAdminRows(pagesTab);
    }
  };

  const toggleRolePageAccess = async (role, page) => {
    const accessKey = `${role.RoleId}:${page.PageId}`;
    const existingAccess = rolePageAccessByKey.get(accessKey);
    const nextHasAccess = !isTruthyValue(existingAccess?.HasAccess);
    const endpoint = existingAccess
      ? `${API_BASE_URL}/settings-admin/role-page-access/${encodeURIComponent(role.RoleId)}:${encodeURIComponent(page.PageId)}`
      : `${API_BASE_URL}/settings-admin/role-page-access`;

    setSavingRoleAccessKeys((current) => new Set(current).add(accessKey));

    try {
      const response = await apiFetch(endpoint, {
        method: existingAccess ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          RoleId: role.RoleId,
          PageId: page.PageId,
          HasAccess: nextHasAccess
        })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update role page access');
      }

      await fetchAdminRows(ADMIN_TABS.find((tab) => tab.key === 'role-page-access'));
    } catch (error) {
      console.error('Role page access update error:', error);
      snackbar.error(error.message || 'Failed to update role page access');
    } finally {
      setSavingRoleAccessKeys((current) => {
        const next = new Set(current);
        next.delete(accessKey);
        return next;
      });
    }
  };

  return (
    <div className="page-container settings-page">
      <div className="page-header settings-page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-description">Manage your application preferences and account details.</p>
        </div>
        <div className="settings-clock" aria-label={`Current time ${formatClockTime(currentTime)}`}>
          <Clock size={18} />
          <span>{formatClockTime(currentTime)}</span>
        </div>
      </div>

      <div className="settings-grid">
        <div className="settings-sidebar card">
          <button
            type="button"
            className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <User size={18} />
            Profile
          </button>
          <button
            type="button"
            className={`settings-tab ${activeTab === 'automation' ? 'active' : ''}`}
            onClick={() => setActiveTab('automation')}
          >
            <CalendarClock size={18} />
            Automation
          </button>
          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon || Layers;
            return (
              <button
                type="button"
                key={tab.key}
                className={`settings-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <Icon size={18} />
                {tab.title}
              </button>
            );
          })}
        </div>

        {activeTab === 'profile' && (
          <div className="settings-content card profile-panel">
            <div className="profile-header">
              <div>
                <h3 className="settings-content-title">Profile</h3>
              </div>
              <button className="btn-secondary" type="button" onClick={fetchProfile} disabled={profileLoading}>
                <RefreshCw size={16} className={profileLoading ? 'spinning' : ''} />
                Refresh
              </button>
            </div>

            {profileLoading ? (
              <div className="settings-empty-state profile-loading">
                <div className="spinner" />
                Loading profile...
              </div>
            ) : (
              <div className="profile-settings-stack">
                <div className="profile-identity-box">
                  <div className="profile-identity-avatar">
                    {String(profileUser?.UserName || getSessionItem('UserName') || 'U').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="profile-identity-main">
                    <span>Logged in as</span>
                    <strong>{profileUser?.UserName || getSessionItem('UserName') || '-'}</strong>
                  </div>
                  <span className="profile-agent-pill">
                    Agent ID: {profileUser?.AgentId || getSessionItem('AgentId') || '-'}
                  </span>
                </div>

                <form className="profile-form" onSubmit={savePassword}>
                  <span className="automation-section-title">Change Password</span>
                  <div className="profile-simple-row">
                    <div className="profile-field">
                      <label>Current Password</label>
                      <input
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(event) => updatePasswordField('currentPassword', event.target.value)}
                        autoComplete="current-password"
                      />
                    </div>
                    <div className="profile-field">
                      <label>New Password</label>
                      <input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(event) => updatePasswordField('newPassword', event.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="profile-field">
                      <label>Confirm Password</label>
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(event) => updatePasswordField('confirmPassword', event.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <div className="profile-actions">
                    <button type="submit" className="primary-btn" disabled={passwordSaving}>
                      <CheckCircle size={16} />
                      {passwordSaving ? 'Updating...' : 'Change Password'}
                    </button>
                  </div>
                </form>

                <form className="profile-form" onSubmit={saveMailSettings}>
                  <span className="automation-section-title">Mail Settings</span>
                  <div className="profile-simple-row">
                    <div className="profile-field">
                      <label>To Mail</label>
                      <input
                        type="text"
                        value={mailForm.tomail}
                        onChange={(event) => updateMailField('tomail', event.target.value)}
                        placeholder="recipient@example.com"
                      />
                    </div>
                    <div className="profile-field">
                      <label>CC Mail</label>
                      <input
                        type="text"
                        value={mailForm.ccmail}
                        onChange={(event) => updateMailField('ccmail', event.target.value)}
                        placeholder="copy@example.com"
                      />
                    </div>
                  </div>
                  <div className="profile-actions">
                    <button type="submit" className="primary-btn" disabled={mailSaving}>
                      <CheckCircle size={16} />
                      {mailSaving ? 'Saving...' : 'Save Mail Settings'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {activeTab === 'automation' && (
          <div className="settings-content card automation-panel">
            <div className="automation-header">
              <div>
                <h3 className="settings-content-title">Automation Settings</h3>
                <p>Manage scheduled Jobs</p>
              </div>
              <div className="automation-actions">
                <button
                  type="button"
                  className={`settings-autosend-btn ${autoSendOn ? 'on' : 'off'}`}
                  onClick={toggleAutoSend}
                  disabled={autoSendSaving}
                  title={autoSendOn ? 'Auto send: On' : 'Auto send: Off'}
                  aria-label={autoSendOn ? 'Auto send: On' : 'Auto send: Off'}
                >
                  <Power size={16} />
                  <span>Auto Send</span>
                </button>
                <div className="settings-search">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search jobs..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </div>
                <button className="btn-secondary" type="button" onClick={fetchAutomationSettings} disabled={loadingAutomation}>
                  <RefreshCw size={16} className={loadingAutomation ? 'spinning' : ''} />
                  Refresh
                </button>
                <button className="primary-btn" type="button" onClick={() => openAutomationModal('add')}>
                  <Plus size={16} />
                  Add
                </button>
              </div>
            </div>

            <div className="automation-table-wrap">
              <table className="automation-table">
                <thead>
                  <tr>
                    <th>Job Name</th>
                    <th>Run Type</th>
                    <th>Last Run</th>
                    <th>Next Run</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingAutomation ? (
                    <tr>
                      <td colSpan="6" className="settings-empty-state">
                        <div className="spinner" />
                        Loading automation settings...
                      </td>
                    </tr>
                  ) : filteredAutomationSettings.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="settings-empty-state">No automation settings found</td>
                    </tr>
                  ) : (
                    <>
                      {filteredAutomationSettings.map((setting) => (
                        <tr key={setting.Id}>
                          <td className="font-medium">{setting.JobName || '-'}</td>
                          <td>{setting.RunType || '-'}</td>
                          <td><DateTimeDisplay value={setting.LastRunTime} /></td>
                          <td><DateTimeDisplay value={setting.NextRunTime} /></td>
                          <td>
                            <span className={`badge ${getStatusBadgeClass(setting.Status)}`}>
                              {setting.Status || 'Not Set'}
                            </span>
                          </td>
                          <td className="settings-action-cell">
                            <span
                              className={`automation-queue-dot ${getAutomationQueueIndicatorClass(setting)}`}
                              aria-hidden="true"
                            />
                            <button className="settings-icon-btn" type="button" onClick={() => openAutomationModal('view', setting)} title="View">
                              <Eye size={17} />
                            </button>
                            <button className="settings-icon-btn" type="button" onClick={() => openAutomationModal('edit', setting)} title="Edit">
                              <Edit size={17} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {Array.from({ length: automationFillerRowCount }).map((_, index) => (
                        <tr key={`automation-filler-${index}`} className="settings-filler-row" aria-hidden="true">
                          <td colSpan="6">&nbsp;</td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeAdminTab && (
          <div className="settings-content card automation-panel">
            <div className="automation-header">
              <div>
                <h3 className="settings-content-title">{activeAdminTab.title}</h3>
                <p>{activeAdminTab.description}</p>
              </div>
              <div className="automation-actions">
                <div className="settings-search">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder={activeAdminTab.searchPlaceholder}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </div>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => (isRolePageAccessTab ? fetchRolePageAccessMatrix() : fetchAdminRows(activeAdminTab))}
                  disabled={loadingAdmin}
                >
                  <RefreshCw size={16} className={loadingAdmin ? 'spinning' : ''} />
                  Refresh
                </button>
                {!isRolePageAccessTab && (
                  <button className="primary-btn" type="button" onClick={() => openAdminModal('add')}>
                    <Plus size={16} />
                    Add
                  </button>
                )}
              </div>
            </div>

            {isRolePageAccessTab ? (
              <div className="automation-table-wrap role-access-table-wrap">
                <table className="automation-table settings-role-access-table">
                  <thead>
                    <tr>
                      <th>Page</th>
                      {roleRows.map((role) => (
                        <th key={role.RoleId}>{role.RoleName || role.RoleId}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loadingAdmin && pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={roleRows.length + 1} className="settings-empty-state">
                          <div className="spinner" />
                          Loading role page access...
                        </td>
                      </tr>
                    ) : roleRows.length === 0 || filteredRoleAccessPages.length === 0 ? (
                      <tr>
                        <td colSpan={roleRows.length + 1 || 2} className="settings-empty-state">
                          No role page access data found
                        </td>
                      </tr>
                    ) : (
                      <>
                        {filteredRoleAccessPages.map((page) => (
                          <tr key={page.PageId}>
                            <td className="role-access-page-cell">
                              <strong>{page.PageName || page.MenuText || page.Route || page.PageId}</strong>
                              <span>{page.Route || page.MenuText || `Page ID: ${page.PageId}`}</span>
                            </td>
                            {roleRows.map((role) => {
                              const accessKey = `${role.RoleId}:${page.PageId}`;
                              const accessRow = rolePageAccessByKey.get(accessKey);
                              const isSavingAccess = savingRoleAccessKeys.has(accessKey);

                              return (
                                <td key={accessKey} className="role-access-toggle-cell">
                                  <label className="role-access-toggle" title={`${role.RoleName || role.RoleId} access for ${page.PageName || page.PageId}`}>
                                    <input
                                      type="checkbox"
                                      checked={isTruthyValue(accessRow?.HasAccess)}
                                      disabled={isSavingAccess}
                                      onChange={() => toggleRolePageAccess(role, page)}
                                    />
                                    <span />
                                  </label>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        {Array.from({ length: roleAccessFillerRowCount }).map((_, index) => (
                          <tr key={`role-access-filler-${index}`} className="settings-filler-row" aria-hidden="true">
                            <td className="role-access-page-cell">&nbsp;</td>
                            {roleRows.map((role) => (
                              <td key={`role-access-filler-${index}-${role.RoleId}`} className="role-access-toggle-cell">&nbsp;</td>
                            ))}
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="automation-table-wrap">
                <table className="automation-table settings-admin-table">
                  <thead>
                    <tr>
                      {visibleAdminColumns.map((column) => (
                        <th key={column.name}>{column.label}</th>
                      ))}
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingAdmin ? (
                      <tr>
                        <td colSpan={visibleAdminColumns.length + 1} className="settings-empty-state">
                          <div className="spinner" />
                          Loading {activeAdminTab.title.toLowerCase()}...
                        </td>
                      </tr>
                    ) : filteredAdminRows.length === 0 ? (
                      <tr>
                        <td colSpan={visibleAdminColumns.length + 1} className="settings-empty-state">
                          No {activeAdminTab.title.toLowerCase()} found
                        </td>
                      </tr>
                    ) : (
                      <>
                        {filteredAdminRows.map((row) => (
                          <tr key={getAdminRowKey(activeAdminTab, row)}>
                            {visibleAdminColumns.map((column, index) => (
                              <td key={column.name} className={index === 0 ? 'font-medium' : ''}>
                                {column.badge ? (
                                  <span className={`badge ${isTruthyValue(row[column.name]) ? 'success' : 'error'}`}>
                                    {formatAdminCellValue(column, row[column.name])}
                                  </span>
                                ) : (
                                  formatAdminCellValue(
                                    column,
                                    getAdminCellDisplayValue(column, row, adminRowsByTab)
                                  )
                                )}
                              </td>
                            ))}
                            <td className="settings-action-cell">
                              <button className="settings-icon-btn" type="button" onClick={() => openAdminModal('view', row)} title="View">
                                <Eye size={17} />
                              </button>
                              <button className="settings-icon-btn" type="button" onClick={() => openAdminModal('edit', row)} title="Edit">
                                <Edit size={17} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {Array.from({ length: adminFillerRowCount }).map((_, index) => (
                          <tr key={`admin-filler-${index}`} className="settings-filler-row" aria-hidden="true">
                            <td colSpan={visibleAdminColumns.length + 1}>&nbsp;</td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {modalState.open && (
        <AutomationModal
          mode={modalState.mode}
          form={automationForm}
          saving={savingAutomation}
          running={runningAutomation}
          onClose={closeAutomationModal}
          onChange={updateAutomationForm}
          onSubmit={saveAutomationSetting}
          onRunManual={runManualAutomationSetting}
        />
      )}
      {adminModalState.open && activeAdminTab && (
        <AdminSettingsModal
          tab={activeAdminTab}
          mode={adminModalState.mode}
          form={adminForm}
          saving={savingAdmin}
          lookupRowsByKey={adminRowsByTab}
          onClose={closeAdminModal}
          onChange={updateAdminForm}
          onSubmit={saveAdminRow}
        />
      )}
    </div>
  );
};

export default Settings;
