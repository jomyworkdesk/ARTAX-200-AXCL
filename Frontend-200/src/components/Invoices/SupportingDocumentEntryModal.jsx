import { useEffect, useState } from 'react';
import { X, Download, Upload, Save, Loader2, Pencil, FileCheck2 } from 'lucide-react';
import { useSnackbar } from '../Snackbar';
import { apiFetch } from '../../services/apiService';

import './InvoiceDetailsModal.css';

const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/xml'
];

const ATTACHMENT_EXTENSION_MIME_MAP = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  xml: 'application/xml'
};

const ATTACHMENT_FILE_ACCEPT = `${ALLOWED_ATTACHMENT_MIME_TYPES.join(',')},.pdf,.png,.jpg,.jpeg,.csv,.xlsx,.ods,.xml`;

const emptyOutDocumentForm = {
  invoiced_obj_id: '',
  invoiced_obj_scheme_id: '',
  document_type_code: '130',
  support_doc_ref: '',
  support_doc_desc: '',
  attached_document: '',
  attached_doc_mime_code: '',
  attached_doc_filename: '',
  external_doc_location: '',
  has_attached_document: false
};

const valueFrom = (source, keys) => {
  const keyList = Array.isArray(keys) ? keys : [keys];
  for (const key of keyList) {
    const value = source?.[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') return value;
  }
  return '';
};

const readFileAsBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result || '');
    resolve(result.includes(',') ? result.slice(result.indexOf(',') + 1) : result);
  };
  reader.onerror = () => reject(reader.error || new Error('Failed to read attachment'));
  reader.readAsDataURL(file);
});

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const getAttachmentMimeCode = (file) => {
  const browserMime = String(file?.type || '').trim();
  if (ALLOWED_ATTACHMENT_MIME_TYPES.includes(browserMime)) return browserMime;

  const extension = String(file?.name || '').split('.').pop()?.toLowerCase();
  return ATTACHMENT_EXTENSION_MIME_MAP[extension] || browserMime;
};

const hasOutDocumentAttachment = (record) =>
  record?.has_attached_document === true
  || record?.has_attached_document === 1
  || record?.has_attached_document === '1';

const mapOutDocumentRecordToForm = (record = {}, invoiceNumber = '') => ({
  ...emptyOutDocumentForm,
  invoiced_obj_id: valueFrom(record, ['invoiced_obj_id']) || invoiceNumber,
  invoiced_obj_scheme_id: valueFrom(record, ['invoiced_obj_scheme_id']),
  document_type_code: '130',
  support_doc_ref: valueFrom(record, ['support_doc_ref']) || invoiceNumber,
  support_doc_desc: valueFrom(record, ['support_doc_desc']),
  attached_document: '',
  attached_doc_mime_code: valueFrom(record, ['attached_doc_mime_code']),
  attached_doc_filename: valueFrom(record, ['attached_doc_filename']),
  external_doc_location: valueFrom(record, ['external_doc_location']),
  has_attached_document: hasOutDocumentAttachment(record)
});

const mapOutDocumentOptions = (payload) => {
  const data = payload?.data || payload || {};

  return {
    objectIdentifiers: Array.isArray(data.objectIdentifiers) ? data.objectIdentifiers : [],
    mimeCodes: Array.isArray(data.mimeCodes)
      ? data.mimeCodes.filter((option) => ALLOWED_ATTACHMENT_MIME_TYPES.includes(option?.Value))
      : []
  };
};

const objectIdentifierLabel = (option) =>
  String(option?.DisplayName || option?.Value || '').trim();

const objectIdentifierSearchText = (option) =>
  `${objectIdentifierLabel(option)} ${option?.Value || ''}`.toLowerCase();

const findObjectIdentifierOption = (value, options = []) => {
  const selectedValue = String(value || '');
  return options.find((option) => String(option?.Value || '') === selectedValue);
};

