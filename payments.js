// Payments Page Logic

let currentPage = 1;
const limit = 20;
let totalRecords = 0;
let currentSortBy = 'payment_date';
let currentSortOrder = 'desc';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = String(hours % 12 || 12).padStart(2, '0');
  return `${day}-${month}-${year} ${h12}:${mins} ${ampm}`;
}

function formatAmount(amount) {
  if (amount === null || amount === undefined) return '—';
  const num = parseFloat(amount);
  if (isNaN(num)) return '—';
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getStatusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s === 'success') {
    return `<span style="background: rgba(34,197,94,0.15); color: #22c55e; padding: 3px 10px; border-radius: 12px; font-size: 0.78rem; font-weight: 600;">Success</span>`;
  } else if (s === 'pending') {
    return `<span style="background: rgba(234,179,8,0.15); color: #eab308; padding: 3px 10px; border-radius: 12px; font-size: 0.78rem; font-weight: 600;">Pending</span>`;
  } else if (s === 'failed' || s === 'rejected') {
    return `<span style="background: rgba(239,68,68,0.15); color: #ef4444; padding: 3px 10px; border-radius: 12px; font-size: 0.78rem; font-weight: 600;">${status}</span>`;
  }
  return `<span style="background: rgba(148,163,184,0.15); color: #94a3b8; padding: 3px 10px; border-radius: 12px; font-size: 0.78rem; font-weight: 600;">${status || '—'}</span>`;
}

function getFilters() {
  return {
    clientName: document.getElementById('search-client')?.value?.trim() || '',
    mobileNumber: document.getElementById('search-mobile')?.value?.trim() || '',
    txnId: document.getElementById('search-txn')?.value?.trim() || '',
    paymentStatus: document.getElementById('status-filter')?.value || '',
    fromDate: document.getElementById('from-date')?.value || '',
    toDate: document.getElementById('to-date')?.value || '',
  };
}

// ─── Load Payments ───────────────────────────────────────────────────────────

const loadPayments = async () => {
  const tbody = document.getElementById('payments-tbody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">Loading...</td></tr>';

  const filters = getFilters();

  const { fromDate, toDate } = filters;
  if (fromDate && toDate && new Date(toDate) < new Date(fromDate)) {
    alert('To Date cannot be earlier than From Date.');
    return;
  }

  const offset = (currentPage - 1) * limit;
  const params = {
    limit,
    offset,
    sortBy: currentSortBy,
    sortOrder: currentSortOrder,
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))
  };

  try {
    const response = await api.getPayments(params);

    if (!response || !response.success) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--rejected-color);">Failed to load payments.</td></tr>`;
      return;
    }

    const rows = response.data || [];
    totalRecords = response.pagination?.total || 0;

    // Update summary cards
    const summary = response.summary || {};
    document.getElementById('summary-total-count').textContent = `${(summary.total_transactions ?? totalRecords).toLocaleString('en-IN')} Transactions`;
    document.getElementById('summary-total-amount').textContent = formatAmount(summary.total_amount ?? summary.total_successful_amount);
    document.getElementById('summary-success-count').textContent = `${(summary.success?.count ?? 0).toLocaleString('en-IN')} Transactions`;
    document.getElementById('summary-success-amount').textContent = formatAmount(summary.success?.amount ?? summary.total_successful_amount);
    document.getElementById('summary-pending-count').textContent = `${(summary.pending?.count ?? 0).toLocaleString('en-IN')} Transactions`;
    document.getElementById('summary-pending-amount').textContent = formatAmount(summary.pending?.amount);
    document.getElementById('summary-failed-count').textContent = `${(summary.failed?.count ?? 0).toLocaleString('en-IN')} Transactions`;
    document.getElementById('summary-failed-amount').textContent = formatAmount(summary.failed?.amount);

    // Update pagination info
    const start = totalRecords === 0 ? 0 : offset + 1;
    const end = Math.min(offset + limit, totalRecords);
    document.getElementById('page-info').textContent = `Showing ${start} – ${end} of ${totalRecords}`;

    document.getElementById('prev-btn').disabled = currentPage <= 1;
    document.getElementById('next-btn').disabled = offset + limit >= totalRecords;

    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">No payment records found.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(row => `
      <tr>
        <td>${row.client_name || '—'}</td>
        <td>${row.mobile_number || '—'}</td>
        <td style="font-family: monospace; font-size: 0.85rem;">${row.transaction_id || '—'}</td>
        <td style="font-weight: 600;">${formatAmount(row.amount)}</td>
        <td>${formatDate(row.payment_date)}</td>
        <td>${getStatusBadge(row.payment_status)}</td>
      </tr>
    `).join('');

  } catch (err) {
    console.error('Payments load error:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--rejected-color);">Error loading payments: ${err.message}</td></tr>`;
  }
};

