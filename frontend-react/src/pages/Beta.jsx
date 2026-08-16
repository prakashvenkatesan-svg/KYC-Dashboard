import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api';

const blankFilters = {
  q: '',
  flow: '',
  cvlkraStatus: '',
  currentStage: '',
  esignStatus: 'completed',
  completed: 'true'
};

const statusTone = (status) => {
  const value = String(status || '').toLowerCase();
  if (['success', 'passed', 'documents_uploaded', 'uploaded', 's'].includes(value)) return '#22c55e';
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
  pan: { width: 112 },
  clientCode: { width: 92 },
  application: { width: 110 },
  name: { width: 230 },
  stage: { width: 110 },
  integration: { width: 250 },
  xml: { width: 100 },
  push: { width: 250 }
};

const statusCell = (integration) => {
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
    </div>
  );
};

const isCdslUploaded = (row) => String(row?.cdsl?.status || '').toLowerCase() === 'uploaded';

const pushLabel = (target) => ({
  cvlkra: 'KRA Push',
  cvlkra_document: 'Doc Push',
  cdsl_status: 'CDSL Check',
  orchestrator: 'Orchestrator'
}[target] || target);

const includesText = (row, query) => {
  if (!query) return true;
  const needle = query.toLowerCase();
  return [
    row.pan,
    row.client_code,
    row.client_name,
    row.application_id,
    row.current_step,
    row.cvlkra?.status,
    row.cdsl?.status,
    row.nse?.status,
    row.bse?.status,
    row.techexcel?.status,
    row.xml_status
  ].some(value => String(value || '').toLowerCase().includes(needle));
};

