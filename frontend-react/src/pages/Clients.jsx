import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';

const ALL_COLUMNS = {
  application_date: { label: 'APPLICATION DATE', mandatory: true },
  client_code: { label: 'CLIENT CODE', mandatory: true },
  client_name: { label: 'CLIENT NAME', mandatory: true },
  pan_number: { label: 'PAN NUMBER', mandatory: false },
  email_id: { label: 'EMAIL ID', mandatory: false },
  mobile_number: { label: 'MOBILE NUMBER', mandatory: false },
  current_stage: { label: 'CURRENT STAGE', mandatory: true },
  kyc_status: { label: 'KYC STATUS', mandatory: false },
  cvlkra: { label: 'CVL KRA', mandatory: false },
  cvlkra_reason: { label: 'CVLKRA REJECTION REASON', mandatory: false },
  cdsl: { label: 'CDSL', mandatory: false },
  cdsl_reason: { label: 'CDSL REJECTION REASON', mandatory: false },
  nse: { label: 'NSE', mandatory: false },
  nse_reason: { label: 'NSE REJECTION REASON', mandatory: false },
  bse: { label: 'BSE', mandatory: false },
  bse_reason: { label: 'BSE REJECTION REASON', mandatory: false },
  techexcel: { label: 'TECHEXCEL', mandatory: false },
  techexcel_reason: { label: 'TECHEXCEL REJECTION REASON', mandatory: false },
  esign_pdf: { label: 'ESIGN PDF', mandatory: false },
  action: { label: 'ACTION/EDIT', mandatory: true }
};

const DEFAULT_VISIBLE = [
  'application_date', 'client_code', 'client_name', 'pan_number', 'email_id', 'mobile_number',
  'current_stage', 'kyc_status', 'cvlkra', 'cdsl', 'nse', 'bse', 'techexcel', 'esign_pdf', 'action'
];
const DEFAULT_ORDER = [...DEFAULT_VISIBLE];

const getStatusClass = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'success' || s === 's') return 'success';
  if (s === 'failed' || s === 'rejected' || s === 'r' || s === 'f') return 'failed';
  if (s === 'pending' || s === 'p') return 'pending';
  if (s === 'uploaded' || s === 'u') return 'uploaded';
  return 'neutral';
};

const formatCurrentStage = (currentStep) => {
  const step = String(currentStep || '').toLowerCase().replace(/\(.*?\)/g, '').trim();
  const formattedStep = step.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()).trim();
  return formattedStep || 'N/A';
};