const SupportingDocumentEntryModal = ({
  isOpen,
  onClose,
  invoiceNumber,
  documentConfig,
  onSaved
}) => {
  const snackbar = useSnackbar();
  const [outDocumentTab, setOutDocumentTab] = useState('attachment');
  const [outDocumentForm, setOutDocumentForm] = useState(emptyOutDocumentForm);
  const [outDocumentOptions, setOutDocumentOptions] = useState({
    objectIdentifiers: [],
    mimeCodes: []
  });
  const [isOutDocumentLoading, setIsOutDocumentLoading] = useState(false);
  const [isOutDocumentSaving, setIsOutDocumentSaving] = useState(false);
  const [isOutDocumentAttachmentLoading, setIsOutDocumentAttachmentLoading] = useState(false);
  const [isOutDocumentAttachmentEditing, setIsOutDocumentAttachmentEditing] = useState(false);
  const [outDocumentError, setOutDocumentError] = useState('');
  const [objectIdentifierSearch, setObjectIdentifierSearch] = useState('');
  const [isObjectIdentifierPickerOpen, setIsObjectIdentifierPickerOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setOutDocumentError('');
      return;
    }

    setOutDocumentTab('attachment');
    setOutDocumentForm(mapOutDocumentRecordToForm({}, invoiceNumber));
    setObjectIdentifierSearch('');
    setIsObjectIdentifierPickerOpen(false);
    setIsOutDocumentAttachmentEditing(false);
    setIsOutDocumentLoading(true);
    setOutDocumentError('');

    Promise.all([
      apiFetch(`${documentConfig.detailsUrl}/out-document/options`),
      apiFetch(`${documentConfig.detailsUrl}/${encodeURIComponent(invoiceNumber)}/out-document`)
    ])
      .then(async ([optionsResponse, documentResponse]) => {
        const optionsPayload = await optionsResponse.json();
        const documentPayload = await documentResponse.json();

        if (!optionsResponse.ok) {
          throw new Error(optionsPayload?.message || 'Failed to load dropdown options');
        }

        if (!documentResponse.ok) {
          throw new Error(documentPayload?.message || 'Failed to load supporting document');
        }

        const options = mapOutDocumentOptions(optionsPayload);
        const form = mapOutDocumentRecordToForm(documentPayload, invoiceNumber);
        const selectedOption = findObjectIdentifierOption(
          form.invoiced_obj_scheme_id,
          options.objectIdentifiers
        );

        setOutDocumentOptions(options);
        setOutDocumentForm(form);
        setObjectIdentifierSearch(
          selectedOption ? objectIdentifierLabel(selectedOption) : form.invoiced_obj_scheme_id
        );
      })
      .catch((err) => {
        console.error('Invoice out document fetch error', err);
        setOutDocumentError(err.message || 'Failed to load supporting document');
        setOutDocumentForm(mapOutDocumentRecordToForm({}, invoiceNumber));
      })
      .finally(() => setIsOutDocumentLoading(false));
  }, [documentConfig.detailsUrl, invoiceNumber, isOpen]);

  const handleOutDocumentFieldChange = (event) => {
    const { name, value } = event.target;
    setOutDocumentForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handleObjectIdentifierSearchChange = (event) => {
    setObjectIdentifierSearch(event.target.value);
    setIsObjectIdentifierPickerOpen(true);
    setOutDocumentForm((current) => ({
      ...current,
      invoiced_obj_scheme_id: ''
    }));
  };

  const handleObjectIdentifierSelect = (option) => {
    setOutDocumentForm((current) => ({
      ...current,
      invoiced_obj_scheme_id: option?.Value || ''
    }));
    setObjectIdentifierSearch(objectIdentifierLabel(option));
    setIsObjectIdentifierPickerOpen(false);
  };

  const handleOutDocumentFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const mimeCode = getAttachmentMimeCode(file);

    if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(mimeCode)) {
      snackbar.error('Selected file type is not supported');
      event.target.value = '';
      return;
    }

    try {
      const base64Document = await readFileAsBase64(file);
      setOutDocumentForm((current) => ({
        ...current,
        attached_document: base64Document,
        attached_doc_mime_code: mimeCode,
        attached_doc_filename: file.name,
        has_attached_document: true
      }));
    } catch (err) {
      console.error('Attachment read error', err);
      snackbar.error(err.message || 'Failed to read selected file');
    }
  };

  const handleSaveOutDocument = async () => {
    if (!invoiceNumber) {
      snackbar.error(`${documentConfig.title} number is missing`);
      return;
    }

    if (outDocumentForm.attached_document && (!outDocumentForm.attached_doc_mime_code || !outDocumentForm.attached_doc_filename)) {
      snackbar.error('Please select an attached document again');
      return;
    }

    if (objectIdentifierSearch && !outDocumentForm.invoiced_obj_scheme_id) {
      snackbar.error('Please select object identifier scheme from the list');
      return;
    }

    setIsOutDocumentSaving(true);
    setOutDocumentError('');

    try {
      const response = await apiFetch(
        `${documentConfig.detailsUrl}/${encodeURIComponent(invoiceNumber)}/out-document`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            invoiced_obj_id: invoiceNumber,
            invoiced_obj_scheme_id: outDocumentForm.invoiced_obj_scheme_id,
            document_type_code: '130',
            support_doc_ref: outDocumentForm.support_doc_ref,
            support_doc_desc: outDocumentForm.support_doc_desc,
            attached_document: outDocumentForm.attached_document,
            has_attached_document: outDocumentForm.has_attached_document,
            attached_doc_mime_code: outDocumentForm.attached_doc_mime_code,
            attached_doc_filename: outDocumentForm.attached_doc_filename,
            external_doc_location: outDocumentForm.external_doc_location
          })
        }
      );
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to save supporting document');
      }

      await onSaved?.();
      onClose?.();
      snackbar.success(payload?.message || 'Supporting document saved successfully');
    } catch (err) {
      console.error('Invoice out document save error', err);
      setOutDocumentError(err.message || 'Failed to save supporting document');
      snackbar.error(`Failed to save supporting document: ${err.message}`);
    } finally {
      setIsOutDocumentSaving(false);
    }
  };

  const handleOutDocumentAttachmentAction = async (disposition) => {
    if (!invoiceNumber) {
      snackbar.error(`${documentConfig.title} number is missing`);
      return;
    }

    setIsOutDocumentAttachmentLoading(true);

    try {
      const response = await apiFetch(
        `${documentConfig.detailsUrl}/${encodeURIComponent(invoiceNumber)}/out-document/attachment?disposition=${disposition}`
      );

      if (!response.ok) {
        let message = 'Failed to load attachment';
        try {
          const payload = await response.json();
          message = payload?.message || message;
        } catch {
          // Leave the generic message for non-JSON attachment errors.
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const filename = outDocumentForm.attached_doc_filename || `attachment-${invoiceNumber}`;

      if (disposition === 'attachment') {
        downloadBlob(blob, filename);
      } else {
        const url = window.URL.createObjectURL(blob);
        const openedWindow = window.open(url, '_blank', 'noopener,noreferrer');
        if (!openedWindow) {
          snackbar.error('Unable to open attachment viewer');
        }
        window.setTimeout(() => window.URL.revokeObjectURL(url), 30000);
      }
    } catch (err) {
      console.error('Invoice attachment load error', err);
      snackbar.error(`Failed to load attachment: ${err.message}`);
    } finally {
      setIsOutDocumentAttachmentLoading(false);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'attachment', label: 'Attachment', icon: Upload }
  ];
  const objectIdentifierSearchValue = objectIdentifierSearch.trim().toLowerCase();
  const filteredObjectIdentifiers = outDocumentOptions.objectIdentifiers.filter((option) =>
    !objectIdentifierSearchValue || objectIdentifierSearchText(option).includes(objectIdentifierSearchValue)
  );
  const hasSavedOutDocumentAttachment = outDocumentForm.has_attached_document && !outDocumentForm.attached_document;
  const isOutDocumentFileInputDisabled = hasSavedOutDocumentAttachment && !isOutDocumentAttachmentEditing;
  const outDocumentAttachmentTitle = outDocumentForm.has_attached_document
    ? (outDocumentForm.attached_doc_filename || 'Attachment ready')
    : 'No attachment selected';
  const outDocumentAttachmentHint = hasSavedOutDocumentAttachment
    ? (isOutDocumentAttachmentEditing ? 'Choose a new file to replace this attachment' : 'Current attachment is saved')
    : (outDocumentForm.attached_document ? 'New file ready to save' : 'Choose a supported file to attach');

  return (
    <>
      <div className="out-document-backdrop" onClick={onClose} />
      <div className="transaction-modal out-document-modal" role="dialog" aria-modal="true">
        <div className="transaction-modal-header">
          <div>
            <p className="transaction-modal-kicker">Supporting Entry</p>
            <h2 className="transaction-modal-title">{invoiceNumber}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} title="Close">
            <X size={22} />
          </button>
        </div>

        <div className="transaction-modal-body out-document-modal-body">
          <div className="out-document-content-layout">
            <aside className="out-document-sidebar" aria-label="Supporting document sections">
              <div className="transaction-tabs out-document-tabs">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    className={`transaction-tab-btn ${outDocumentTab === id ? 'active' : ''}`}
                    onClick={() => setOutDocumentTab(id)}
                    type="button"
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>
            </aside>

            <div className="out-document-main">
              {outDocumentError && <div className="transaction-error">{outDocumentError}</div>}

              {isOutDocumentLoading ? (
                <div className="transaction-loading">
                  <Loader2 className="spin-icon" size={20} />
                  <span>Loading supporting document...</span>
                </div>
              ) : (
                <div className="out-document-form-shell">
                  <div className="out-document-form-grid">
                    <label className="out-document-field">
                      <span>Invoiced object identifier scheme</span>
                      <div
                        className="out-document-search-picker"
                        onBlur={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget)) {
                            setIsObjectIdentifierPickerOpen(false);
                          }
                        }}
                      >
                        <input
                          name="invoiced_obj_scheme_search"
                          value={objectIdentifierSearch}
                          onChange={handleObjectIdentifierSearchChange}
                          onFocus={() => setIsObjectIdentifierPickerOpen(true)}
                          placeholder="Search scheme"
                          autoComplete="off"
                        />
                        {isObjectIdentifierPickerOpen && (
                          <div className="out-document-search-options">
                            {filteredObjectIdentifiers.length > 0 ? (
                              filteredObjectIdentifiers.map((option) => (
                                <button
                                  key={`${option.Value}-${option.DisplayName}`}
                                  className="out-document-search-option"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => handleObjectIdentifierSelect(option)}
                                  type="button"
                                >
                                  <span>{objectIdentifierLabel(option)}</span>
                                </button>
                              ))
                            ) : (
                              <div className="out-document-search-empty">No schemes found</div>
                            )}
                          </div>
                        )}
                      </div>
                    </label>

                    <label className="out-document-field">
                      <span>Supporting document reference</span>
                      <input
                        name="support_doc_ref"
                        value={outDocumentForm.support_doc_ref}
                        onChange={handleOutDocumentFieldChange}
                      />
                    </label>

                    <label className="out-document-field out-document-field-wide">
                      <span>Supporting document description</span>
                      <textarea
                        name="support_doc_desc"
                        value={outDocumentForm.support_doc_desc}
                        onChange={handleOutDocumentFieldChange}
                        rows={1}
                      />
                    </label>

                    <div className="out-document-attachment-panel out-document-field-wide">
                      <div className="out-document-attachment-panel-header">
                        <span>Attached document</span>
                      </div>

                      <div className="out-document-attachment-panel-content">
                        <div className="out-document-attachment-summary">
                          <span className="out-document-attachment-icon" aria-hidden="true">
                            <FileCheck2 size={18} />
                          </span>
                          <div className="out-document-attachment-copy">
                            <span className="out-document-attachment-title" title={outDocumentAttachmentTitle}>
                              {outDocumentAttachmentTitle}
                            </span>
                            <span className="out-document-attachment-hint">
                              {outDocumentAttachmentHint}
                            </span>
                          </div>
                        </div>

                        <label className="out-document-file-picker">
                          <span className="out-document-file-picker-label">Choose file</span>
                          <input
                            type="file"
                            accept={ATTACHMENT_FILE_ACCEPT}
                            disabled={isOutDocumentFileInputDisabled}
                            onChange={handleOutDocumentFileChange}
                          />
                        </label>

                        {hasSavedOutDocumentAttachment && (
                          <div className="out-document-attachment-actions">
                            <button
                              className={`out-document-attachment-action-btn out-document-attachment-edit-btn ${isOutDocumentAttachmentEditing ? 'active' : ''}`}
                              onClick={() => setIsOutDocumentAttachmentEditing(true)}
                              aria-pressed={isOutDocumentAttachmentEditing}
                              type="button"
                            >
                              <Pencil size={15} /> {isOutDocumentAttachmentEditing ? 'Editing' : 'Edit'}
                            </button>
                            <button
                              className="out-document-attachment-action-btn out-document-attachment-download-btn"
                              onClick={() => handleOutDocumentAttachmentAction('attachment')}
                              disabled={isOutDocumentAttachmentLoading || isOutDocumentAttachmentEditing}
                              type="button"
                            >
                              <Download size={15} /> Download
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <label className="out-document-field out-document-field-wide">
                      <span>External document location</span>
                      <input
                        name="external_doc_location"
                        value={outDocumentForm.external_doc_location}
                        onChange={handleOutDocumentFieldChange}
                      />
                    </label>
                  </div>
                </div>
              )}

              <div className="out-document-actions">
                <button
                  className="btn btn-outline"
                  onClick={onClose}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveOutDocument}
                  disabled={isOutDocumentLoading || isOutDocumentSaving}
                  type="button"
                >
                  {isOutDocumentSaving ? <Loader2 className="spin-icon" size={16} /> : <Save size={16} />}
                  {isOutDocumentSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SupportingDocumentEntryModal;
