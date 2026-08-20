import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const ALL_COLUMNS = {
  application_date: { label: 'APPLICATION DATE', mandatory: true },
  client_code: { label: 'CLIENT CODE', mandatory: true },
  application_id: { label: 'APPLICATION ID', mandatory: true },
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
  'application_date', 'client_code', 'application_id', 'client_name', 'pan_number', 'email_id', 'mobile_number',
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

const CopyField = ({ value, label }) => {
  const [copied, setCopied] = useState(false);

  if (!value || value === 'N/A' || String(value).trim() === '') {
    return <span>{value || 'N/A'}</span>;
  }

  const handleCopy = (e) => {
    e.stopPropagation(); // prevent row click
    navigator.clipboard.writeText(value)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => console.error('Failed to copy: ', err));
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span>{value}</span>
      <button 
        onClick={handleCopy}
        title={`Copy ${label}`}
        style={{
          background: copied ? 'var(--success-color, #10b981)' : 'transparent',
          border: '1px solid ' + (copied ? 'var(--success-color, #10b981)' : 'var(--border-color, #cbd5e1)'),
          borderRadius: '4px',
          padding: '2px 6px',
          fontSize: '0.75rem',
          cursor: 'pointer',
          color: copied ? '#fff' : 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          transition: 'all 0.2s ease',
          lineHeight: '1.2'
        }}
      >
        {copied ? 'Copied' : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Copy
          </>
        )}
      </button>
    </div>
  );
};