function BetaTable({ title, description, rows, localFilter, onLocalFilter, onPush }) {
  const filteredRows = useMemo(
    () => rows.filter(row => includesText(row, localFilter)),
    [rows, localFilter]
  );

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

      <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
        <table style={{ width: '100%', minWidth: 1900, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
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
              <th style={tableColumnStyles.push}>Push</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan="12" style={{ textAlign: 'center', padding: 18 }}>No records found.</td></tr>
            ) : filteredRows.map(row => (
              <tr key={`${row.flow_type}-${row.application_id}-${row.pan}`}>
                <td style={{ ...tableColumnStyles.pan, fontFamily: 'monospace', fontWeight: 700, verticalAlign: 'top' }}>{text(row.pan)}</td>
                <td style={{ ...tableColumnStyles.clientCode, fontFamily: 'monospace', verticalAlign: 'top' }}>{text(row.client_code)}</td>
                <td style={{ ...tableColumnStyles.application, verticalAlign: 'top' }}>{text(row.application_id)}</td>
                <td style={{ ...tableColumnStyles.name, verticalAlign: 'top', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{text(row.client_name)}</td>
                <td style={{ ...tableColumnStyles.stage, verticalAlign: 'top' }}>{text(row.current_step)}</td>
                <td style={{ ...tableColumnStyles.integration, verticalAlign: 'top' }}>{statusCell(row.cvlkra)}</td>
                <td style={{ ...tableColumnStyles.integration, verticalAlign: 'top' }}>{statusCell(row.cdsl)}</td>
                <td style={{ ...tableColumnStyles.integration, verticalAlign: 'top' }}>{statusCell(row.nse)}</td>
                <td style={{ ...tableColumnStyles.integration, verticalAlign: 'top' }}>{statusCell(row.bse)}</td>
                <td style={{ ...tableColumnStyles.integration, verticalAlign: 'top' }}>{statusCell(row.techexcel)}</td>
                <td style={{ ...tableColumnStyles.xml, verticalAlign: 'top' }}>{badge(row.xml_status)}</td>
                <td style={{ ...tableColumnStyles.push, verticalAlign: 'top' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {row.flow_type !== 'KRA' ? (
                      <>
                        <button className="beta-secondary-btn" onClick={() => onPush('cvlkra', row)}>KRA Push</button>
                        <button className="beta-secondary-btn" onClick={() => onPush('cvlkra_document', row)}>Doc Push</button>
                      </>
                    ) : null}
                    {isCdslUploaded(row) ? (
                      <button className="beta-secondary-btn" onClick={() => onPush('cdsl_status', row)}>CDSL Check</button>
                    ) : null}
                    <button className="beta-primary-btn" onClick={() => onPush('orchestrator', row)}>Orchestrator</button>
                  </div>
                </td>
              </tr>
            ))}
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
  const [message, setMessage] = useState('');
  const [kraLocalFilter, setKraLocalFilter] = useState('');
  const [digiLocalFilter, setDigiLocalFilter] = useState('');

  const updateFilter = (key, value) => {
    setFilters(current => ({ ...current, [key]: value }));
  };

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const params = { ...filters, limit: 500 };
      Object.keys(params).forEach(key => {
        if (params[key] === '') delete params[key];
      });
      const response = await api.getBetaEntries(params);
      setEntries(response?.data || []);
      setSummary(response?.summary || {});
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

  const grouped = useMemo(() => {
    const kra = entries.filter(row => row.flow_type === 'KRA');
    const digilocker = entries.filter(row => row.flow_type === 'DigiLocker');
    return { kra, digilocker };
  }, [entries]);

  const copyKraPans = async () => {
    const pans = grouped.kra.map(row => row.pan).filter(Boolean).join('\n');
    if (!pans) {
      setMessage('No KRA flow PANs available for the current filter.');
      return;
    }
    await navigator.clipboard.writeText(pans);
    setMessage(`Copied ${grouped.kra.length} KRA flow PAN(s).`);
  };

  const pushRow = async (target, row) => {
    const label = `${row.pan || row.application_id} via ${pushLabel(target)}`;
    if (!window.confirm(`Push ${label}?`)) return;
    setMessage(`Sending ${label}...`);
    try {
      const payload = target === 'cdsl_status'
        ? (
          row.cdsl?.id && row.cdsl?.ackId && row.cdsl?.zipFileName
            ? {
              mode: 'status',
              records: [{
                id: row.cdsl.id,
                ackId: row.cdsl.ackId,
                zipFileName: row.cdsl.zipFileName
              }]
            }
            : {
              mode: 'uploadedStatus',
              applicationIds: [row.application_id],
              pans: row.pan ? [row.pan] : [],
              limit: 1,
              minAgeMinutes: 0,
              forceDownload: true
            }
        )
        : undefined;
      const response = await api.pushBetaEntry({
        target,
        applicationId: row.application_id,
        pan: row.pan,
        ...(payload ? { payload } : {})
      });
      setMessage(JSON.stringify(response, null, 2));
      await loadEntries();
    } catch (error) {
      setMessage(error.message || `Push failed for ${label}.`);
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
          <select value={filters.esignStatus} onChange={e => updateFilter('esignStatus', e.target.value)}>
            <option value="">All eSign</option>
            <option value="completed">eSign completed</option>
            <option value="pending">eSign pending</option>
          </select>
          <select value={filters.completed} onChange={e => updateFilter('completed', e.target.value)}>
            <option value="">All completion</option>
            <option value="true">Completed only</option>
            <option value="false">Incomplete only</option>
          </select>
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
        <div className="beta-section"><div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>eSign Completed</div><strong>{summary.esign_completed_count || 0}</strong></div>
      </div>

      {message ? <pre className="beta-alert">{message}</pre> : null}

      <BetaTable
        title="KRA Flow"
        description="Rows classified as direct KRA flow. Use Copy KRA PANs for this list."
        rows={grouped.kra}
        localFilter={kraLocalFilter}
        onLocalFilter={setKraLocalFilter}
        onPush={pushRow}
      />
      <BetaTable
        title="DigiLocker Flow"
        description="Rows where DigiLocker, KYC mode 5, or Aadhaar XML evidence is present."
        rows={grouped.digilocker}
        localFilter={digiLocalFilter}
        onLocalFilter={setDigiLocalFilter}
        onPush={pushRow}
      />
    </div>
  );
}
