let currentPage = 1;
const limit = 20;
let totalRecords = 0;
let initialIntegration = null;
let currentSortBy = 'application_date';
let currentSortOrder = 'desc'; // 'desc', 'asc', or ''
let sidebarKycStatus = '';
let sidebarKycStatusNavTriggered = false;

// Define all possible columns and their properties
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
  esign_pdf: { label: 'ESIGN PDF', mandatory: false }, // The PDF check link
  action: { label: 'ACTION/EDIT', mandatory: false } // Action menu
};

// Default visible columns and order for main clients page
const DEFAULT_VISIBLE = [
  'application_date', 'client_code', 'client_name', 'pan_number', 'email_id', 'mobile_number',
  'current_stage', 'kyc_status', 'cvlkra', 'cdsl', 'nse', 'bse', 'techexcel', 'esign_pdf', 'action'
];
const DEFAULT_ORDER = [...DEFAULT_VISIBLE];

// State for active page preferences
let visibleColumns = [];
let columnOrder = [];
const CLIENT_LIST_STATE_KEY = 'kyc_client_list_state';

function getClientListState() {
  return {
    search: document.getElementById('search-input')?.value || '',
    integration: document.getElementById('integration-filter')?.value || '',
    status: document.getElementById('status-filter')?.value || '',
    currentStage: document.getElementById('current-stage-filter')?.value || '',
    fromDate: document.getElementById('from-date')?.value || '',
    toDate: document.getElementById('to-date')?.value || '',
    kycStatus: sidebarKycStatus,
    currentPage,
    currentSortBy,
    currentSortOrder
  };
}

function saveClientListState() {
  try {
    sessionStorage.setItem(CLIENT_LIST_STATE_KEY, JSON.stringify(getClientListState()));
  } catch (error) {}
}

function restoreClientListState() {
  try {
    const raw = sessionStorage.getItem(CLIENT_LIST_STATE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);

    const searchInput = document.getElementById('search-input');
    const integrationFilter = document.getElementById('integration-filter');
    const statusFilter = document.getElementById('status-filter');
    const stageFilter = document.getElementById('current-stage-filter');
    const fromDate = document.getElementById('from-date');
    const toDate = document.getElementById('to-date');

    if (searchInput && typeof state.search === 'string') searchInput.value = state.search;
    if (!initialIntegration && integrationFilter && typeof state.integration === 'string') integrationFilter.value = state.integration;
    if (statusFilter && typeof state.status === 'string') statusFilter.value = state.status;
    if (stageFilter && typeof state.currentStage === 'string') stageFilter.value = state.currentStage;
    if (fromDate && typeof state.fromDate === 'string') fromDate.value = state.fromDate;
    if (toDate && typeof state.toDate === 'string') toDate.value = state.toDate;

    if (!sidebarKycStatus && typeof state.kycStatus === 'string') {
      sidebarKycStatus = normalizeKycStatusValue(state.kycStatus);
    }

    if (!sidebarKycStatusNavTriggered && Number.isFinite(Number(state.currentPage)) && Number(state.currentPage) > 0) {
      currentPage = Number(state.currentPage);
    }
    if (typeof state.currentSortBy === 'string' && state.currentSortBy) currentSortBy = state.currentSortBy;
    if (typeof state.currentSortOrder === 'string' && state.currentSortOrder) currentSortOrder = state.currentSortOrder;
  } catch (error) {}
}

function normalizeKycStatusValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  initialIntegration = urlParams.get('integration');
  sidebarKycStatus = normalizeKycStatusValue(urlParams.get('kyc_status'));
  const sidebarNavFlag = normalizeKycStatusValue(sessionStorage.getItem('kyc_sidebar_status_nav'));
  sidebarKycStatusNavTriggered = Boolean(sidebarKycStatus && sidebarNavFlag && sidebarNavFlag === sidebarKycStatus);
  if (sidebarKycStatusNavTriggered) {
    sessionStorage.removeItem('kyc_sidebar_status_nav');
    currentPage = 1;
  }
  const path = window.location.pathname.toLowerCase();
  
  if (!initialIntegration) {
    if (path.includes('nse.html')) initialIntegration = 'nse';
    else if (path.includes('bse.html')) initialIntegration = 'bse';
    else if (path.includes('cvlkra.html')) initialIntegration = 'cvlkra';
    else if (path.includes('cdsl.html')) initialIntegration = 'cdsl';
    else if (path.includes('techexcel.html')) initialIntegration = 'techexcel';
  }
  
  // Set default state based on page type (main vs integration)
  if (initialIntegration) {
    const intName = initialIntegration.toLowerCase();
    // Default columns for integration pages (hide current_stage, show specific reason)
    const intDefaults = [
      'application_date', 'client_code', 'client_name', 'pan_number', 'email_id', 'mobile_number',
      'current_stage', 'kyc_status', intName, `${intName}_reason`, 'esign_pdf', 'action'
    ];
    visibleColumns = [...intDefaults];
    columnOrder = [...intDefaults];
  } else {
    visibleColumns = [...DEFAULT_VISIBLE];
    columnOrder = [...DEFAULT_ORDER];
  }

  // Auth & Permissions check
  if (initialIntegration) {
    const userStr = localStorage.getItem('kyc_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const mods = user.modules || [];
        const moduleMap = { 'nse': 'NSE', 'bse': 'BSE', 'cvlkra': 'CVL KRA', 'cdsl': 'CDSL', 'techexcel': 'TechExcel' };
        const requiredModule = moduleMap[initialIntegration.toLowerCase()];
        
        if (user.role !== 'Admin' && !mods.includes(requiredModule)) {
          alert('Unauthorized access. You do not have permission to view ' + requiredModule + ' records.');
          window.location.href = 'dashboard.html';
          return;
        }
      } catch(e) {}
    }
    
    const filterDropdown = document.getElementById('integration-filter');
    if (filterDropdown) {
      filterDropdown.value = initialIntegration.toLowerCase();
      filterDropdown.disabled = true;
      filterDropdown.style.opacity = '0.7';
      filterDropdown.style.cursor = 'not-allowed';
    }
    document.getElementById('page-title').textContent = `${initialIntegration.toUpperCase()} - Client Listing`;
  }
  
  // Load User Preferences
  const pageCode = initialIntegration ? initialIntegration.toLowerCase() : 'clients';
  if (window.api && window.api.getPreferences) {
    const prefs = await window.api.getPreferences(pageCode);
    if (prefs && prefs.data) {
      visibleColumns = prefs.data.visibleColumns;
      columnOrder = prefs.data.columnOrder;
      if (prefs.data.sortBy) currentSortBy = prefs.data.sortBy;
      if (prefs.data.sortOrder) currentSortOrder = prefs.data.sortOrder;
    }
  }

  restoreClientListState();
  if (sidebarKycStatusNavTriggered) {
    currentPage = 1;
  }
  
  setupCustomizeColumnsUI();
  renderTableHeaders();
  setupClientExportUI();
  
  document.getElementById('search-btn').addEventListener('click', () => {
    currentPage = 1;
    saveClientListState();
    loadClients();
  });
  
  document.getElementById('reset-btn').addEventListener('click', () => {
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    
    if (!initialIntegration) {
      const intFilter = document.getElementById('integration-filter');
      if (intFilter) intFilter.value = '';
    }
    
    const statusFilter = document.getElementById('status-filter');
    if (statusFilter) statusFilter.value = '';
    
    const stageFilter = document.getElementById('current-stage-filter');
    if (stageFilter) stageFilter.value = '';
    
    const fromDate = document.getElementById('from-date');
    if (fromDate) fromDate.value = '';
    
    const toDate = document.getElementById('to-date');
    if (toDate) toDate.value = '';

    sidebarKycStatus = '';
    sidebarKycStatusNavTriggered = false;
    sessionStorage.removeItem('kyc_sidebar_status_nav');
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    
    currentPage = 1;
    sessionStorage.removeItem(CLIENT_LIST_STATE_KEY);
    loadClients();
  });

  const stageFilter = document.getElementById('current-stage-filter');
  bindChangeToRefresh(stageFilter);
  
  document.getElementById('prev-btn').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      saveClientListState();
      loadClients();
    }
  });
  
  document.getElementById('next-btn').addEventListener('click', () => {
    if (currentPage * limit < totalRecords) {
      currentPage++;
      saveClientListState();
      loadClients();
    }
  });

  const closeBtns = document.querySelectorAll('.close-status-modal');
  closeBtns.forEach(btn => btn.addEventListener('click', () => {
    document.getElementById('status-modal').style.display = 'none';
  }));
  
  // Initial load
  saveClientListState();
  loadClients();
});

