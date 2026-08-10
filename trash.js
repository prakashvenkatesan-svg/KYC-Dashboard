/**
 * trash.js
 * Handles the Trash page: soft-delete display, audit logs, auto-purge.
 * All data stored in localStorage. Audit logs are permanent; trash records expire after 10 days.
 */

document.addEventListener('DOMContentLoaded', () => {
  purgeExpiredTrash();
  loadAllTabs();
  updateSummaryCards();
});

// --- Tab Switching ---
window.switchTab = (tabId) => {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.trash-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  const idx = ['tab-trash', 'tab-delete-log', 'tab-payment-log', 'tab-stepback-log'].indexOf(tabId);
  document.querySelectorAll('.trash-tab')[idx].classList.add('active');
};

// --- Auto-Purge Expired Trash (older than 10 days) ---
function purgeExpiredTrash() {
  const key = 'kyc_trash_records';
  const records = JSON.parse(localStorage.getItem(key) || '[]');
  const now = new Date();
  const valid = records.filter(r => new Date(r.purge_at) > now);
  localStorage.setItem(key, JSON.stringify(valid));
}

window.clearExpiredTrash = () => {
  purgeExpiredTrash();
  loadTrashTab();
  updateSummaryCards();
  alert('✅ Expired trash records cleared.');
};

// --- Summary Cards ---
function updateSummaryCards() {
  const trash = JSON.parse(localStorage.getItem('kyc_trash_records') || '[]');
  const deleteLogs = JSON.parse(localStorage.getItem('kyc_audit_delete') || '[]');
  const paymentLogs = JSON.parse(localStorage.getItem('kyc_audit_payment_skip') || '[]');
  const stepLogs = JSON.parse(localStorage.getItem('kyc_audit_step_back') || '[]');
  document.getElementById('sc-trash-count').textContent = trash.length;
  document.getElementById('sc-delete-logs').textContent = deleteLogs.length;
  document.getElementById('sc-payment-logs').textContent = paymentLogs.length;
  document.getElementById('sc-stepback-logs').textContent = stepLogs.length;
}

// --- Load All Tabs ---
function loadAllTabs() {
  loadTrashTab();
  loadDeleteLogTab();
  loadPaymentLogTab();
  loadStepBackLogTab();
}

