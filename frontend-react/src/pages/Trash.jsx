import React, { useState, useEffect } from 'react';

const formatDateTime = (iso) => {
  if (!iso) return 'N/A';
  try { return new Date(iso).toLocaleString('en-GB'); } catch(e) { return iso; }
};

export default function Trash() {
  const [activeTab, setActiveTab] = useState('trash');
  const [trashRecords, setTrashRecords] = useState([]);
  const [deleteLogs, setDeleteLogs] = useState([]);
  const [paymentLogs, setPaymentLogs] = useState([]);
  const [stepLogs, setStepLogs] = useState([]);
  const [now, setNow] = useState(new Date());

  const loadData = () => {
    const t = JSON.parse(localStorage.getItem('kyc_trash_records') || '[]');
    const d = JSON.parse(localStorage.getItem('kyc_audit_delete') || '[]');
    const p = JSON.parse(localStorage.getItem('kyc_audit_payment_skip') || '[]');
    const s = JSON.parse(localStorage.getItem('kyc_audit_step_back') || '[]');
    setTrashRecords(t);
    setDeleteLogs(d);
    setPaymentLogs(p);
    setStepLogs(s);
  };

  useEffect(() => {
    const purgeExpiredTrash = () => {
      const key = 'kyc_trash_records';
      const records = JSON.parse(localStorage.getItem(key) || '[]');
      const currentTime = new Date();
      const valid = records.filter(r => new Date(r.purge_at) > currentTime);
      if (valid.length !== records.length) {
        localStorage.setItem(key, JSON.stringify(valid));
      }
    };
    purgeExpiredTrash();
    loadData();
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const clearExpiredTrash = () => {
    const key = 'kyc_trash_records';
    const records = JSON.parse(localStorage.getItem(key) || '[]');
    const currentTime = new Date();
    const valid = records.filter(r => new Date(r.purge_at) > currentTime);
    localStorage.setItem(key, JSON.stringify(valid));
    loadData();
    alert('✅ Expired trash records cleared.');
  };

  const restoreFromTrash = (idx) => {
    if (!window.confirm('Restore this record from Trash?')) return;
    const key = 'kyc_trash_records';
    const records = JSON.parse(localStorage.getItem(key) || '[]');
    records.splice(idx, 1);
    localStorage.setItem(key, JSON.stringify(records));
    loadData();
    alert('✅ Record restored from Trash.');
  };

  const permanentDelete = (idx) => {
    if (!window.confirm('⚠ Permanently delete this record? This cannot be undone.')) return;
    const key = 'kyc_trash_records';
    const records = JSON.parse(localStorage.getItem(key) || '[]');
    records.splice(idx, 1);
    localStorage.setItem(key, JSON.stringify(records));
    loadData();
    alert('✅ Record permanently deleted.');
  };

  const exportLog = (type) => {
    const keyMap = { delete: 'kyc_audit_delete', payment_skip: 'kyc_audit_payment_skip', step_back: 'kyc_audit_step_back' };
    const logs = JSON.parse(localStorage.getItem(keyMap[type]) || '[]');
    if (!logs.length) { alert('No logs to export.'); return; }

    const headers = Object.keys(logs[0]).join(',');
    const rows = logs.map(l => Object.values(l).map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers, ...rows].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kyc_${type}_audit_log_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <div className="table-container">
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px 24px', minWidth: 160 }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#F87171' }}>{trashRecords.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>In Trash</div>
        </div>
        <div style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px 24px', minWidth: 160 }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#6366f1' }}>{deleteLogs.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Delete Audit Logs</div>
        </div>
        <div style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px 24px', minWidth: 160 }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#f59e0b' }}>{paymentLogs.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Payment Skip Logs</div>
        </div>
        <div style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px 24px', minWidth: 160 }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10B981' }}>{stepLogs.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Step Back Logs</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border-color)', marginBottom: 24 }}>
        <button onClick={() => setActiveTab('trash')} style={{ padding: '10px 20px', background: 'transparent', border: 'none', borderBottom: `2px solid ${activeTab === 'trash' ? 'var(--primary-color)' : 'transparent'}`, color: activeTab === 'trash' ? 'var(--primary-color)' : 'var(--text-muted)', fontWeight: activeTab === 'trash' ? 600 : 'normal', cursor: 'pointer', fontSize: '0.9rem' }}>🗑 Trash</button>
        <button onClick={() => setActiveTab('delete')} style={{ padding: '10px 20px', background: 'transparent', border: 'none', borderBottom: `2px solid ${activeTab === 'delete' ? 'var(--primary-color)' : 'transparent'}`, color: activeTab === 'delete' ? 'var(--primary-color)' : 'var(--text-muted)', fontWeight: activeTab === 'delete' ? 600 : 'normal', cursor: 'pointer', fontSize: '0.9rem' }}>📋 Delete Audit Log</button>
        <button onClick={() => setActiveTab('payment')} style={{ padding: '10px 20px', background: 'transparent', border: 'none', borderBottom: `2px solid ${activeTab === 'payment' ? 'var(--primary-color)' : 'transparent'}`, color: activeTab === 'payment' ? 'var(--primary-color)' : 'var(--text-muted)', fontWeight: activeTab === 'payment' ? 600 : 'normal', cursor: 'pointer', fontSize: '0.9rem' }}>⏭ Payment Skip Log</button>
        <button onClick={() => setActiveTab('step')} style={{ padding: '10px 20px', background: 'transparent', border: 'none', borderBottom: `2px solid ${activeTab === 'step' ? 'var(--primary-color)' : 'transparent'}`, color: activeTab === 'step' ? 'var(--primary-color)' : 'var(--text-muted)', fontWeight: activeTab === 'step' ? 600 : 'normal', cursor: 'pointer', fontSize: '0.9rem' }}>↩ Step Back Log</button>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem' }}>
          <thead>
            {activeTab === 'trash' && (
              <tr>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>APPLICATION ID</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>CLIENT NAME</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>DELETED BY</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>ROLE</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>DELETED AT</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>DAYS LEFT</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>REASON</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>
                  <button onClick={clearExpiredTrash} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.7rem' }}>🧹 Clear Expired</button>
                </th>
              </tr>
            )}
            {activeTab === 'delete' && (
              <tr>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>APPLICATION ID</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>CLIENT NAME</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>DELETED BY</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>ROLE</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>DELETED AT</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>
                  <button onClick={() => exportLog('delete')} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.7rem' }}>⬇ Export</button>
                </th>
              </tr>
            )}
            {activeTab === 'payment' && (
              <tr>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>APPLICATION ID</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>CLIENT NAME</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>SKIPPED BY</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>ROLE</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>STATUS BEFORE</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>TIMESTAMP</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>
                  <button onClick={() => exportLog('payment_skip')} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.7rem' }}>⬇ Export</button>
                </th>
              </tr>
            )}
            {activeTab === 'step' && (
              <tr>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>APPLICATION ID</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>CLIENT NAME</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>MOVED BY</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>ROLE</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>FROM</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>TO</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>TIMESTAMP</th>
                <th style={{ background: 'var(--surface-color)', padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', borderBottom: '1px solid var(--border-color)' }}>
                  <button onClick={() => exportLog('step_back')} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.7rem' }}>⬇ Export</button>
                </th>
              </tr>
            )}
          </thead>
          <tbody>
            {activeTab === 'trash' && trashRecords.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Trash is empty</td></tr>}
            {activeTab === 'trash' && trashRecords.map((r, idx) => {
              const daysLeft = Math.ceil((new Date(r.purge_at) - now) / (1000 * 60 * 60 * 24));
              const daysColor = daysLeft <= 2 ? '#F87171' : daysLeft <= 5 ? '#f59e0b' : '#10B981';
              return (
                <tr key={idx}>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontFamily: 'monospace', fontSize: '0.82rem' }}>{r.application_id || 'N/A'}</td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 600 }}>{r.client_name || 'Unknown'}</td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{r.deleted_by || 'N/A'}</td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>{r.user_role || 'N/A'}</span></td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.82rem' }}>{formatDateTime(r.deleted_at)}</td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: `${daysColor}22`, color: daysColor }}>{daysLeft}d left</span></td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', maxWidth: 200, fontSize: '0.82rem', color: 'var(--text-muted)' }}>{r.reason || '-'}</td>
                  <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <button onClick={() => restoreFromTrash(idx)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--primary-color)', background: 'transparent', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.8rem', marginRight: 6 }}>↩ Restore</button>
                    <button onClick={() => permanentDelete(idx)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #F87171', background: 'transparent', color: '#F87171', cursor: 'pointer', fontSize: '0.8rem' }}>🗑 Delete</button>
                  </td>
                </tr>
              );
            })}

            {activeTab === 'delete' && deleteLogs.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No delete audit logs found.</td></tr>}
            {activeTab === 'delete' && deleteLogs.map((l, idx) => (
              <tr key={idx}>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontFamily: 'monospace', fontSize: '0.82rem' }}>{l.application_id || 'N/A'}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 600 }}>{l.client_name || 'Unknown'}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{l.deleted_by || 'N/A'}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(248,113,113,0.15)', color: '#F87171' }}>{l.user_role || 'N/A'}</span></td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.82rem' }}>{formatDateTime(l.timestamp)}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', maxWidth: 240, fontSize: '0.82rem', color: 'var(--text-muted)' }}>{l.reason || '-'}</td>
              </tr>
            ))}

            {activeTab === 'payment' && paymentLogs.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No payment skip logs found.</td></tr>}
            {activeTab === 'payment' && paymentLogs.map((l, idx) => (
              <tr key={idx}>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontFamily: 'monospace', fontSize: '0.82rem' }}>{l.application_id || 'N/A'}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 600 }}>{l.client_name || 'Unknown'}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{l.skipped_by || 'N/A'}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>{l.user_role || 'N/A'}</span></td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>{l.payment_status_before || 'pending'}</span></td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.82rem' }}>{formatDateTime(l.timestamp)}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', maxWidth: 240, fontSize: '0.82rem', color: 'var(--text-muted)' }}>{l.skip_reason || '-'}</td>
              </tr>
            ))}

            {activeTab === 'step' && stepLogs.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No step back logs found.</td></tr>}
            {activeTab === 'step' && stepLogs.map((l, idx) => (
              <tr key={idx}>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontFamily: 'monospace', fontSize: '0.82rem' }}>{l.application_id || 'N/A'}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 600 }}>{l.client_name || 'Unknown'}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{l.moved_by || 'N/A'}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>{l.user_role || 'N/A'}</span></td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{l.previous_stage || 'N/A'}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.82rem', color: '#10B981' }}>{l.new_stage || 'N/A'}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.82rem' }}>{formatDateTime(l.timestamp)}</td>
                <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', maxWidth: 200, fontSize: '0.82rem', color: 'var(--text-muted)' }}>{l.reason || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