// ─── Export Report ───────────────────────────────────────────────────────────

const exportPayments = async () => {
  const btn = document.getElementById('export-btn');
  btn.textContent = '⏳ Exporting...';
  btn.disabled = true;

  const filters = getFilters();
  const params = {
    sortBy: currentSortBy,
    sortOrder: currentSortOrder,
    isExport: 'true',
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))
  };

  try {
    const response = await api.getPayments(params);
    const rows = response?.data || [];

    if (rows.length === 0) {
      alert('No records found to export.');
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
    const now = new Date();
    a.href = url;
    a.download = `payments_export_${now.toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Export error:', err);
    alert('Failed to export: ' + err.message);
  } finally {
    btn.innerHTML = '⬇ Export Report';
    btn.disabled = false;
  }
};

// ─── Sort Handlers ───────────────────────────────────────────────────────────

function updateSortIcons() {
  const dateIcon = document.getElementById('sort-icon-date');
  const amtIcon = document.getElementById('sort-icon-amount');
  if (dateIcon) dateIcon.textContent = currentSortBy === 'payment_date' ? (currentSortOrder === 'asc' ? '↑' : '↓') : '';
  if (amtIcon) amtIcon.textContent = currentSortBy === 'amount' ? (currentSortOrder === 'asc' ? '↑' : '↓') : '';
}

// ─── Event Bindings ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // Auto-filter on Enter key for text inputs
  ['search-client', 'search-mobile', 'search-txn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          currentPage = 1;
          loadPayments();
        }
      });
      // Also filter on blur (when user leaves the field)
      el.addEventListener('change', () => {
        currentPage = 1;
        loadPayments();
      });
    }
  });

  // Auto-filter on status change
  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      currentPage = 1;
      loadPayments();
    });
  }

  // Auto-filter on date selection (only when both are set, or one is cleared)
  const fromDateEl = document.getElementById('from-date');
  const toDateEl = document.getElementById('to-date');
  if (fromDateEl) {
    fromDateEl.addEventListener('change', () => {
      currentPage = 1;
      loadPayments();
    });
  }
  if (toDateEl) {
    toDateEl.addEventListener('change', () => {
      currentPage = 1;
      loadPayments();
    });
  }

  // Sort columns
  document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (currentSortBy === col) {
        currentSortOrder = currentSortOrder === 'desc' ? 'asc' : 'desc';
      } else {
        currentSortBy = col;
        currentSortOrder = 'desc';
      }
      updateSortIcons();
      currentPage = 1;
      loadPayments();
    });
  });

  // Pagination
  document.getElementById('prev-btn')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadPayments();
    }
  });
  document.getElementById('next-btn')?.addEventListener('click', () => {
    if ((currentPage - 1) * limit + limit < totalRecords) {
      currentPage++;
      loadPayments();
    }
  });

  // Export
  document.getElementById('export-btn')?.addEventListener('click', exportPayments);

  // Initial load
  updateSortIcons();
  loadPayments();
});