export default function Clients() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const integrationParam = searchParams.get('integration');
  const kycStatusParam = searchParams.get('kyc_status');

  const [clients, setClients] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const limit = 20;

  // Filters State
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [integration, setIntegration] = useState(integrationParam || '');
  const [status, setStatus] = useState('');
  const [currentStage, setCurrentStage] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Sorting & Columns State
  const [sortBy, setSortBy] = useState('application_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE);
  const [columnOrder, setColumnOrder] = useState(DEFAULT_ORDER);

  useEffect(() => {
    if (integrationParam) setIntegration(integrationParam);
    if (kycStatusParam) {
      setCurrentPage(1);
    }
  }, [integrationParam, kycStatusParam]);

  const loadClients = useCallback(() => {
    setLoading(true);
    const offset = (currentPage - 1) * limit;
    const params = {
      q: search,
      limit,
      offset,
      sortBy,
      sortOrder
    };
    
    if (integration) params.integration = integration;
    if (status) params.status = status;
    if (currentStage) params.currentStage = currentStage;
    if (kycStatusParam) params.kyc_status = kycStatusParam;
    if (fromDate && toDate) {
      params.fromDate = fromDate;
      params.toDate = toDate;
    }

    api.getClients(params)
      .then(res => {
        setClients(res.data || []);
        setTotalRecords(res.pagination?.total || 0);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [currentPage, search, integration, status, currentStage, kycStatusParam, fromDate, toDate, sortBy, sortOrder]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      setCurrentPage(1);
      loadClients();
    }
  };

  const activeCols = columnOrder.filter(col => visibleColumns.includes(col) || ALL_COLUMNS[col].mandatory);

  return (
    <div className="table-container">
      <div className="controls" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder="Search Code, PAN, Email..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearch}
          style={{ flex: '0 1 200px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}
        />
        
        <select value={integration} onChange={(e) => { setIntegration(e.target.value); setCurrentPage(1); }} disabled={!!integrationParam} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', opacity: integrationParam ? 0.7 : 1 }}>
          <option value="">All Integrations</option>
          <option value="nse">NSE</option>
          <option value="bse">BSE</option>
          <option value="cvlkra">CVL KRA</option>
          <option value="cdsl">CDSL</option>
          <option value="techexcel">TechExcel</option>
        </select>

        <select value={status} onChange={(e) => { setStatus(e.target.value); setCurrentPage(1); }} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
          <option value="">All Statuses</option>
          <option value="Success">Success</option>
          <option value="Pending">Pending</option>
          <option value="Rejected">Rejected/Failed</option>
          <option value="Uploaded">Uploaded</option>
        </select>

        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }} />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }} />
        
        <button style={{ border: '1px solid var(--border-color)', background: 'var(--primary-color)', color: 'white', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontWeight: 500 }}>
          Export ⭳
        </button>
      </div>
      
      <div className="table-wrapper" style={{ overflowX: 'auto', maxWidth: '100%', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1200px' }}>
          <thead>
            <tr>
              {activeCols.map(col => {
                const isSortable = col === 'application_date';
                return (
                  <th key={col} onClick={() => {
                    if (isSortable) {
                      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
                      setCurrentPage(1);
                    }
                  }} style={{ cursor: isSortable ? 'pointer' : 'default' }}>
                    {ALL_COLUMNS[col].label}
                    {isSortable && <span style={{ marginLeft: 4 }}>{sortOrder === 'desc' ? '↓' : '↑'}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={activeCols.length} style={{ textAlign: 'center' }}>Loading...</td></tr>
            ) : clients.length === 0 ? (
              <tr><td colSpan={activeCols.length} style={{ textAlign: 'center' }}>No clients found</td></tr>
            ) : (
              clients.map(client => (
                <tr key={client.application_id} onClick={() => {
                  const targetId = client.client_code && client.client_code !== 'N/A' ? client.client_code : client.application_id;
                  navigate(`/clients/${targetId}`);
                }}>
                  {activeCols.map(col => {
                    let content = client[col] || 'N/A';
                    if (col === 'application_date') content = client.application_date ? new Date(client.application_date).toLocaleDateString('en-GB') : 'N/A';
                    if (col === 'current_stage') content = formatCurrentStage(client.current_stage);
                    
                    if (['nse', 'bse', 'cvlkra', 'cdsl', 'techexcel'].includes(col)) {
                      const pushStatus = client[`${col}_push_status`] || client[`${col}_sync_status`];
                      content = pushStatus ? <span className={`status-badge status-${getStatusClass(pushStatus)}`}>{pushStatus}</span> : 'Not Started';
                    }
                    if (col.endsWith('_reason')) {
                      content = <span style={{ color: '#dc3545', fontSize: '0.85em' }}>{client[`${col.replace('_reason', '')}_rejection_reason`] || '-'}</span>;
                    }
                    if (col === 'esign_pdf') {
                      content = <span style={{ color: 'var(--primary-color)', fontWeight: 500 }}>Check PDF</span>;
                    }
                    if (col === 'action') {
                      content = <button onClick={(e) => { e.stopPropagation(); alert('Action Menu (Ported)'); }}>⚙ Actions</button>;
                    }
                    return <td key={col}>{content}</td>;
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      <div className="pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
        <span>Showing {Math.min((currentPage - 1) * limit + 1, totalRecords)} - {Math.min(currentPage * limit, totalRecords)} of {totalRecords}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>Previous</button>
          <button onClick={() => setCurrentPage(prev => prev + 1)} disabled={currentPage * limit >= totalRecords}>Next</button>
        </div>
      </div>
    </div>
  );
}
