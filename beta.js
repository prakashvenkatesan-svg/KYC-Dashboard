const betaState = {
  rows: [],
  kraFilter: '',
  digiFilter: ''
};

const betaEls = {};

const safe = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safe(value);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const statusClass = (value) => {
  const text = String(value || '').toLowerCase();
  if (!text || text === 'pending') return 'pending';
  if (text.includes('success') || text === 's' || text.includes('uploaded')) return 'success';
  if (text.includes('fail') || text.includes('reject') || text.includes('error')) return 'failed';
  return 'neutral';
};

const renderStatus = (value) => {
  const label = value || 'Pending';
  return `<span class="operation-status ${statusClass(label)}">${safe(label)}</span>`;
};

const getFilters = () => ({
  q: betaEls.search.value.trim(),
  flow: betaEls.flow.value,
  cvlkraStatus: betaEls.cvlkraStatus.value.trim(),
  currentStage: betaEls.stage.value.trim(),
  esignStatus: betaEls.esign.value,
  completed: betaEls.completed.value,
  limit: 500
});

const showAlert = (message, type = 'neutral') => {
  betaEls.alert.className = `beta-alert ${type}`;
  betaEls.alert.style.display = 'block';
  betaEls.alert.innerHTML = message;
};

const hideAlert = () => {
  betaEls.alert.style.display = 'none';
  betaEls.alert.innerHTML = '';
};

const renderSummary = (summary = {}) => {
  betaEls.summary.innerHTML = `
    <div class="push-kpi-card">
      <span>Total Rows</span>
      <strong>${summary.total || 0}</strong>
    </div>
    <div class="push-kpi-card">
      <span>KRA Flow</span>
      <strong>${summary.kra_flow_count || 0}</strong>
    </div>
    <div class="push-kpi-card">
      <span>DigiLocker Flow</span>
      <strong>${summary.digilocker_flow_count || 0}</strong>
    </div>
    <div class="push-kpi-card success">
      <span>eSign Completed</span>
      <strong>${summary.esign_completed_count || 0}</strong>
    </div>
  `;
};

const rowMatches = (row, filterText) => {
  if (!filterText) return true;
  const haystack = [
    row.pan,
    row.client_code,
    row.application_id,
    row.client_name,
    row.current_step,
    row.cvlkra_status,
    row.cdsl_push_status,
    row.nse_push_status,
    row.bse_status,
    row.techexcel_push_status,
    row.xml_status
  ].join(' ').toLowerCase();
  return haystack.includes(filterText.toLowerCase());
};

const renderPushButtons = (row) => {
  const appId = safe(row.application_id);
  const pan = safe(row.pan);
  return `
    <div class="beta-push-actions">
      <button data-push-target="cvlkra" data-application-id="${appId}" data-pan="${pan}">KRA Push</button>
      <button data-push-target="cvlkra_document" data-application-id="${appId}" data-pan="${pan}">Doc Push</button>
      <button data-push-target="orchestrator" data-application-id="${appId}" data-pan="${pan}">Orchestrator</button>
    </div>
  `;
};

const renderRows = (flowType, filterText) => {
  const rows = betaState.rows
    .filter(row => row.flow_type === flowType)
    .filter(row => rowMatches(row, filterText));

  if (!rows.length) {
    return `<tr><td colspan="12" class="empty-state">No ${safe(flowType)} rows found.</td></tr>`;
  }

  return rows.map(row => `
    <tr>
      <td><strong>${safe(row.pan || '')}</strong></td>
      <td>${safe(row.client_code || '')}</td>
      <td>
        <div>${safe(row.application_id)}</div>
        <div class="beta-muted">eSign: ${safe(row.esign_status || '')}</div>
      </td>
      <td>
        <div>${safe(row.client_name || '')}</div>
        <div class="beta-muted">${safe(row.email || '')}</div>
      </td>
      <td>
        <div>${safe(row.current_step || '')}</div>
        <div class="beta-muted">${formatDateTime(row.updated_at)}</div>
      </td>
      <td>
        ${renderStatus(row.cvlkra_status)}
        <div class="beta-muted">${safe(row.cvlkra_error || '')}</div>
      </td>
      <td>
        ${renderStatus(row.cdsl_push_status)}
        <div class="beta-muted">${safe(row.cdsl_msg_desc || '')}</div>
      </td>
      <td>
        ${renderStatus(row.nse_push_status)}
        <div class="beta-muted">${safe(row.nse_msg_desc || '')}</div>
      </td>
      <td>${renderStatus(row.bse_status)}</td>
      <td>${renderStatus(row.techexcel_push_status)}</td>
      <td>
        ${renderStatus(row.xml_status)}
        <div class="beta-muted">${safe(row.aadhaar_xml_s3_key || '')}</div>
      </td>
      <td>${renderPushButtons(row)}</td>
    </tr>
  `).join('');
};

const renderTables = () => {
  betaEls.kraBody.innerHTML = renderRows('KRA', betaState.kraFilter);
  betaEls.digiBody.innerHTML = renderRows('DigiLocker', betaState.digiFilter);
};