// --- Table Customization Logic ---
const setupCustomizeColumnsUI = () => {
  const customizeBtn = document.getElementById('customize-cols-btn');
  const customizePanel = document.getElementById('customize-cols-panel');
  const closeBtn = document.getElementById('close-customize-btn');
  const resetBtn = document.getElementById('reset-cols-btn');
  const saveBtn = document.getElementById('save-cols-btn');
  const columnsList = document.getElementById('columns-list');
  
  if (!customizeBtn || !customizePanel) return;
  
  customizeBtn.addEventListener('click', () => {
    customizePanel.style.display = customizePanel.style.display === 'none' ? 'flex' : 'none';
    if (customizePanel.style.display === 'flex') {
      renderCustomizeList();
    }
  });
  
  closeBtn.addEventListener('click', () => {
    customizePanel.style.display = 'none';
  });
  
  resetBtn.addEventListener('click', async () => {
    if (initialIntegration) {
      const intName = initialIntegration.toLowerCase();
      const intDefaults = [
        'application_date', 'client_code', 'client_name', 'pan_number', 'email_id', 'mobile_number',
        'current_stage', 'kyc_status', intName, `${intName}_reason`, 'esign_pdf', 'action'
      ];
      visibleColumns = [...intDefaults];
      columnOrder = [...intDefaults];
    } else {
      visibleColumns = [...DEFAULT_VISIBLE];
      columnOrder = [...DEFAULT_ORDER];
    }
    currentSortBy = 'application_date';
    currentSortOrder = 'desc';
    
    await saveUserPreferences();
    renderCustomizeList();
    renderTableHeaders();
    currentPage = 1;
    loadClients();
  });
  
  saveBtn.addEventListener('click', async () => {
    // Collect new order and visibility from the UI
    const items = columnsList.querySelectorAll('.col-item');
    const newOrder = [];
    const newVisible = [];
    
    items.forEach(item => {
      const colId = item.dataset.col;
      const isChecked = item.querySelector('input[type="checkbox"]').checked;
      newOrder.push(colId);
      if (isChecked) newVisible.push(colId);
    });
    
    columnOrder = newOrder;
    visibleColumns = newVisible;
    
    await saveUserPreferences();
    customizePanel.style.display = 'none';
    renderTableHeaders();
    loadClients();
  });
};

const renderCustomizeList = () => {
  const list = document.getElementById('columns-list');
  list.innerHTML = '';
  
  // Create all available columns for the page context
  let availableCols = Object.keys(ALL_COLUMNS);
  if (initialIntegration) {
     // Hide current_stage and other integration specific columns on dedicated integration pages
     const intName = initialIntegration.toLowerCase();
     availableCols = availableCols.filter(c => (!c.endsWith('_reason') || c === `${intName}_reason`) && (!['nse','bse','cvlkra','cdsl','techexcel'].includes(c) || c === intName));
  } else {
     // On main page, hide reason columns by default to keep it clean (they can be enabled if wanted)
  }
  
  // Sort available cols by current user order, append any not in user order to the end
  const orderedCols = [];
  columnOrder.forEach(col => {
    if (availableCols.includes(col)) orderedCols.push(col);
  });
  availableCols.forEach(col => {
    if (!orderedCols.includes(col)) orderedCols.push(col);
  });
  
  orderedCols.forEach(col => {
    const config = ALL_COLUMNS[col];
    const item = document.createElement('div');
    item.className = 'col-item';
    item.dataset.col = col;
    item.draggable = true;
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.gap = '8px';
    item.style.padding = '6px';
    item.style.border = '1px solid var(--border-color)';
    item.style.borderRadius = '4px';
    item.style.backgroundColor = 'var(--bg-color)';
    item.style.cursor = 'grab';
    
    const isVisible = visibleColumns.includes(col);
    const disabledAttr = config.mandatory ? 'disabled title="Mandatory column"' : '';
    const checkedAttr = (isVisible || config.mandatory) ? 'checked' : '';
    
    item.innerHTML = `
      <span class="drag-handle" style="cursor: grab; color: var(--text-muted);">☰</span>
      <input type="checkbox" id="chk-${col}" ${checkedAttr} ${disabledAttr}>
      <label for="chk-${col}" style="flex:1; cursor: pointer; font-size: 0.9rem; margin:0;">${config.label}</label>
    `;
    
    // Drag and drop listeners
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', col);
      item.classList.add('dragging');
      item.style.opacity = '0.5';
    });
    
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      item.style.opacity = '1';
      document.querySelectorAll('.col-item').forEach(el => el.style.borderBottom = '1px solid var(--border-color)');
    });
    
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      item.style.borderBottom = '2px solid var(--primary-color)';
    });
    
    item.addEventListener('dragleave', () => {
      item.style.borderBottom = '1px solid var(--border-color)';
    });
    
    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.style.borderBottom = '1px solid var(--border-color)';
      const draggingCol = e.dataTransfer.getData('text/plain');
      const draggingEl = document.querySelector(`.col-item[data-col="${draggingCol}"]`);
      if (draggingEl && draggingEl !== item) {
        // Insert before the drop target
        list.insertBefore(draggingEl, item);
      }
    });
    
    list.appendChild(item);
  });
};

