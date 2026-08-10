const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-GB');
};

const getLoggedInUser = () => {
  try {
    return JSON.parse(localStorage.getItem('kyc_user') || '{}');
  } catch (error) {
    return {};
  }
};

const getStatusClass = (status) => {
  const value = String(status || '').toLowerCase();
  if (value === 'success' || value === 'all done') return 'success';
  if (value === 'uploaded') return 'uploaded';
  if (value === 'pending' || value.includes('missing') || value.includes('not pushed')) return 'pending';
  if (value === 'failed' || value.includes('failed') || value.includes('rejected')) return 'failed';
  return 'neutral';
};

const getLastMessage = (app) => {
  return app.cdsl_note
    || app.cdsl_msg_desc
    || app.nse_reason
    || app.bse_reason
    || app.cvlkra_reason
    || app.techexcel_reason
    || '';
};

const applyTheme = (theme) => {
  const isLight = theme === 'light';
  document.body.classList.toggle('light-mode', isLight);

  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  toggle.textContent = isLight ? 'Dark Mode' : 'Light Mode';
  toggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
};

const initThemeToggle = () => {
  const storedTheme = localStorage.getItem('kyc_dashboard_theme') || 'dark';
  applyTheme(storedTheme);

  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    const nextTheme = document.body.classList.contains('light-mode') ? 'dark' : 'light';
    localStorage.setItem('kyc_dashboard_theme', nextTheme);
    applyTheme(nextTheme);
  });
};

const renderPushKpis = (report) => {
  const container = document.getElementById('push-kpi-container');
  if (!container) return;

  const cdslAlreadyExistsCount = report.applications.filter((app) => app.cdsl_note).length;
  const failedCount = report.applications.filter((app) => {
    const blocker = String(app.current_blocker || '');
    return blocker !== 'All done' && (blocker.includes('failed') || blocker.includes('FAILED'));
  }).length;

  const cards = [
    { label: 'Completed eSign Live', value: report.count, tone: 'neutral' },
    { label: 'Fully Pushed', value: report.allDoneCount, tone: 'success' },
    { label: 'Pending Attention', value: report.pendingCount, tone: report.pendingCount ? 'pending' : 'success' },
    { label: 'Failed / Rejected', value: failedCount, tone: failedCount ? 'failed' : 'success' },
    { label: 'CDSL Already Exists', value: cdslAlreadyExistsCount, tone: 'uploaded' }
  ];

  container.innerHTML = cards.map((card) => `
    <div class="push-kpi-card ${card.tone}">
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
    </div>
  `).join('');
};

const renderBlockerSummary = (report) => {
  const container = document.getElementById('blocker-summary-container');
  if (!container) return;

  const entries = Object.entries(report.blockerCounts || {});
  if (!entries.length) {
    container.innerHTML = '<div class="all-clear-message">No live completed eSign applications need attention.</div>';
    return;
  }

  container.innerHTML = `
    <h3>Blocker Summary</h3>
    <div class="blocker-chip-row">
      ${entries.map(([label, count]) => `
        <span class="blocker-chip ${getStatusClass(label)}">
          ${escapeHtml(label)}: <strong>${escapeHtml(count)}</strong>
        </span>
      `).join('')}
    </div>
  `;
};

const renderNeedsAttention = (report) => {
  const body = document.getElementById('needs-attention-body');
  if (!body) return;

  const pending = report.applications.filter((app) => app.current_blocker !== 'All done');
  if (!pending.length) {
    body.innerHTML = '<tr><td colspan="9" class="empty-state">All live completed eSign applications are fully pushed.</td></tr>';
    return;
  }

  body.innerHTML = pending.map((app) => {
    const clientCode = app.cdsl_client_code || app.bse_client_code || app.techexcel_client_id || 'N/A';
    const message = getLastMessage(app);

    return `
      <tr>
        <td><strong>${escapeHtml(app.application_id)}</strong></td>
        <td>${escapeHtml(app.applicant_name || 'N/A')}</td>
        <td>${escapeHtml(app.pan_number || 'N/A')}</td>
        <td>${escapeHtml(clientCode)}</td>
        <td>${escapeHtml(app.bo_id || 'N/A')}</td>
        <td>
          <span class="operation-status ${getStatusClass(app.current_blocker)}">
            ${escapeHtml(app.current_blocker)}
          </span>
        </td>
        <td class="message-cell">${message ? escapeHtml(message) : 'N/A'}</td>
        <td>${escapeHtml(app.suggested_action || 'Review application')}</td>
        <td>${escapeHtml(formatDateTime(app.last_updated))}</td>
      </tr>
    `;
  }).join('');
};

const renderPushOperationsReport = async () => {
  const user = getLoggedInUser();
  if (user.role !== 'Admin') return;

  const section = document.getElementById('push-operations-section');
  if (!section) return;

  section.style.display = 'block';

  try {
    const response = await window.api.getPushOperationsReport();
    if (!response.success || response.forbidden) {
      section.style.display = 'none';
      return;
    }

    const report = response.data || { count: 0, allDoneCount: 0, pendingCount: 0, blockerCounts: {}, applications: [] };
    renderPushKpis(report);
    renderBlockerSummary(report);
    renderNeedsAttention(report);
  } catch (error) {
    const container = document.getElementById('push-kpi-container');
    if (container) {
      container.innerHTML = '<div class="error-msg">Failed to load push operations report.</div>';
    }
    console.error(error);
  }
};

const renderIntegrationCards = async () => {
  const container = document.getElementById('metrics-container');

  try {
    const response = await window.api.getDashboardSummary();
    const data = response.data;

    container.innerHTML = '';

    const integrations = ['NSE', 'BSE', 'CVL KRA', 'CDSL', 'TechExcel'];

    integrations.forEach(integration => {
      const metrics = data[integration] || { total: 0, success: 0, pending: 0, rejected: 0 };

      const card = document.createElement('div');
      card.className = 'integration-card';
      card.innerHTML = `
        <div class="card-header">
          <h3>${escapeHtml(integration)}</h3>
          <span class="total-badge">${escapeHtml(metrics.total)} Total</span>
        </div>
        <div class="card-stats">
          <div class="stat stat-success">
            <span class="label">Success</span>
            <span class="value">${escapeHtml(metrics.success)}</span>
          </div>
          <div class="stat stat-pending">
            <span class="label">Pending</span>
            <span class="value">${escapeHtml(metrics.pending)}</span>
          </div>
          <div class="stat stat-rejected">
            <span class="label">Failed/Rejected</span>
            <span class="value">${escapeHtml(metrics.rejected)}</span>
          </div>
        </div>
        <div class="card-action">
          <a href="${integration.toLowerCase().replace(' ', '')}.html" class="view-link">View Records &rarr;</a>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (error) {
    container.innerHTML = '<div class="error-msg">Failed to load metrics. Please try again later.</div>';
    console.error(error);
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  initThemeToggle();

  await Promise.all([
    renderPushOperationsReport(),
    renderIntegrationCards()
  ]);
});