export default function Clients() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const integrationParam = searchParams.get('integration');
  const kycStatusParam = searchParams.get('kyc_status');

  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [actionModal, setActionModal] = useState({ isOpen: false, type: '', client: null });
  const [actionRemarks, setActionRemarks] = useState('');
  const [actionStage, setActionStage] = useState('');
  const [actionError, setActionError] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => setOpenActionMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const STAGES_LIST = [
    { value: 'mobile_verification', label: 'Mobile' },
    { value: 'email_verification', label: 'Email' },
    { value: 'pan_and_dob', label: 'PAN' },
    { value: 'digilocker_details', label: 'DigiLocker' },
    { value: 'personal_details', label: 'Personal Details' },
    { value: 'bank_details', label: 'Bank' },
    { value: 'nominee_details', label: 'Nominee' },
    { value: 'live_photo', label: 'Live Photo' },
    { value: 'signature_upload', label: 'Signature' },
    { value: 'scheme_details', label: 'Payment Plan' },
    { value: 'payment_summary', label: 'Payment Gateway' },
    { value: 'esign', label: 'eSign' },
    { value: 'completed', label: 'Completed' }
  ];

  const handleConfirmAction = async () => {
    if (!actionRemarks.trim()) { setActionError('Remarks are mandatory.'); return; }
    if (actionModal.type === 'step_back' && !actionStage) { setActionError('Please select a stage.'); return; }
    
    const client = actionModal.client;
    const appId = client.application_id;
    const clientCode = client.client_code && client.client_code !== 'N/A' ? client.client_code : null;
    const clientName = client.client_name || 'Unknown';
    const userStr = localStorage.getItem('kyc_user');
    const user = userStr ? JSON.parse(userStr) : { name: 'Admin', role: 'Admin' };

    try {
      if (actionModal.type === 'delete') {
        const res = await api.delete(`/kyc-applications/${appId}`);
        if (res?.success) {
          const records = JSON.parse(localStorage.getItem('kyc_trash_records') || '[]');
          records.unshift({ application_id: appId, client_name: clientName, deleted_by: user.name, user_role: user.role, deleted_at: new Date().toISOString(), reason: actionRemarks, purge_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() });
          localStorage.setItem('kyc_trash_records', JSON.stringify(records));
          alert('✅ Client record deleted. Moved to Trash.');
          loadClients();
          setActionModal({ isOpen: false, type: '', client: null });
        } else { setActionError('❌ Delete failed: ' + (res?.message || 'Unknown error')); }
      } else if (actionModal.type === 'payment_skip') {
        const payload = { remarks: actionRemarks, skipped_by: user.name, user_role: user.role, action_type: 'payment_skip', application_id: appId, client_code: clientCode };
        let success = false;
        if (clientCode) { const res = await api.put(`/clients/${encodeURIComponent(clientCode)}/skip-payment`, payload).catch(()=>null); if (res?.success) success = true; }
        if (!success) { const res = await api.put(`/kyc-applications/${appId}/skip-payment`, payload).catch(()=>null); if (res?.success) success = true; }
        if (!success) { const res = await api.put(`/kyc-applications/${appId}/stages`, payload).catch(()=>null); if (res?.success) success = true; }
        if (success) {
          alert('✅ Payment step skipped.');
          loadClients();
          setActionModal({ isOpen: false, type: '', client: null });
        } else { setActionError('❌ Payment skip failed.'); }
      } else if (actionModal.type === 'step_back') {
        const payload = { remarks: actionRemarks, moved_by: user.name, user_role: user.role, action_type: 'step_back', new_step: actionStage, application_id: appId, client_code: clientCode };
        let success = false;
        if (clientCode) { const res = await api.put(`/clients/${encodeURIComponent(clientCode)}/stages`, payload).catch(()=>null); if (res?.success) success = true; }
        if (!success) { const res = await api.put(`/kyc-applications/${appId}/stages`, payload).catch(()=>null); if (res?.success) success = true; }
        if (success) {
          alert('✅ Client stage updated.');
          loadClients();
          setActionModal({ isOpen: false, type: '', client: null });
        } else { setActionError('❌ Stage update failed.'); }
      }
    } catch(err) { setActionError('❌ Error: ' + err.message); }
  };

  const [clients, setClients] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const limit = 20;

  const getInitialState = (key, defaultVal) => {
    const saved = sessionStorage.getItem(`kyc_clients_filter_${key}`);
    return saved !== null ? saved : defaultVal;
  };

  // Filters State
  const [currentPage, setCurrentPage] = useState(() => parseInt(getInitialState('currentPage', 1), 10));
  const [search, setSearch] = useState(() => getInitialState('search', ''));
  const [integration, setIntegration] = useState(() => integrationParam || getInitialState('integration', ''));
  const [status, setStatus] = useState(() => getInitialState('status', ''));
  const [currentStage, setCurrentStage] = useState(() => getInitialState('currentStage', ''));
  const [fromDate, setFromDate] = useState(() => getInitialState('fromDate', ''));
  const [toDate, setToDate] = useState(() => getInitialState('toDate', ''));
  
  // Sorting & Columns State
  const [sortBy, setSortBy] = useState(() => getInitialState('sortBy', 'application_date'));
  const [sortOrder, setSortOrder] = useState(() => getInitialState('sortOrder', 'desc'));
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE);
  const [columnOrder, setColumnOrder] = useState(DEFAULT_ORDER);

  useEffect(() => {
    sessionStorage.setItem('kyc_clients_filter_currentPage', currentPage);
    sessionStorage.setItem('kyc_clients_filter_search', search);
    sessionStorage.setItem('kyc_clients_filter_integration', integration);
    sessionStorage.setItem('kyc_clients_filter_status', status);
    sessionStorage.setItem('kyc_clients_filter_currentStage', currentStage);
    sessionStorage.setItem('kyc_clients_filter_fromDate', fromDate);
    sessionStorage.setItem('kyc_clients_filter_toDate', toDate);
    sessionStorage.setItem('kyc_clients_filter_sortBy', sortBy);
    sessionStorage.setItem('kyc_clients_filter_sortOrder', sortOrder);
  }, [currentPage, search, integration, status, currentStage, fromDate, toDate, sortBy, sortOrder]);

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

  const handleExport = async (format) => {
    setIsExporting(true);
    try {
      const params = {
        q: search,
        sortBy,
        sortOrder,
        isExport: 'true',
        limit: 50000
      };
      
      if (integration) params.integration = integration;
      if (status) params.status = status;
      if (currentStage) params.currentStage = currentStage;
      if (kycStatusParam) params.kyc_status = kycStatusParam;
      if (fromDate && toDate) {
        params.fromDate = fromDate;
        params.toDate = toDate;
      }

      const res = await api.getClients(params);
      const data = res.data || [];
      
      if (!data.length) {
        alert('No records found to export.');
        return;
      }

      const exportCols = activeCols.filter(c => c !== 'action');
      const headers = exportCols.map(c => ALL_COLUMNS[c].label);
      
      const rows = data.map(client => {
        return exportCols.map(col => {
          let content = client[col] || 'N/A';
          if (col === 'application_date') content = client.application_date ? new Date(client.application_date).toLocaleDateString('en-GB') : 'N/A';
          if (col === 'current_stage') content = formatCurrentStage(client.current_stage);
          if (['nse', 'bse', 'cvlkra', 'cdsl', 'techexcel'].includes(col)) {
             content = client[`${col}_push_status`] || client[`${col}_sync_status`] || 'Not Started';
          }
          if (col.endsWith('_reason')) {
             content = client[`${col.replace('_reason', '')}_rejection_reason`] || '-';
          }
          if (col === 'esign_pdf') content = 'Available';
          
          return content;
        });
      });

      const dateStr = new Date().toISOString().slice(0, 10);

      if (format === 'csv') {
        const csvContent = [headers, ...rows].map(e => e.map(item => `"${String(item).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Clients_Export_${dateStr}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (format === 'excel') {
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Clients");
        XLSX.writeFile(workbook, `Clients_Export_${dateStr}.xlsx`);
      } else if (format === 'pdf') {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text("Clients Export", 14, 15);
        doc.autoTable({
          head: [headers],
          body: rows,
          startY: 20,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [41, 128, 185] }
        });
        doc.save(`Clients_Export_${dateStr}.pdf`);
      }

    } catch (err) {
      console.error(err);
      alert('Failed to export data.');
    } finally {
      setIsExporting(false);
    }
  };

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

        <select value={currentStage} onChange={(e) => { setCurrentStage(e.target.value); setCurrentPage(1); }} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
          <option value="">All Stages</option>
          <option value="mobile_verification">Mobile</option>
          <option value="email_verification">Email</option>
          <option value="pan_and_dob">PAN</option>
          <option value="digilocker_details">DigiLocker</option>
          <option value="personal_details">Personal Details</option>
          <option value="bank_details">Bank</option>
          <option value="nominee_details">Nominee</option>
          <option value="live_photo">Live Photo</option>
          <option value="signature_upload">Signature</option>
          <option value="scheme_details">Payment Plan</option>
          <option value="payment_summary">Payment Gateway</option>
          <option value="esign">eSign</option>
          <option value="completed">Completed</option>
        </select>

        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }} />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }} />
        
        <div style={{ position: 'relative' }}>
          <button onClick={() => setExportMenuOpen(!exportMenuOpen)} disabled={isExporting} style={{ border: '1px solid var(--border-color)', background: 'var(--primary-color)', color: 'white', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontWeight: 500 }}>
            {isExporting ? '⏳ Exporting...' : 'Export ⭳'}
          </button>
          {exportMenuOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, minWidth: '120px' }}>
              <button onClick={() => { setExportMenuOpen(false); handleExport('csv'); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--text-color)', cursor: 'pointer' }}>CSV</button>
              <button onClick={() => { setExportMenuOpen(false); handleExport('excel'); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--text-color)', cursor: 'pointer' }}>Excel</button>
              <button onClick={() => { setExportMenuOpen(false); handleExport('pdf'); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--text-color)', cursor: 'pointer' }}>PDF</button>
            </div>
          )}
        </div>
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
                    if (col === 'client_code') content = <CopyField value={client[col]} label="Client Code" />;
                    if (col === 'application_id') content = <CopyField value={client[col]} label="Application ID" />;
                    if (col === 'pan_number') content = <CopyField value={client[col]} label="PAN Number" />;
                    if (col === 'mobile_number') content = <CopyField value={client[col]} label="Mobile Number" />;
                    
                    if (col === 'email_id') content = client.email || client.email_id || 'N/A';
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
                      content = (
                        <div style={{ position: 'relative' }}>
                          <button onClick={(e) => { e.stopPropagation(); setOpenActionMenuId(prev => prev === client.application_id ? null : client.application_id); }} style={{ padding: '4px 8px', borderRadius: '4px', background: 'var(--surface-color)', border: '1px solid var(--border-color)', color: 'var(--text-color)', cursor: 'pointer' }}>⚙ Actions</button>
                          {openActionMenuId === client.application_id && (
                            <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 10, background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', padding: '4px 0', minWidth: '150px' }}>
                              <button onClick={(e) => { e.stopPropagation(); setOpenActionMenuId(null); setActionModal({ isOpen: true, type: 'delete', client }); setActionRemarks(''); setActionError(''); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>🗑 Delete</button>
                              <button onClick={(e) => { e.stopPropagation(); setOpenActionMenuId(null); setActionModal({ isOpen: true, type: 'payment_skip', client }); setActionRemarks(''); setActionError(''); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text-color)', cursor: 'pointer' }}>⏭ Payment Skip</button>
                              <button onClick={(e) => { e.stopPropagation(); setOpenActionMenuId(null); setActionModal({ isOpen: true, type: 'step_back', client }); setActionRemarks(''); setActionStage(''); setActionError(''); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text-color)', cursor: 'pointer' }}>↩ Change Stage</button>
                            </div>
                          )}
                        </div>
                      );
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

      {actionModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { e.stopPropagation(); setActionModal({ isOpen: false, type: '', client: null }); }}>
          <div style={{ background: 'var(--surface-color)', borderRadius: '8px', padding: '24px', width: '400px', maxWidth: '90%', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--text-color)' }}>
              {actionModal.type === 'delete' ? '🗑 Delete Client' : actionModal.type === 'payment_skip' ? '⏭ Skip Payment' : '↩ Change Stage'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>For client: <strong>{actionModal.client?.client_name || 'Unknown'}</strong> ({actionModal.client?.application_id})</p>
            
            {actionModal.type === 'step_back' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-color)' }}>Select Target Stage:</label>
                <select value={actionStage} onChange={e => setActionStage(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
                  <option value="">-- Select Stage --</option>
                  {STAGES_LIST.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            )}
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-color)' }}>Remarks (Mandatory):</label>
              <textarea value={actionRemarks} onChange={e => setActionRemarks(e.target.value)} rows="3" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)', resize: 'vertical' }} placeholder="Enter reason..." />
            </div>

            {actionError && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '16px' }}>{actionError}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setActionModal({ isOpen: false, type: '', client: null })} style={{ padding: '8px 16px', borderRadius: '4px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-color)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleConfirmAction} style={{ padding: '8px 16px', borderRadius: '4px', background: actionModal.type === 'delete' ? '#ef4444' : 'var(--primary-color)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
