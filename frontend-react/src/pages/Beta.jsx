import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api';

const blankFilters = {
  q: '',
  flow: '',
  cvlkraStatus: '',
  currentStage: ''
};

const blockedPushPans = new Set([
  'EUXPA0011G',
  'BSBPH1408R',
  'DAFPK5513Q',
  'HJEPM7970R',
  'JNYPM9317Q',
  'AKAPN8939K',
  'AUJPR2926D',
  'GKMPS6855K',
  'CEQPG6014L',
  'BTUPB7271G',
  'KPUPS9096M',
  'ALQPN5323G'
]);

const isBlockedPushPan = (pan) => blockedPushPans.has(String(pan || '').trim().toUpperCase());

const cvlkraIssueText = (row) => [
  row?.cvlkra?.status,
  row?.cvlkra?.error,
  row?.cvlkra?.remarks,
  row?.cvlkra?.errorCode
].filter(Boolean).join(' ').toLowerCase();

const hasKraNameMismatch = (row) => cvlkraIssueText(row).includes('name mismatch with income tax');

const hasKraXmlHold = (row) => {
  const issueText = cvlkraIssueText(row);
  return (
    issueText.includes('aadhaar xml file not provided') ||
    issueText.includes('xml aadhaar validation failed')
  );
};

const displayCvlkra = (row) => {
  if (hasKraNameMismatch(row)) {
    return {
      ...(row.cvlkra || {}),
      status: 'Name_Mismatch',
      error: row.cvlkra?.error || 'Name mismatch with Income Tax. Client consent/correction needed.'
    };
  }

  if (hasKraXmlHold(row)) {
    return {
      ...(row.cvlkra || {}),
      status: 'XML_Hold',
      error: row.cvlkra?.error || 'Aadhaar XML validation/document issue.'
    };
  }

  return row.cvlkra;
};

const statusTone = (status) => {
  const value = String(status || '').toLowerCase();
  if (['success', 'passed', 'documents_uploaded', 'uploaded', 's'].includes(value)) return '#22c55e';
  if (['name_mismatch', 'xml_hold', 'kra_xml_hold'].some(x => value.includes(x))) return '#f97316';
  if (['pending', 'under process', 'documents uploaded'].some(x => value.includes(x))) return '#eab308';
  if (['failed', 'rejected', 'error', 'hold'].some(x => value.includes(x))) return '#ef4444';
  return '#94a3b8';
};

const badge = (status) => (
  <span
    style={{
      display: 'inline-flex',
      maxWidth: 180,
      padding: '3px 9px',
      borderRadius: 999,
      background: `${statusTone(status)}22`,
      color: statusTone(status),
      fontSize: '0.75rem',
      fontWeight: 700,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }}
    title={status || ''}
  >
    {status || '-'}
  </span>
);

const text = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return '-';
  return String(value);
};

const tableColumnStyles = {
  select: { width: 48 },
  pan: { width: 112 },
  clientCode: { width: 92 },
  application: { width: 110 },
  name: { width: 230 },
  stage: { width: 110 },
  integration: { width: 260 },
  xml: { width: 100 }
};

