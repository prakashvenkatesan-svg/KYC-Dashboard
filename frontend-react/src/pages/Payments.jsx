import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

const formatAmount = (amount) => {
  if (amount === null || amount === undefined) return '—';
  const num = parseFloat(amount);
  if (isNaN(num)) return '—';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleString('en-GB');
};

const getStatusBadge = (status) => {
  const s = (status || '').toLowerCase();
  if (s === 'success') {
    return <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', padding: '3px 10px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600 }}>Success</span>;
  } else if (s === 'pending') {
    return <span style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308', padding: '3px 10px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600 }}>Pending</span>;
  } else if (s === 'failed' || s === 'rejected') {
    return <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '3px 10px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600 }}>{status}</span>;
  }
  return <span style={{ background: 'rgba(148,163,184,0.15)', color: '#94a3b8', padding: '3px 10px', borderRadius: 12, fontSize: '0.78rem', fontWeight: 600 }}>{status || '—'}</span>;
};

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filters
  const [clientName, setClientName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [txnId, setTxnId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  
  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 20;
  const [sortBy, setSortBy] = useState('payment_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [exporting, setExporting] = useState(false);

  const loadPayments = useCallback(() => {
    setLoading(true);
    const offset = (currentPage - 1) * limit;
    const params = { limit, offset, sortBy, sortOrder };
    if (clientName) params.clientName = clientName;
    if (mobileNumber) params.mobileNumber = mobileNumber;
    if (txnId) params.txnId = txnId;
    if (paymentStatus) params.paymentStatus = paymentStatus;
    if (fromDate && toDate) {
      params.fromDate = fromDate;
      params.toDate = toDate;
    }

    api.getPayments(params).then(res => {
      setPayments(res.data || []);
      setTotalRecords(res.pagination?.total || 0);
      setSummary(res.summary || {});
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [currentPage, limit, sortBy, sortOrder, clientName, mobileNumber, txnId, paymentStatus, fromDate, toDate]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      setCurrentPage(1);
      loadPayments();
    }
  };

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(col);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const exportPayments = async () => {
    setExporting(true);
    const params = { sortBy, sortOrder, isExport: 'true' };
    if (clientName) params.clientName = clientName;
    if (mobileNumber) params.mobileNumber = mobileNumber;
    if (txnId) params.txnId = txnId;
    if (paymentStatus) params.paymentStatus = paymentStatus;
    if (fromDate && toDate) {
      params.fromDate = fromDate;
      params.toDate = toDate;
    }

    try {
      const response = await api.getPayments(params);
      const rows = response?.data || [];
      if (rows.length === 0) {
        alert('No records found to export.');
        setExporting(false);
        return;
      }
      const headers = ['Client Name', 'Mobile Number', 'Transaction ID', 'Amount', 'Payment Date', 'Payment Status'];
      const csvRows = [
        headers.join(','),
        ...rows.map(r => [
          `"${(r.client_name || '').replace(/"/g, '""')}"`,
          `"${r.mobile_number || ''}"`,
          `"${r.transaction_id || ''}"`,
          r.amount != null ? parseFloat(r.amount).toFixed(2) : '',
          `"${formatDate(r.payment_date)}"`,
          `"${r.payment_status || ''}"`
        ].join(','))
      ];
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payments_export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to export: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="table-container">
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220, background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Total Transactions</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>{(summary.total_transactions ?? totalRecords).toLocaleString()}</div>
          <div style={{ marginTop: 6, fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{formatAmount(summary.total_amount ?? summary.total_successful_amount)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 220, background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Successful Transactions</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#22c55e' }}>{(summary.success?.count ?? 0).toLocaleString()}</div>
          <div style={{ marginTop: 6, fontSize: '1rem', fontWeight: 600, color: '#22c55e' }}>{formatAmount(summary.success?.amount ?? summary.total_successful_amount)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 220, background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Pending Transactions</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#eab308' }}>{(summary.pending?.count ?? 0).toLocaleString()}</div>
          <div style={{ marginTop: 6, fontSize: '1rem', fontWeight: 600, color: '#eab308' }}>{formatAmount(summary.pending?.amount)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 220, background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Failed Transactions</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#ef4444' }}>{(summary.failed?.count ?? 0).toLocaleString()}</div>
          <div style={{ marginTop: 6, fontSize: '1rem', fontWeight: 600, color: '#ef4444' }}>{formatAmount(summary.failed?.amount)}</div>
        </div>
      </div>

      <div className="controls" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
        <input type="text" placeholder="Client Name" value={clientName} onChange={e => setClientName(e.target.value)} onKeyDown={handleKeyDown} style={{ flex: '0 1 180px', padding: 8, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }} />
        <input type="text" placeholder="Mobile Number" value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} onKeyDown={handleKeyDown} style={{ flex: '0 1 160px', padding: 8, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }} />
        <input type="text" placeholder="Transaction ID" value={txnId} onChange={e => setTxnId(e.target.value)} onKeyDown={handleKeyDown} style={{ flex: '0 1 200px', padding: 8, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }} />
        
        <select value={paymentStatus} onChange={e => { setPaymentStatus(e.target.value); setCurrentPage(1); }} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}>
          <option value="">All Statuses</option>
          <option value="Success">Success</option>
          <option value="Pending">Pending</option>
          <option value="Failed">Failed</option>
        </select>

        <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setCurrentPage(1); }} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }} />
        <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setCurrentPage(1); }} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }} />

        <button onClick={exportPayments} disabled={exporting} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--primary-color)', color: 'white', cursor: 'pointer', fontWeight: 500 }}>
          {exporting ? '⏳ Exporting...' : '⬇ Export Report'}
        </button>
      </div>

      <div className="table-wrapper" style={{ overflowX: 'auto', maxWidth: '100%', border: '1px solid var(--border-color)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr>
              <th>CLIENT NAME</th>
              <th>MOBILE NUMBER</th>
              <th>TRANSACTION ID</th>
              <th onClick={() => handleSort('amount')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                AMOUNT {sortBy === 'amount' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
              </th>
              <th onClick={() => handleSort('payment_date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                PAYMENT DATE {sortBy === 'payment_date' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
              </th>
              <th>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: 20 }}>Loading...</td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: 20 }}>No payment records found.</td></tr>
            ) : (
              payments.map((row, i) => (
                <tr key={i}>
                  <td>{row.client_name || '—'}</td>
                  <td>{row.mobile_number || '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{row.transaction_id || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{formatAmount(row.amount)}</td>
                  <td>{formatDate(row.payment_date)}</td>
                  <td>{getStatusBadge(row.payment_status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
        <span>Showing {totalRecords === 0 ? 0 : (currentPage - 1) * limit + 1} – {Math.min(currentPage * limit, totalRecords)} of {totalRecords}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</button>
          <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage * limit >= totalRecords}>Next</button>
        </div>
      </div>
    </div>
  );
}