const renderTableHeaders = () => {
  const theadRow = document.getElementById('table-header-row');
  if (!theadRow) return;
  
  theadRow.innerHTML = '';
  
  columnOrder.forEach(col => {
    if (visibleColumns.includes(col) || ALL_COLUMNS[col].mandatory) {
      const th = document.createElement('th');
      th.dataset.col = col;
      
      let html = ALL_COLUMNS[col].label;
      if (col === 'application_date') {
        th.style.cursor = 'pointer';
        th.style.userSelect = 'none';
        
        let icon = '&uarr;&darr;'; // Default
        if (currentSortOrder === 'desc') icon = '&darr;';
        if (currentSortOrder === 'asc') icon = '&uarr;';
        
        html += ` <span style="font-size:12px; margin-left:4px;">${icon}</span>`;
        
        th.addEventListener('click', async () => {
          if (currentSortOrder === 'desc') currentSortOrder = 'asc';
          else if (currentSortOrder === 'asc') currentSortOrder = 'desc'; // User requested: DESC -> ASC -> Default (DESC)
          else currentSortOrder = 'desc';
          
          await saveUserPreferences();
          renderTableHeaders();
          currentPage = 1;
          loadClients();
        });
      }
      th.innerHTML = html;
      theadRow.appendChild(th);
    }
  });
};

const saveUserPreferences = async () => {
  if (window.api && window.api.savePreferences) {
    const pageCode = initialIntegration ? initialIntegration.toLowerCase() : 'clients';
    await window.api.savePreferences(pageCode, {
      visibleColumns,
      columnOrder,
      sortBy: currentSortBy,
      sortOrder: currentSortOrder
    });
  }
};

const setupClientExportUI = () => {
  const exportBtn = document.getElementById('export-clients-btn');
  const exportMenu = document.getElementById('export-clients-menu');
  const csvBtn = document.getElementById('export-clients-csv');
  const excelBtn = document.getElementById('export-clients-excel');
  const pdfBtn = document.getElementById('export-clients-pdf');

  if (!exportBtn || !exportMenu) return;

  const closeMenu = () => {
    exportMenu.style.display = 'none';
  };

  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.style.display = exportMenu.style.display === 'flex' ? 'none' : 'flex';
  });

  csvBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    await exportClients('csv');
  });
  excelBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    await exportClients('excel');
  });
  pdfBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    await exportClients('pdf');
  });

  document.addEventListener('click', (e) => {
    if (!exportMenu.contains(e.target) && e.target !== exportBtn) {
      closeMenu();
    }
  });
};

function getClientExportColumns() {
  return columnOrder.filter(col => (visibleColumns.includes(col) || ALL_COLUMNS[col].mandatory) && col !== 'action');
}

function getClientExportFilters() {
  return {
    q: document.getElementById('search-input')?.value?.trim() || '',
    integration: document.getElementById('integration-filter')?.value || '',
    status: document.getElementById('status-filter')?.value || '',
    currentStage: document.getElementById('current-stage-filter')?.value || '',
    kycStatus: sidebarKycStatus,
    fromDate: document.getElementById('from-date')?.value || '',
    toDate: document.getElementById('to-date')?.value || ''
  };
}

function escapeCsv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fallbackCopyText(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand('copy');
  } finally {
    textarea.remove();
  }
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  fallbackCopyText(text);
}