const loadBetaEntries = async () => {
  hideAlert();
  betaEls.kraBody.innerHTML = '<tr><td colspan="12">Loading...</td></tr>';
  betaEls.digiBody.innerHTML = '<tr><td colspan="12">Loading...</td></tr>';

  try {
    const response = await window.api.getBetaEntries(getFilters());
    if (!response || response.forbidden) {
      showAlert(safe(response?.message || 'Admin access required.'), 'failed');
      betaEls.kraBody.innerHTML = '<tr><td colspan="12">Admin access required.</td></tr>';
      betaEls.digiBody.innerHTML = '<tr><td colspan="12">Admin access required.</td></tr>';
      return;
    }

    if (!response.success) {
      throw new Error(response.message || 'Failed to fetch beta entries.');
    }

    betaState.rows = response.data || [];
    renderSummary(response.summary || {});
    renderTables();
  } catch (error) {
    showAlert(safe(error.message || 'Failed to load beta entries.'), 'failed');
    betaEls.kraBody.innerHTML = '<tr><td colspan="12">Failed to load.</td></tr>';
    betaEls.digiBody.innerHTML = '<tr><td colspan="12">Failed to load.</td></tr>';
  }
};

const resetFilters = () => {
  betaEls.search.value = '';
  betaEls.flow.value = '';
  betaEls.cvlkraStatus.value = '';
  betaEls.stage.value = '';
  betaEls.esign.value = '';
  betaEls.completed.value = '';
  betaEls.kraLocalFilter.value = '';
  betaEls.digiLocalFilter.value = '';
  betaState.kraFilter = '';
  betaState.digiFilter = '';
  loadBetaEntries();
};

const copyKraPans = async () => {
  const pans = betaState.rows
    .filter(row => row.flow_type === 'KRA')
    .map(row => row.pan)
    .filter(Boolean)
    .join('\n');

  if (!pans) {
    showAlert('No KRA flow PANs found in the current result set.', 'neutral');
    return;
  }

  try {
    await navigator.clipboard.writeText(pans);
    showAlert(`Copied ${pans.split('\n').length} KRA flow PAN(s).`, 'success');
  } catch (error) {
    showAlert(`<pre>${safe(pans)}</pre>`, 'neutral');
  }
};

const handlePushClick = async (event) => {
  const button = event.target.closest('button[data-push-target]');
  if (!button) return;

  const target = button.dataset.pushTarget;
  const applicationId = button.dataset.applicationId;
  const pan = button.dataset.pan;
  const label = button.textContent.trim();
  const ok = window.confirm(`Run ${label} for ${pan || applicationId}?`);
  if (!ok) return;

  button.disabled = true;
  const oldText = button.textContent;
  button.textContent = 'Pushing...';
  showAlert(`Running ${safe(label)} for ${safe(pan || applicationId)}...`, 'neutral');

  try {
    const response = await window.api.pushBetaEntry({ target, applicationId, pan });
    const pretty = safe(JSON.stringify(response, null, 2));
    showAlert(`<strong>${safe(label)} response</strong><pre>${pretty}</pre>`, response.success ? 'success' : 'failed');
    await loadBetaEntries();
  } catch (error) {
    showAlert(safe(error.message || 'Push failed.'), 'failed');
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  betaEls.search = document.getElementById('beta-search');
  betaEls.flow = document.getElementById('beta-flow');
  betaEls.cvlkraStatus = document.getElementById('beta-cvlkra-status');
  betaEls.stage = document.getElementById('beta-stage');
  betaEls.esign = document.getElementById('beta-esign');
  betaEls.completed = document.getElementById('beta-completed');
  betaEls.apply = document.getElementById('beta-apply');
  betaEls.reset = document.getElementById('beta-reset');
  betaEls.copyKraPans = document.getElementById('beta-copy-kra-pans');
  betaEls.alert = document.getElementById('beta-alert');
  betaEls.summary = document.getElementById('beta-summary');
  betaEls.kraBody = document.getElementById('beta-kra-body');
  betaEls.digiBody = document.getElementById('beta-digi-body');
  betaEls.kraLocalFilter = document.getElementById('beta-kra-local-filter');
  betaEls.digiLocalFilter = document.getElementById('beta-digi-local-filter');

  betaEls.apply.addEventListener('click', loadBetaEntries);
  betaEls.reset.addEventListener('click', resetFilters);
  betaEls.copyKraPans.addEventListener('click', copyKraPans);
  betaEls.kraLocalFilter.addEventListener('input', () => {
    betaState.kraFilter = betaEls.kraLocalFilter.value.trim();
    renderTables();
  });
  betaEls.digiLocalFilter.addEventListener('input', () => {
    betaState.digiFilter = betaEls.digiLocalFilter.value.trim();
    renderTables();
  });
  document.querySelector('.beta-page').addEventListener('click', handlePushClick);

  loadBetaEntries();
});