// --- Trash Tab ---
function loadTrashTab() {
  const tbody = document.getElementById('trash-tbody');
  const records = JSON.parse(localStorage.getItem('kyc_trash_records') || '[]');
  const now = new Date();

  if (records.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:40px; color:var(--text-muted);">
      <div style="font-size:2rem; margin-bottom:8px;">🗑</div>
      <div>Trash is empty</div></td></tr>`;
    return;
  }

  tbody.innerHTML = records.map((r, idx) => {
    const deletedAt = new Date(r.deleted_at);
    const purgeAt = new Date(r.purge_at);
    const daysLeft = Math.ceil((purgeAt - now) / (1000 * 60 * 60 * 24));
    const daysColor = daysLeft <= 2 ? '#F87171' : daysLeft <= 5 ? '#f59e0b' : '#10B981';

    return `<tr>
      <td style="font-family:monospace; font-size:0.82rem;">${r.application_id || 'N/A'}</td>
      <td style="font-weight:600;">${r.client_name || 'Unknown'}</td>
      <td>${r.deleted_by || 'N/A'}</td>
      <td><span class="badge badge-info">${r.user_role || 'N/A'}</span></td>
      <td style="font-size:0.82rem;">${formatDateTime(r.deleted_at)}</td>
      <td><span class="days-badge" style="background:${daysColor}22; color:${daysColor};">${daysLeft}d left</span></td>
      <td style="max-width:200px; font-size:0.82rem; color:var(--text-muted);">${r.reason || '-'}</td>
      <td>
        <button class="restore-btn" onclick="restoreFromTrash(${idx})">↩ Restore</button>
        <button class="perma-delete-btn" onclick="permanentDelete(${idx})">🗑 Delete</button>
      </td>
    </tr>`;
  }).join('');
}

window.restoreFromTrash = (idx) => {
  if (!confirm('Restore this record from Trash?')) return;
  const key = 'kyc_trash_records';
  const records = JSON.parse(localStorage.getItem(key) || '[]');
  records.splice(idx, 1);
  localStorage.setItem(key, JSON.stringify(records));
  loadTrashTab();
  updateSummaryCards();
  alert('✅ Record restored from Trash.');
};

window.permanentDelete = (idx) => {
  if (!confirm('⚠ Permanently delete this record? This cannot be undone.')) return;
  const key = 'kyc_trash_records';
  const records = JSON.parse(localStorage.getItem(key) || '[]');
  records.splice(idx, 1);
  localStorage.setItem(key, JSON.stringify(records));
  loadTrashTab();
  updateSummaryCards();
  alert('✅ Record permanently deleted.');
};

// --- Delete Audit Log Tab ---
function loadDeleteLogTab() {
  const tbody = document.getElementById('delete-log-tbody');
  const logs = JSON.parse(localStorage.getItem('kyc_audit_delete') || '[]');
  if (logs.length === 0) {
    tbody.innerHTML = emptyRow(6, 'No delete audit logs found.');
    return;
  }
  tbody.innerHTML = logs.map(l => `<tr>
    <td style="font-family:monospace; font-size:0.82rem;">${l.application_id || 'N/A'}</td>
    <td style="font-weight:600;">${l.client_name || 'Unknown'}</td>
    <td>${l.deleted_by || 'N/A'}</td>
    <td><span class="badge badge-danger">${l.user_role || 'N/A'}</span></td>
    <td style="font-size:0.82rem;">${formatDateTime(l.timestamp)}</td>
    <td style="max-width:240px; font-size:0.82rem; color:var(--text-muted);">${l.reason || '-'}</td>
  </tr>`).join('');
}

// --- Payment Skip Audit Log Tab ---
function loadPaymentLogTab() {
  const tbody = document.getElementById('payment-log-tbody');
  const logs = JSON.parse(localStorage.getItem('kyc_audit_payment_skip') || '[]');
  if (logs.length === 0) {
    tbody.innerHTML = emptyRow(7, 'No payment skip logs found.');
    return;
  }
  tbody.innerHTML = logs.map(l => `<tr>
    <td style="font-family:monospace; font-size:0.82rem;">${l.application_id || 'N/A'}</td>
    <td style="font-weight:600;">${l.client_name || 'Unknown'}</td>
    <td>${l.skipped_by || 'N/A'}</td>
    <td><span class="badge badge-warning">${l.user_role || 'N/A'}</span></td>
    <td><span class="badge badge-info">${l.payment_status_before || 'pending'}</span></td>
    <td style="font-size:0.82rem;">${formatDateTime(l.timestamp)}</td>
    <td style="max-width:240px; font-size:0.82rem; color:var(--text-muted);">${l.skip_reason || '-'}</td>
  </tr>`).join('');
}

// --- Step Back Audit Log Tab ---
function loadStepBackLogTab() {
  const tbody = document.getElementById('stepback-log-tbody');
  const logs = JSON.parse(localStorage.getItem('kyc_audit_step_back') || '[]');
  if (logs.length === 0) {
    tbody.innerHTML = emptyRow(8, 'No step back logs found.');
    return;
  }
  tbody.innerHTML = logs.map(l => `<tr>
    <td style="font-family:monospace; font-size:0.82rem;">${l.application_id || 'N/A'}</td>
    <td style="font-weight:600;">${l.client_name || 'Unknown'}</td>
    <td>${l.moved_by || 'N/A'}</td>
    <td><span class="badge badge-info">${l.user_role || 'N/A'}</span></td>
    <td style="font-size:0.82rem; color:var(--text-muted);">${l.previous_stage || 'N/A'}</td>
    <td style="font-size:0.82rem; color:#10B981;">${l.new_stage || 'N/A'}</td>
    <td style="font-size:0.82rem;">${formatDateTime(l.timestamp)}</td>
    <td style="max-width:200px; font-size:0.82rem; color:var(--text-muted);">${l.reason || '-'}</td>
  </tr>`).join('');
}

// --- Export CSV ---
window.exportLog = (type) => {
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

// --- Helpers ---
function formatDateTime(iso) {
  if (!iso) return 'N/A';
  try { return new Date(iso).toLocaleString('en-GB'); } catch(e) { return iso; }
}

function emptyRow(cols, msg) {
  return `<tr><td colspan="${cols}" style="text-align:center; padding:40px; color:var(--text-muted);">${msg}</td></tr>`;
}