const statusCell = (integration, actions = []) => {
  const status = text(integration?.status);
  const error = text(integration?.error);
  const title = error === '-' ? status : `${status}\n${error}`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
        minWidth: 0,
        maxWidth: 240
      }}
      title={title}
    >
      {badge(integration?.status)}
      <div
        style={{
          width: '100%',
          color: 'var(--text-muted)',
          fontSize: '0.72rem',
          lineHeight: 1.25,
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word'
        }}
      >
        {error}
      </div>
      {actions.length > 0 ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {actions.map(action => (
            <button
              key={action.key}
              className={action.primary ? 'beta-primary-btn' : 'beta-secondary-btn'}
              onClick={action.onClick}
              disabled={action.disabled}
              title={action.title || action.label}
              style={{
                padding: '5px 8px',
                fontSize: '0.72rem',
                minHeight: 28,
                opacity: action.disabled ? 0.48 : 1,
                background: action.disabled ? 'var(--subtle-surface)' : (action.primary ? 'var(--primary-color)' : '#2563eb'),
                borderColor: action.disabled ? 'var(--surface-border)' : (action.primary ? 'var(--primary-color)' : '#1d4ed8'),
                color: action.disabled ? 'var(--text-muted)' : '#fff',
                boxShadow: action.disabled ? 'none' : '0 2px 8px rgba(37, 99, 235, 0.28)'
              }}
            >
              {action.loading ? (action.loadingLabel || 'Loading...') : action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const isStatusSuccess = (status) => {
  const value = String(status || '').toLowerCase();
  return ['success', 'passed', 'success(s)', 's'].includes(value) || value.startsWith('success');
};
const isStatusFailed = (status) => {
  const value = String(status || '').toLowerCase();
  return ['failed', 'rejected'].some(term => value.includes(term));
};
const isCdslUploaded = (row) => {
  const status = String(row?.cdsl?.status || '').toLowerCase();
  if (status === 'uploaded') return true;
  if (isStatusSuccess(status) || isStatusFailed(status)) return false;
  return Boolean(row?.cdsl?.ackId && row?.cdsl?.zipFileName);
};

const isStatusPendingLike = (status) => {
  const value = String(status || '').toLowerCase();
  return !value || value === '-' || [
    'pending',
    'not pushed',
    'rejected',
    'failed',
    'unclear',
    'not_accepted',
    'not accepted',
    'fetch_failed',
    'fetch failed'
  ].some(term => value.includes(term));
};

const getRowKey = (row) => `${row.flow_type}-${row.application_id}-${row.pan || ''}`;
const isFinalCdslRow = (row) => isStatusSuccess(row?.cdsl?.status) || isStatusFailed(row?.cdsl?.status);

const applyRowOverrides = (row, overrides) => {
  const override = overrides[getRowKey(row)];
  if (!override || isFinalCdslRow(row)) return row;

  return {
    ...row,
    ...override,
    cdsl: {
      ...(row.cdsl || {}),
      ...(override.cdsl || {})
    }
  };
};

const markCdslWaitingOverride = (row) => ({
  cdsl: {
    status: 'Uploaded',
    ackId: row?.cdsl?.ackId,
    zipFileName: row?.cdsl?.zipFileName,
    error: 'Uploaded to CDSL; waiting for final response'
  }
});

const pushLabel = (target) => ({
  cvlkra: 'KRA Push',
  cvlkra_document: 'Doc Push',
  cvlkra_status: 'Check KRA',
  cdsl: 'CDSL Push',
  cdsl_status: 'CDSL Check',
  nse: 'NSE Push',
  bse: 'BSE Push',
  techexcel: 'TechExcel Push'
}[target] || target);

const loadingLabel = (target) => ({
  cvlkra: 'Pushing KRA...',
  cvlkra_document: 'Uploading docs...',
  cvlkra_status: 'Checking KRA...',
  cdsl: 'Pushing CDSL...',
  cdsl_status: 'Checking CDSL...',
  nse: 'Pushing NSE...',
  bse: 'Pushing BSE...',
  techexcel: 'Pushing TechExcel...'
}[target] || 'Loading...');

const includesText = (row, query) => {
  if (!query) return true;
  const tokens = query
    .split(/[\n,]+/)
    .map(token => token.trim().toLowerCase())
    .filter(Boolean);
  const needles = tokens.length > 1 ? tokens : [query.trim().toLowerCase()].filter(Boolean);
  const exactFields = [
    row.pan,
    row.client_code,
    row.application_id
  ].map(value => String(value || '').trim().toLowerCase());
  const searchableFields = [
    ...exactFields,
    row.client_name,
    row.current_step,
    row.cvlkra?.status,
    row.cdsl?.status,
    row.nse?.status,
    row.bse?.status,
    row.techexcel?.status,
    row.xml_status
  ];

  if (tokens.length > 1) {
    return needles.some(needle => exactFields.includes(needle));
  }

  return [
    ...searchableFields
  ].some(value => String(value || '').toLowerCase().includes(needles[0]));
};

const targetDisabledReason = (target, row) => {
  const cdslSuccess = isStatusSuccess(row.cdsl?.status);
  const cdslUploaded = isCdslUploaded(row);
  const directKraFlow = row.flow_type === 'KRA';
  const cvlkraStatus = String(row.cvlkra?.status || '').toLowerCase();
  const nameMismatchReason = 'Name mismatch with Income Tax. Do not push without client consent.';

  if (target === 'cvlkra') {
    if (hasKraNameMismatch(row)) return nameMismatchReason;
    if (isBlockedPushPan(row.pan)) return 'Push blocked: KYC team completed KRA manually for this PAN';
    if (!isStatusPendingLike(row.cvlkra?.status)) return 'CVL KRA is not pending';
    return '';
  }

  if (target === 'cvlkra_document') {
    if (hasKraNameMismatch(row)) return nameMismatchReason;
    if (isBlockedPushPan(row.pan)) return 'Push blocked: KYC team completed KRA manually for this PAN';
    if (directKraFlow) return 'Not needed for direct KRA flow';
    if (!isStatusSuccess(row.cvlkra?.status) && cvlkraStatus !== 'documents_uploaded') return 'Fresh KRA must be accepted before document upload';
    return '';
  }

  if (target === 'cvlkra_status') {
    if (!row.cvlkra?.status) return 'No CVL KRA row/status available to check';
    return '';
  }

  if (isBlockedPushPan(row.pan)) {
    return 'Push blocked: KYC team completed KRA manually for this PAN';
  }

  if (target === 'cdsl') {
    if (isStatusSuccess(row.cdsl?.status)) return 'CDSL is already success';
    if (cdslUploaded) return 'Use CDSL Check for uploaded rows';
    return '';
  }

  if (target === 'cdsl_status') {
    if (!cdslUploaded) return 'CDSL status must be Uploaded';
    return '';
  }

  if (['nse', 'bse', 'techexcel'].includes(target)) {
    if (!cdslSuccess) return 'CDSL must be success first';
    if (!isStatusPendingLike(row[target]?.status)) return `${pushLabel(target)} is not pending`;
    return '';
  }

  return '';
};

const batchTargetsForFlow = (flowType) => (
  flowType === 'KRA'
    ? ['cvlkra', 'cvlkra_status', 'cdsl', 'cdsl_status', 'nse', 'bse', 'techexcel']
    : ['cvlkra', 'cvlkra_document', 'cvlkra_status', 'cdsl', 'cdsl_status', 'nse', 'bse', 'techexcel']
);

function BetaTable({
  title,
  description,
  flowType,
  rows,
  localFilter,
  onLocalFilter,
  onPush,
  onPushSelected,
  pushingKey,
  selectedKeys,
  onToggleRow,
  onToggleVisibleRows,
  onClearSelection
}) {
  const filteredRows = useMemo(
    () => rows.filter(row => includesText(row, localFilter)),
    [rows, localFilter]
  );
  const filteredKeys = useMemo(() => filteredRows.map(getRowKey), [filteredRows]);
  const selectedRows = useMemo(
    () => filteredRows.filter(row => selectedKeys.has(getRowKey(row))),
    [filteredRows, selectedKeys]
  );
  const selectedCount = selectedRows.length;
  const allVisibleSelected = filteredKeys.length > 0 && filteredKeys.every(key => selectedKeys.has(key));

  const actionKey = (target, row) => `${target}:${row.application_id}:${row.pan || ''}`;

  const makeAction = (target, row, label, title = '') => {
    const key = actionKey(target, row);
    const loading = pushingKey === key;
    const disabledReason = targetDisabledReason(target, row);
    return {
      key,
      label,
      loadingLabel: loadingLabel(target),
      loading,
      disabled: Boolean(disabledReason) || Boolean(pushingKey),
      title: disabledReason || title,
      onClick: () => onPush(target, row)
    };
  };

  const rowActions = (row) => {
    const cdslSuccess = isStatusSuccess(row.cdsl?.status);
    const cdslUploaded = isCdslUploaded(row);
    const directKraFlow = row.flow_type === 'KRA';

    return {
      cvlkra: directKraFlow
        ? [
          makeAction('cvlkra', row, 'Push KRA', 'Submit the CVL KRA entry'),
          makeAction('cvlkra_status', row, 'Check KRA', 'Fetch final CVL KRA status and update the DB')
        ]
        : [
          makeAction('cvlkra', row, 'Push KRA', 'Submit the fresh CVL KRA entry'),
          makeAction('cvlkra_document', row, 'Upload Docs', 'Upload KRA PDF/XML documents'),
          makeAction('cvlkra_status', row, 'Check KRA', 'Fetch final CVL KRA status and update the DB')
        ],
      cdsl: cdslUploaded
        ? [makeAction('cdsl_status', row, 'Check CDSL', 'Download and apply the final CDSL response')]
        : [
          makeAction('cdsl', row, 'Push CDSL', 'Push this record to CDSL')
        ],
      nse: [makeAction('nse', row, 'Push NSE', cdslSuccess ? 'Push this record to NSE' : 'CDSL must be success before NSE')],
      bse: [makeAction('bse', row, 'Push BSE', cdslSuccess ? 'Push this record to BSE' : 'CDSL must be success before BSE')],
      techexcel: [makeAction('techexcel', row, 'Push TechExcel', cdslSuccess ? 'Push this record to TechExcel' : 'CDSL must be success before TechExcel')]
    };
  };

  const batchTargets = batchTargetsForFlow(flowType);
  const batchButton = (target) => {
    const eligibleRows = selectedRows.filter(row => !targetDisabledReason(target, row));
    const disabled = selectedCount === 0 || eligibleRows.length === 0 || Boolean(pushingKey);
    const loading = pushingKey === `batch:${target}`;
    return (
      <button
        key={target}
        className="beta-primary-btn"
        disabled={disabled}
        onClick={() => onPushSelected(target, eligibleRows, selectedCount - eligibleRows.length)}
        title={eligibleRows.length ? `${pushLabel(target)} for ${eligibleRows.length} selected row(s)` : 'No selected rows are eligible for this push'}
        style={{
          padding: '7px 10px',
          fontSize: '0.78rem',
          opacity: disabled ? 0.48 : 1,
          background: disabled ? 'var(--subtle-surface)' : 'var(--primary-color)',
          borderColor: disabled ? 'var(--surface-border)' : 'var(--primary-color)',
          color: disabled ? 'var(--text-muted)' : '#fff',
          boxShadow: disabled ? 'none' : '0 2px 8px rgba(37, 99, 235, 0.28)'
        }}
      >
        {loading ? loadingLabel(target) : `${pushLabel(target)} (${eligibleRows.length})`}
      </button>
    );
  };

  return (
    <section className="beta-section" style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{title}</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>{description}</p>
        </div>
        <input
          value={localFilter}
          onChange={event => onLocalFilter(event.target.value)}
          placeholder="Filter this section"
          style={{ minWidth: 240, padding: '9px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
          padding: '10px 12px',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          background: 'var(--subtle-surface)'
        }}
      >
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', fontWeight: 700 }}>
          {selectedCount} selected in this section
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {batchTargets.map(batchButton)}
          <button className="beta-secondary-btn" onClick={() => onClearSelection(filteredKeys)} disabled={!selectedCount || Boolean(pushingKey)}>
            Clear
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
        <table style={{ width: '100%', minWidth: 1810, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={tableColumnStyles.select}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={!filteredRows.length || Boolean(pushingKey)}
                  onChange={() => onToggleVisibleRows(filteredRows, !allVisibleSelected)}
                  aria-label={`Select all visible ${title} rows`}
                />
              </th>
              <th style={tableColumnStyles.pan}>PAN</th>
              <th style={tableColumnStyles.clientCode}>CC</th>
              <th style={tableColumnStyles.application}>Application</th>
              <th style={tableColumnStyles.name}>Name</th>
              <th style={tableColumnStyles.stage}>Stage</th>
              <th style={tableColumnStyles.integration}>CVL KRA</th>
              <th style={tableColumnStyles.integration}>CDSL</th>
              <th style={tableColumnStyles.integration}>NSE</th>
              <th style={tableColumnStyles.integration}>BSE</th>
              <th style={tableColumnStyles.integration}>TechExcel</th>
              <th style={tableColumnStyles.xml}>XML</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan="12" style={{ textAlign: 'center', padding: 18 }}>No records found.</td></tr>
            ) : filteredRows.map(row => {
              const actions = rowActions(row);
              const key = getRowKey(row);
              return (
                <tr key={key}>
                  <td style={{ ...tableColumnStyles.select, verticalAlign: 'top' }}>
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(key)}
                      disabled={Boolean(pushingKey)}
                      onChange={() => onToggleRow(key)}
                      aria-label={`Select ${row.pan || row.application_id}`}
                    />
                  </td>
                  <td style={{ ...tableColumnStyles.pan, fontFamily: 'monospace', fontWeight: 700, verticalAlign: 'top' }}>{text(row.pan)}</td>
                  <td style={{ ...tableColumnStyles.clientCode, fontFamily: 'monospace', verticalAlign: 'top' }}>{text(row.client_code)}</td>
                  <td style={{ ...tableColumnStyles.application, verticalAlign: 'top' }}>{text(row.application_id)}</td>
                  <td style={{ ...tableColumnStyles.name, verticalAlign: 'top', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{text(row.client_name)}</td>
                  <td style={{ ...tableColumnStyles.stage, verticalAlign: 'top' }}>{text(row.current_step)}</td>
                  <td style={{ ...tableColumnStyles.integration, verticalAlign: 'top' }}>{statusCell(displayCvlkra(row), actions.cvlkra)}</td>
                  <td style={{ ...tableColumnStyles.integration, verticalAlign: 'top' }}>{statusCell(row.cdsl, actions.cdsl)}</td>
                  <td style={{ ...tableColumnStyles.integration, verticalAlign: 'top' }}>{statusCell(row.nse, actions.nse)}</td>
                  <td style={{ ...tableColumnStyles.integration, verticalAlign: 'top' }}>{statusCell(row.bse, actions.bse)}</td>
                  <td style={{ ...tableColumnStyles.integration, verticalAlign: 'top' }}>{statusCell(row.techexcel, actions.techexcel)}</td>
                  <td style={{ ...tableColumnStyles.xml, verticalAlign: 'top' }}>{badge(row.xml_status)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Beta() {
  const [filters, setFilters] = useState(blankFilters);
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [pushingKey, setPushingKey] = useState('');
  const [message, setMessage] = useState('');
  const [kraLocalFilter, setKraLocalFilter] = useState('');
  const [digiLocalFilter, setDigiLocalFilter] = useState('');
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [rowOverrides, setRowOverrides] = useState({});
  const [responseCopied, setResponseCopied] = useState(false);

  const updateFilter = (key, value) => {
    setFilters(current => ({ ...current, [key]: value }));
  };

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      setEntries([]);
      setSummary({});
      const params = { ...filters, completed: 'true', limit: 500 };
      Object.keys(params).forEach(key => {
        if (params[key] === '') delete params[key];
      });
      const response = await api.getBetaEntries(params);
      const nextEntries = response?.data || [];
      setEntries(nextEntries);
      setSummary(response?.summary || {});
      setSelectedKeys(current => {
        const validKeys = new Set(nextEntries.map(getRowKey));
        return new Set([...current].filter(key => validKeys.has(key)));
      });
      setRowOverrides(current => {
        const next = {};
        nextEntries.forEach(row => {
          const key = getRowKey(row);
          if (current[key] && !isFinalCdslRow(row)) next[key] = current[key];
        });
        return next;
      });
      if (response?.forbidden) setMessage(response.message || 'Admin access required.');
    } catch (error) {
      setMessage(error.message || 'Failed to load beta entries.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const displayEntries = useMemo(
    () => entries
      .map(row => applyRowOverrides(row, rowOverrides))
      .filter(row => includesText(row, filters.q)),
    [entries, rowOverrides, filters.q]
  );

  const grouped = useMemo(() => {
    const kra = displayEntries.filter(row => row.flow_type === 'KRA');
    const digilocker = displayEntries.filter(row => row.flow_type === 'DigiLocker');
    return { kra, digilocker };
  }, [displayEntries]);

  const copyKraPans = async () => {
    const pans = grouped.kra.map(row => row.pan).filter(Boolean).join('\n');
    if (!pans) {
      setMessage('No KRA flow PANs available for the current filter.');
      return;
    }
    await navigator.clipboard.writeText(pans);
    setMessage(`Copied ${grouped.kra.length} KRA flow PAN(s).`);
  };

  const copyResponse = async () => {
    if (!message) return;
    await navigator.clipboard.writeText(message);
    setResponseCopied(true);
    window.setTimeout(() => setResponseCopied(false), 1600);
  };

  const toggleRow = (key) => {
    setSelectedKeys(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleVisibleRows = (rowsToToggle, shouldSelect) => {
    setSelectedKeys(current => {
      const next = new Set(current);
      rowsToToggle.forEach(row => {
        const key = getRowKey(row);
        if (shouldSelect) next.add(key);
        else next.delete(key);
      });
      return next;
    });
  };

  const clearSelectedRows = (keysToClear) => {
    setSelectedKeys(current => {
      const next = new Set(current);
      keysToClear.forEach(key => next.delete(key));
      return next;
    });
  };

  const buildBatchPayload = (target, rows) => {
    const applicationIds = rows.map(row => Number(row.application_id)).filter(Boolean);
    const pans = [...new Set(rows.map(row => row.pan).filter(Boolean))];

    if (target === 'cvlkra') {
      return {
        pans,
        applicationIds,
        limit: rows.length
      };
    }

    if (target === 'cvlkra_document') {
      return {
        mode: 'documentUploadOnly',
        applicationIds,
        pans,
        limit: rows.length,
        reconcileFinalStatus: true
      };
    }

    if (target === 'cvlkra_status') {
      return {
        mode: 'kraStatus',
        applicationIds,
        pans,
        limit: rows.length
      };
    }

    if (target === 'cdsl_status') {
      return {
        mode: 'uploadedStatus',
        applicationIds,
        pans,
        limit: rows.length,
        minAgeMinutes: 0,
        forceDownload: true
      };
    }

    return {
      mode: 'process',
      applicationIds,
      pans,
      limit: rows.length
    };
  };

  const pushSelected = async (target, rows, skippedCount = 0) => {
    if (!rows.length) return;
    const label = `${pushLabel(target)} for ${rows.length} selected row(s)`;
    const skipText = skippedCount ? ` ${skippedCount} selected row(s) are not eligible and will be skipped.` : '';
    if (!window.confirm(`Push ${label}?${skipText}`)) return;

    setPushingKey(`batch:${target}`);
    setResponseCopied(false);
    setMessage(`Sending ${label}...${skipText}`);
    try {
      const payload = buildBatchPayload(target, rows);
      const firstRow = rows[0];
      const response = await api.pushBetaEntry({
        target,
        applicationId: firstRow.application_id,
        pan: firstRow.pan,
        payload
      });
      if (target === 'cdsl' || target === 'cdsl_status') {
        setRowOverrides(current => {
          const next = { ...current };
          rows.forEach(row => {
            next[getRowKey(row)] = markCdslWaitingOverride(row);
          });
          return next;
        });
      }
      await loadEntries();
      setMessage(JSON.stringify(response, null, 2));
    } catch (error) {
      setMessage(error.payload ? JSON.stringify(error.payload, null, 2) : (error.message || `Push failed for ${label}.`));
    } finally {
      setPushingKey('');
    }
  };

  const pushRow = async (target, row) => {
    const label = `${row.pan || row.application_id} via ${pushLabel(target)}`;
    if (!window.confirm(`Push ${label}?`)) return;
    const nextPushingKey = `${target}:${row.application_id}:${row.pan || ''}`;
    setPushingKey(nextPushingKey);
    setResponseCopied(false);
    setMessage(`Sending ${label}...`);
    try {
      const payload = target === 'cdsl_status'
        ? {
          mode: 'uploadedStatus',
          applicationIds: [row.application_id],
          pans: row.pan ? [row.pan] : [],
          limit: 1,
          minAgeMinutes: 0,
          forceDownload: true
        }
        : undefined;
      const response = await api.pushBetaEntry({
        target,
        applicationId: row.application_id,
        pan: row.pan,
        ...(payload ? { payload } : {})
      });
      if (target === 'cdsl' || target === 'cdsl_status') {
        setRowOverrides(current => ({
          ...current,
          [getRowKey(row)]: markCdslWaitingOverride(row)
        }));
      }
      await loadEntries();
      setMessage(JSON.stringify(response, null, 2));
    } catch (error) {
      setMessage(error.payload ? JSON.stringify(error.payload, null, 2) : (error.message || `Push failed for ${label}.`));
    } finally {
      setPushingKey('');
    }
  };

  return (
    <div className="table-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem' }}>Beta Push Desk</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>PAN, client code, flow type, integration status, and controlled push actions.</p>
        </div>
        <button className="beta-secondary-btn" onClick={copyKraPans}>Copy KRA PANs</button>
      </div>

      <div className="beta-filter-panel">
        <div className="beta-filter-grid">
          <input value={filters.q} onChange={e => updateFilter('q', e.target.value)} placeholder="Search PAN, CC, name, application" />
          <select value={filters.flow} onChange={e => updateFilter('flow', e.target.value)}>
            <option value="">All flows</option>
            <option value="KRA">KRA flow</option>
            <option value="DigiLocker">DigiLocker flow</option>
            <option value="Unknown">Unknown</option>
          </select>
          <input value={filters.cvlkraStatus} onChange={e => updateFilter('cvlkraStatus', e.target.value)} placeholder="CVL KRA status" />
          <input value={filters.currentStage} onChange={e => updateFilter('currentStage', e.target.value)} placeholder="Stage" />
        </div>
        <div className="beta-actions-row">
          <button className="beta-primary-btn" onClick={loadEntries} disabled={loading}>{loading ? 'Loading...' : 'Apply Filter'}</button>
          <button className="beta-secondary-btn" onClick={() => setFilters(blankFilters)}>Reset</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, margin: '16px 0' }}>
        <div className="beta-section"><div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Total</div><strong>{summary.total || entries.length}</strong></div>
        <div className="beta-section"><div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>KRA Flow</div><strong>{summary.kra_flow_count ?? grouped.kra.length}</strong></div>
        <div className="beta-section"><div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>DigiLocker Flow</div><strong>{summary.digilocker_flow_count ?? grouped.digilocker.length}</strong></div>
        <div className="beta-section"><div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Completed</div><strong>{summary.completed_count ?? summary.total ?? entries.length}</strong></div>
      </div>

      {message ? (
        <section className="beta-response-panel">
          <div className="beta-response-header">
            <strong>Response</strong>
            <button className="beta-secondary-btn beta-response-copy-btn" onClick={copyResponse}>
              {responseCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="beta-alert">{message}</pre>
        </section>
      ) : null}

      <BetaTable
        title="KRA Flow"
        description="Rows classified as direct KRA flow. Use Copy KRA PANs for this list."
        rows={grouped.kra}
        localFilter={kraLocalFilter}
        onLocalFilter={setKraLocalFilter}
        onPush={pushRow}
        onPushSelected={pushSelected}
        pushingKey={pushingKey}
        selectedKeys={selectedKeys}
        onToggleRow={toggleRow}
        onToggleVisibleRows={toggleVisibleRows}
        onClearSelection={clearSelectedRows}
        flowType="KRA"
      />
      <BetaTable
        title="DigiLocker Flow"
        description="Rows where DigiLocker, KYC mode 5, or Aadhaar XML evidence is present."
        rows={grouped.digilocker}
        localFilter={digiLocalFilter}
        onLocalFilter={setDigiLocalFilter}
        onPush={pushRow}
        onPushSelected={pushSelected}
        pushingKey={pushingKey}
        selectedKeys={selectedKeys}
        onToggleRow={toggleRow}
        onToggleVisibleRows={toggleVisibleRows}
        onClearSelection={clearSelectedRows}
        flowType="DigiLocker"
      />
    </div>
  );
}
