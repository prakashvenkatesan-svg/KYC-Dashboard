let currentPage = 1;
const limit = 20;
let totalRecords = 0;
let initialIntegration = null;
let currentSortBy = 'application_date';
let currentSortOrder = 'desc'; // 'desc', 'asc', or ''

// Define all possible columns and their properties
const ALL_COLUMNS = {
  application_date: { label: 'APPLICATION DATE', mandatory: true },
  client_code: { label: 'CLIENT CODE', mandatory: true },
  client_name: { label: 'CLIENT NAME', mandatory: true },
  pan_number: { label: 'PAN NUMBER', mandatory: false },
  email_id: { label: 'EMAIL ID', mandatory: false },
  mobile_number: { label: 'MOBILE NUMBER', mandatory: false },
  current_stage: { label: 'CURRENT STAGE', mandatory: true },
  nse: { label: 'NSE', mandatory: false },
  nse_reason: { label: 'NSE REJECTION REASON', mandatory: false },
  bse: { label: 'BSE', mandatory: false },
  bse_reason: { label: 'BSE REJECTION REASON', mandatory: false },
  cvlkra: { label: 'CVL KRA', mandatory: false },
  cvlkra_reason: { label: 'CVLKRA REJECTION REASON', mandatory: false },
  cdsl: { label: 'CDSL', mandatory: false },
  cdsl_reason: { label: 'CDSL REJECTION REASON', mandatory: false },
  techexcel: { label: 'TECHEXCEL', mandatory: false },
  techexcel_reason: { label: 'TECHEXCEL REJECTION REASON', mandatory: false },
  esign_pdf: { label: 'ESIGN PDF', mandatory: false } // The PDF check link
};

// Default visible columns and order for main clients page
const DEFAULT_VISIBLE = [
  'application_date', 'client_code', 'client_name', 'pan_number', 'email_id', 'mobile_number',
  'current_stage', 'nse', 'bse', 'cvlkra', 'cdsl', 'techexcel', 'esign_pdf'
];
const DEFAULT_ORDER = [...DEFAULT_VISIBLE];

// State for active page preferences
let visibleColumns = [];
let columnOrder = [];

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  initialIntegration = urlParams.get('integration');
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
      intName, `${intName}_reason`, 'esign_pdf'
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
  
  setupCustomizeColumnsUI();
  renderTableHeaders();
  
  document.getElementById('search-btn').addEventListener('click', () => {
    currentPage = 1;
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
    
    currentPage = 1;
    loadClients();
  });
  
  document.getElementById('prev-btn').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadClients();
    }
  });
  
  document.getElementById('next-btn').addEventListener('click', () => {
    if (currentPage * limit < totalRecords) {
      currentPage++;
      loadClients();
    }
  });

  const closeBtns = document.querySelectorAll('.close-status-modal');
  closeBtns.forEach(btn => btn.addEventListener('click', () => {
    document.getElementById('status-modal').style.display = 'none';
  }));
  
  // Initial load
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
        intName, `${intName}_reason`, 'esign_pdf'
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
     availableCols = availableCols.filter(c => c !== 'current_stage' && (!c.endsWith('_reason') || c === `${intName}_reason`) && (!['nse','bse','cvlkra','cdsl','techexcel'].includes(c) || c === intName));
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
        if (!client.client_code) {
          alert("Client details cannot be loaded because the Client Code is not yet generated.");
          return;
        }
        window.location.href = `client-detail.html?code=${client.client_code}`;
      };
      
      const appDate = client.application_date ? new Date(client.application_date).toLocaleDateString('en-GB') : 'N/A';
      
      // Render columns in the exact order specified by activeCols
      activeCols.forEach(col => {
        const td = document.createElement('td');
        
        switch (col) {
          case 'application_date': td.textContent = appDate; break;
          case 'client_code': td.innerHTML = `<strong>${client.client_code || 'N/A'}</strong>`; break;
          case 'client_name': td.textContent = client.client_name || 'Unknown'; break;
          case 'pan_number': td.textContent = client.pan_number || 'N/A'; break;
          case 'email_id': td.textContent = client.email || 'N/A'; break;
          case 'mobile_number': td.textContent = client.mobile_number || 'N/A'; break;
          case 'current_stage': td.textContent = client.current_stage || 'Not Started'; break;
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
          case 'esign_pdf': td.innerHTML = `<a href="client-detail.html?code=${client.client_code}" onclick="event.stopPropagation();" style="color:var(--primary-color); text-decoration:none; font-weight:500;">Check PDF</a>`; break;
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
