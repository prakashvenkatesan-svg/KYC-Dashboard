import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Search and Filter State
  const [search, setSearch] = useState('');

  useEffect(() => {
    try {
      const userStr = localStorage.getItem('kyc_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setIsAdmin(user.role === 'Admin');
      }
    } catch (e) {}
  }, []);

  const loadLogs = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get('/audit-logs');
      if (res.success) {
        setLogs(res.data || []);
      } else {
        setError(res.message || 'Failed to load audit logs');
      }
    } catch (err) {
      setError('Network error loading audit logs');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  if (!isAdmin) return <div style={{ padding: 20 }}><h2>Access Denied. Admin only.</h2></div>;

  // Client-side filtering for simplicity since it's limited to 500 records
  const filteredLogs = logs.filter(log => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (log.user_name && log.user_name.toLowerCase().includes(s)) ||
      (log.action_type && log.action_type.toLowerCase().includes(s)) ||
      (log.module && log.module.toLowerCase().includes(s)) ||
      (log.entity_id && log.entity_id.toLowerCase().includes(s)) ||
      (log.client_code && log.client_code.toLowerCase().includes(s))
    );
  });

  return (
    <div className="table-container" style={{ padding: 20, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>System Audit Logs</h1>
      </div>

      <div className="controls" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder="Search logs (User, Action, Entity, Client Code)..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 300px', maxWidth: '400px', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-color)' }}
        />
        <button onClick={loadLogs} style={{ border: '1px solid var(--border-color)', background: 'var(--surface-color)', color: 'var(--text-primary)', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontWeight: 500 }}>
          Refresh ↻
        </button>
      </div>

      {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="table-wrapper" style={{ flex: 1, overflowY: 'auto', background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--bg-color)', position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Date/Time</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>User</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Action Type</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Module</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Target Entity</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Changes / Description</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40 }}>Loading audit logs...</td></tr>
            ) : filteredLogs.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40 }}>No audit logs found.</td></tr>
            ) : (
              filteredLogs.map(log => {
                let changesHtml = log.description || '';
                
                if (log.field_name) {
                  changesHtml = `<strong>${log.field_name}</strong> changed from <em>${log.old_value || 'null'}</em> to <em>${log.new_value || 'null'}</em>`;
                } else if (log.changes_json) {
                  try {
                    const changes = typeof log.changes_json === 'string' ? JSON.parse(log.changes_json) : log.changes_json;
                    changesHtml = Object.keys(changes).map(k => `<strong>${k}:</strong> ${JSON.stringify(changes[k])}`).join(', ');
                  } catch (e) {
                    changesHtml = String(log.changes_json);
                  }
                }
                
                if (!changesHtml) changesHtml = '-';

                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontSize: '0.9em', color: 'var(--text-secondary)' }}>
                      {new Date(log.created_at).toLocaleString('en-GB')}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <strong>{log.user_name || 'System'}</strong>
                      {log.ip_address && <><br/><span style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>IP: {log.ip_address}</span></>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="status-badge status-neutral">{log.action_type}</span>
                    </td>
                    <td style={{ padding: '12px 16px', textTransform: 'capitalize' }}>
                      {log.module}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {log.entity_type} {log.entity_id ? `(#${log.entity_id})` : ''}
                      {log.client_code && <><br/><span style={{ fontSize: '0.85em', color: 'var(--primary-color)', fontWeight: 500 }}>Code: {log.client_code}</span></>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '0.9em', maxWidth: 400, wordBreak: 'break-word', lineHeight: 1.4 }} dangerouslySetInnerHTML={{ __html: changesHtml }} />
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Showing top 500 most recent system audit logs.
      </div>
    </div>
  );
}