function appendCopyableValueCell(td, value, label, options = {}) {
  const rawValue = String(value ?? '').trim();
  const displayValue = rawValue || 'N/A';
  const canCopy = rawValue && rawValue !== 'N/A';

  const wrapper = document.createElement('div');
  wrapper.className = 'copyable-cell-value';

  const valueEl = document.createElement(options.strong ? 'strong' : 'span');
  valueEl.textContent = displayValue;
  wrapper.appendChild(valueEl);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'copy-cell-btn';
  button.textContent = 'Copy';
  button.title = `Copy ${label}`;
  button.setAttribute('aria-label', `Copy ${label}`);
  button.disabled = !canCopy;

  if (canCopy) {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();

      try {
        await copyTextToClipboard(rawValue);
        button.textContent = 'Copied';
        button.classList.add('copied');

        window.setTimeout(() => {
          button.textContent = 'Copy';
          button.classList.remove('copied');
        }, 1200);
      } catch (error) {
        console.error('Failed to copy value', error);
        alert(`Unable to copy ${label}.`);
      }
    });
  }

  wrapper.appendChild(button);
  td.appendChild(wrapper);
}

function formatCurrentStage(currentStep) {
  const step = String(currentStep || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .trim();

  const formattedStep = step
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
  return formattedStep || 'N/A';
}

function getClientExportValue(client, col) {
  switch (col) {
    case 'application_date':
      return client.application_date ? new Date(client.application_date).toLocaleDateString('en-GB') : 'N/A';
    case 'client_code':
      return client.client_code || 'N/A';
    case 'client_name':
      return client.client_name || 'Unknown';
    case 'pan_number':
      return client.pan_number || 'N/A';
    case 'email_id':
      return client.email || 'N/A';
    case 'mobile_number':
      return client.mobile_number || 'N/A';
    case 'current_stage':
      return formatCurrentStage(client.current_stage);
    case 'kyc_status':
      return client.kyc_status || 'N/A';
    case 'cvlkra':
      return client.cvlkra_sync_status || 'N/A';
    case 'cvlkra_reason':
      return client.cvlkra_rejection_reason || '-';
    case 'cdsl':
      return client.cdsl_push_status || 'N/A';
    case 'cdsl_reason':
      return client.cdsl_rejection_reason || '-';
    case 'nse':
      return client.nse_push_status || 'N/A';
    case 'nse_reason':
      return client.nse_rejection_reason || '-';
    case 'bse':
      return client.bse_push_status || 'N/A';
    case 'bse_reason':
      return client.bse_rejection_reason || '-';
    case 'techexcel':
      return client.techexcel_push_status || 'N/A';
    case 'techexcel_reason':
      return client.techexcel_rejection_reason || '-';
    case 'esign_pdf':
      return client.client_code && client.client_code !== 'N/A'
        ? `client-detail.html?code=${client.client_code}`
        : `client-detail.html?id=${client.application_id}`;
    default:
      return client[col] ?? '-';
  }
}

async function fetchClientsForExport() {
  const filters = getClientExportFilters();
  if (filters.fromDate && filters.toDate && new Date(filters.toDate) < new Date(filters.fromDate)) {
    alert("To Date cannot be earlier than From Date.");
    return null;
  }

  const params = {
    q: filters.q,
    limit: 50000,
    offset: 0,
    sortBy: currentSortBy,
    sortOrder: currentSortOrder,
    isExport: 'true'
  };

  if (filters.integration) params.integration = filters.integration;
  if (filters.status) params.status = filters.status;
  if (filters.currentStage) params.currentStage = filters.currentStage;
  if (filters.kycStatus) params.kyc_status = filters.kycStatus;
  if (filters.fromDate) params.fromDate = filters.fromDate;
  if (filters.toDate) params.toDate = filters.toDate;

  const response = await window.api.getClients(params);
  return response?.data || [];
}

function buildClientExportTable(clients, columns) {
  const headers = columns.map(col => ALL_COLUMNS[col]?.label || col);
  const rows = clients.map(client => columns.map(col => getClientExportValue(client, col)));
  return { headers, rows };
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function exportClients(format) {
  const clients = await fetchClientsForExport();
  if (!clients) return;
  if (!clients.length) {
    alert('No client records found to export.');
    return;
  }

  const columns = getClientExportColumns();
  const { headers, rows } = buildClientExportTable(clients, columns);
  const timestamp = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    const csv = [
      headers.map(escapeCsv).join(','),
      ...rows.map(row => row.map(escapeCsv).join(','))
    ].join('\n');
    downloadTextFile(`clients_export_${timestamp}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8;');
    return;
  }

  if (format === 'excel') {
    const tableHtml = `
      <html>
      <head><meta charset="utf-8"></head>
      <body>
        <table border="1">
          <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    downloadTextFile(`clients_export_${timestamp}.xls`, tableHtml, 'application/vnd.ms-excel');
    return;
  }

  if (format === 'pdf') {
    const win = window.open('', '_blank', 'width=1200,height=800');
    if (!win) {
      alert('Popup blocked. Please allow popups to export PDF.');
      return;
    }

    const tableRows = rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('');
    win.document.write(`
      <html>
      <head>
        <title>Clients Export</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <h2>Clients Export</h2>
        <table>
          <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 300);
  }
}

// --- Table Rendering Logic ---
const renderStatusBadge = (status, reason, integrationName, clientObj) => {
  if (!status) return `<span class="status-badge" style="background:#6c757d">Not Started</span>`;
  
  const s = status.toLowerCase();
  let color = '#6c757d';
  if (s === 'success' || s === 's') color = '#10B981';
  else if (s === 'failed' || s === 'rejected' || s === 'r' || s === 'f') color = '#dc3545';
  else if (s === 'pending' || s === 'p') color = '#f59e0b';
  else if (s === 'uploaded' || s === 'u') color = '#17a2b8';
  
  let html = `<span class="status-badge status-${s}" style="background:${color}; cursor:pointer;">${status}</span>`;
  if (s === 'rejected' && reason) {
    html = `<span class="status-badge status-${s}" style="background:${color}; cursor:pointer;" title="${reason}">${status}(R)</span>`;
  }
  
  const clientJson = encodeURIComponent(JSON.stringify(clientObj));
  const safeReason = encodeURIComponent(reason || '');
  return `<div onclick="event.stopPropagation(); showStatusModal('${integrationName}', '${status}', '${safeReason}', '${clientObj.last_updated}', decodeURIComponent('${clientJson}'))">${html}</div>`;
};

window.showStatusModal = (integrationName, status, reason, lastUpdated, clientJson) => {
  const clientObj = JSON.parse(clientJson);
  
  document.getElementById('modal-status-body').innerHTML = `
    <p><strong>Client Code:</strong> ${clientObj.client_code || 'N/A'}</p>
    <p><strong>Client Name:</strong> ${clientObj.client_name || 'N/A'}</p>
    <p><strong>Integration:</strong> ${integrationName.toUpperCase()}</p>
    <p><strong>Current Status:</strong> <span class="status-badge status-${status.toLowerCase()}" style="display:inline-block; margin-left:10px;">${status}</span></p>
    ${reason && reason !== 'undefined' ? `<p><strong>Rejection Reason / Remarks:</strong> <span style="color: #dc3545;">${reason}</span></p>` : ''}
    <p><strong>Last Updated:</strong> ${lastUpdated && lastUpdated !== 'undefined' ? new Date(lastUpdated).toLocaleString('en-GB') : 'N/A'}</p>
  `;
  
  document.getElementById('status-modal').style.display = 'flex';
};

const loadClients = async () => {
  saveClientListState();
  const tbody = document.getElementById('clients-tbody');
  const searchInputEl = document.getElementById('search-input');
  const searchInput = searchInputEl ? searchInputEl.value : '';

  const integrationFilterEl = document.getElementById('integration-filter');
  const integrationFilter = integrationFilterEl ? integrationFilterEl.value : '';

  const statusFilterEl = document.getElementById('status-filter');
  const statusFilter = statusFilterEl ? statusFilterEl.value : '';

  const currentStageFilterEl = document.getElementById('current-stage-filter');
  const currentStageFilter = currentStageFilterEl ? currentStageFilterEl.value : '';

  const fromDateEl = document.getElementById('from-date');
  const fromDate = fromDateEl ? fromDateEl.value : '';

  const toDateEl = document.getElementById('to-date');
  const toDate = toDateEl ? toDateEl.value : '';
  
  if (fromDate && toDate && new Date(toDate) < new Date(fromDate)) {
    alert("To Date cannot be earlier than From Date.");
    return;
  }
  
  const activeCols = columnOrder.filter(col => visibleColumns.includes(col) || ALL_COLUMNS[col].mandatory);
  const colCount = activeCols.length;
  tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center;">Loading...</td></tr>`;
  
  try {
    const offset = (currentPage - 1) * limit;
    const params = {
      q: searchInput,
      limit,
      offset,
      sortBy: currentSortBy,
      sortOrder: currentSortOrder
    };
    
    if (integrationFilter || statusFilter || fromDate || toDate || currentStageFilter) {
      if (integrationFilter) params.integration = integrationFilter;
      if (statusFilter) params.status = statusFilter;
      if (currentStageFilter) params.currentStage = currentStageFilter;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
    }
    if (sidebarKycStatus) params.kyc_status = sidebarKycStatus;
    
    const response = await window.api.getClients(params);
    const clients = response.data;
    totalRecords = response.pagination.total;
    
    document.getElementById('page-info').textContent = `Showing ${Math.min(offset + 1, totalRecords)} - ${Math.min(offset + limit, totalRecords)} of ${totalRecords}`;
    
    document.getElementById('prev-btn').disabled = currentPage === 1;
    document.getElementById('next-btn').disabled = currentPage * limit >= totalRecords;
    
    tbody.innerHTML = '';
    
    if (clients.length === 0) {
      const msg = (fromDate || toDate) ? "No records found for the selected date range" : "No clients found";
      tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center;">${msg}</td></tr>`;
      return;
    }
    
    clients.forEach(client => {
      const tr = document.createElement('tr');
      tr.onclick = (e) => {
        saveClientListState();
        if (client.client_code && client.client_code !== 'N/A') {
          window.location.href = `client-detail.html?code=${client.client_code}`;
        } else if (client.application_id) {
          window.location.href = `client-detail.html?id=${client.application_id}`;
        } else {
          alert("Client details cannot be loaded because neither Client Code nor Application ID is available.");
        }
      };
      
      const appDate = client.application_date ? new Date(client.application_date).toLocaleDateString('en-GB') : 'N/A';
      
      // Render columns in the exact order specified by activeCols
      activeCols.forEach(col => {
        const td = document.createElement('td');
        
        switch (col) {
          case 'application_date': td.textContent = appDate; break;
          case 'client_code':
            appendCopyableValueCell(td, client.client_code, 'Client Code', { strong: true });
            break;
          case 'client_name': td.textContent = client.client_name || 'Unknown'; break;
          case 'pan_number':
            appendCopyableValueCell(td, client.pan_number, 'PAN Number');
            break;
          case 'email_id': td.textContent = client.email || 'N/A'; break;
          case 'mobile_number': td.textContent = client.mobile_number || 'N/A'; break;
          case 'current_stage': 
            td.textContent = formatCurrentStage(client.current_stage); 
            break;
          case 'kyc_status':
            td.textContent = client.kyc_status || 'N/A';
            break;
          case 'nse': td.innerHTML = renderStatusBadge(client.nse_push_status, client.nse_rejection_reason, 'NSE', client); break;
          case 'nse_reason': td.innerHTML = `<span style="color: #dc3545; font-size: 0.85em;">${client.nse_rejection_reason || '-'}</span>`; break;
          case 'bse': td.innerHTML = renderStatusBadge(client.bse_push_status, client.bse_rejection_reason, 'BSE', client); break;
          case 'bse_reason': td.innerHTML = `<span style="color: #dc3545; font-size: 0.85em;">${client.bse_rejection_reason || '-'}</span>`; break;
          case 'cvlkra': td.innerHTML = renderStatusBadge(client.cvlkra_sync_status, client.cvlkra_rejection_reason, 'CVL KRA', client); break;
          case 'cvlkra_reason': td.innerHTML = `<span style="color: #dc3545; font-size: 0.85em;">${client.cvlkra_rejection_reason || '-'}</span>`; break;
          case 'cdsl': td.innerHTML = renderStatusBadge(client.cdsl_push_status, client.cdsl_rejection_reason, 'CDSL', client); break;
          case 'cdsl_reason': td.innerHTML = `<span style="color: #dc3545; font-size: 0.85em;">${client.cdsl_rejection_reason || '-'}</span>`; break;
          case 'techexcel': td.innerHTML = renderStatusBadge(client.techexcel_push_status, client.techexcel_rejection_reason, 'TechExcel', client); break;
          case 'techexcel_reason': td.innerHTML = `<span style="color: #dc3545; font-size: 0.85em;">${client.techexcel_rejection_reason || '-'}</span>`; break;
          case 'esign_pdf': 
            const href = (client.client_code && client.client_code !== 'N/A') 
              ? `client-detail.html?code=${client.client_code}` 
              : `client-detail.html?id=${client.application_id}`;
            td.innerHTML = `<a href="${href}" onclick="event.stopPropagation();" style="color:var(--primary-color); text-decoration:none; font-weight:500;">Check PDF</a>`; 
            break;
          case 'action':
            td.style.position = 'relative';
            td.innerHTML = `
              <div class="action-dropdown-container" onclick="event.stopPropagation();">
                <button class="action-btn" onclick="toggleActionMenu('${client.application_id}', event)" style="background:transparent; border:none; font-size:1.2rem; cursor:pointer; color:var(--text-color);">⋮</button>
                <div id="action-menu-${client.application_id}" class="action-menu" style="display:none; position:absolute; right:0; background:var(--surface-color); border:1px solid var(--border-color); border-radius:4px; box-shadow:0 2px 8px rgba(0,0,0,0.1); z-index:100; min-width:120px; flex-direction:column;">
                  <button onclick="handleClientAction('${client.application_id}', 'delete')" style="padding:8px 12px; border:none; background:transparent; text-align:left; cursor:pointer; color:var(--rejected-color); width:100%; border-bottom:1px solid var(--border-color);">Delete</button>
                  <button onclick="handleClientAction('${client.application_id}', 'skip_payment')" style="padding:8px 12px; border:none; background:transparent; text-align:left; cursor:pointer; color:var(--text-color); width:100%; border-bottom:1px solid var(--border-color);">Payment Skip</button>
                  <button onclick="handleClientAction('${client.application_id}', 'step_back')" style="padding:8px 12px; border:none; background:transparent; text-align:left; cursor:pointer; color:var(--text-color); width:100%;">Step Back</button>
                </div>
              </div>
            `;
            break;
        }
        
        tr.appendChild(td);
      });
      
      tbody.appendChild(tr);
    });
    
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: red;">Failed to load clients</td></tr>`;
    console.error(error);
  }
};

function bindChangeToRefresh(el) {
  if (!el) return;
  let lastValue = el.value;
  el.addEventListener('change', () => {
    const currentValue = el.value;
    if (currentValue !== lastValue) {
      currentPage = 1;
      saveClientListState();
      loadClients();
    }
    lastValue = currentValue;
  });
}

window.toggleActionMenu = (appId, event) => {
  event.stopPropagation();
  const menus = document.querySelectorAll('.action-menu');
  menus.forEach(m => {
    if (m.id !== `action-menu-${appId}`) m.style.display = 'none';
  });
  
  const menu = document.getElementById(`action-menu-${appId}`);
  if (menu) {
    menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
  }
};

document.addEventListener('click', () => {
  const menus = document.querySelectorAll('.action-menu');
  menus.forEach(m => m.style.display = 'none');
});

window.handleClientAction = async (appId, action) => {
  const menu = document.getElementById(`action-menu-${appId}`);
  if (menu) menu.style.display = 'none';
  
  if (action === 'delete') {
    if (confirm('Are you sure you want to delete this client record?')) {
      try {
        const res = await window.api.delete(`/kyc-applications/${appId}`);
        if (res.success) {
          alert('Client record deleted successfully.');
          loadClients();
        } else {
          alert('Failed to delete: ' + res.message);
        }
      } catch (err) {
        alert('An error occurred.');
        console.error(err);
      }
    }
  } else if (action === 'skip_payment') {
    if (confirm('Are you sure you want to skip payment for this client?')) {
      try {
        const res = await window.api.post(`/kyc-applications/${appId}/skip-payment`, {});
        if (res.success) {
          alert('Payment skipped successfully.');
          loadClients();
        } else {
          alert('Failed to skip payment: ' + res.message);
        }
      } catch (err) {
        alert('An error occurred.');
        console.error(err);
      }
    }
  } else if (action === 'step_back') {
    if (confirm('Are you sure you want to move this client back to the previous stage?')) {
      try {
        const res = await window.api.post(`/kyc-applications/${appId}/step-back`, {});
        if (res.success) {
          alert('Client stage moved back successfully.');
          loadClients();
        } else {
          alert('Failed to step back: ' + res.message);
        }
      } catch (err) {
        alert('An error occurred.');
        console.error(err);
      }
    }
  }
};
