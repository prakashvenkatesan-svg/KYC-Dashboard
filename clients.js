let currentPage = 1;
const limit = 20;
let totalRecords = 0;
let initialIntegration = null;

document.addEventListener('DOMContentLoaded', () => {
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
  
  if (initialIntegration) {
    // Auth & Permissions check
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
      filterDropdown.disabled = true; // Lock dropdown for dedicated pages
      filterDropdown.style.opacity = '0.7';
      filterDropdown.style.cursor = 'not-allowed';
    }
    document.getElementById('page-title').textContent = `${initialIntegration.toUpperCase()} - Client Listing`;
  }
  
  document.getElementById('search-btn').addEventListener('click', () => {
    currentPage = 1;
    loadClients();
  });
  
  document.getElementById('prev-btn').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadClients();
    }
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
  
  document.getElementById('next-btn').addEventListener('click', () => {
    if (currentPage * limit < totalRecords) {
      currentPage++;
      loadClients();
    }
  });

  // Also trigger search on enter key in search box
  document.getElementById('search-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      currentPage = 1;
      loadClients();
    }
  });

  loadClients();
});

const renderStatusBadge = (status, reason, integrationName, clientObj) => {
  const normStatus = status ? status : 'Pending';
  const badgeClass = `status-${normStatus}`;
  
  // Escape JSON string for HTML attribute
  const clientData = encodeURIComponent(JSON.stringify(clientObj));
  
  let html = `<span class="status-badge ${badgeClass}" onclick="openStatusModal(event, '${integrationName}', '${normStatus}', '${reason || ''}', '${clientData}')">${normStatus}</span>`;
  if (reason && ['Rejected', 'Failed'].includes(normStatus)) {
    html += `<span class="rejection-reason" title="${reason}">${reason}</span>`;
  }
  return html;
};

window.openStatusModal = (event, integrationName, status, reason, clientDataStr) => {
  event.stopPropagation(); // prevent row click
  const clientObj = JSON.parse(decodeURIComponent(clientDataStr));
  
  document.getElementById('modal-integration-title').textContent = `${integrationName.toUpperCase()} Status Details`;
  
  const lastUpdated = clientObj.last_updated ? new Date(clientObj.last_updated).toLocaleString() : 'N/A';
  
  document.getElementById('modal-status-body').innerHTML = `
    <p><strong>Client Code:</strong> ${clientObj.client_code || 'N/A'}</p>
    <p><strong>Client Name:</strong> ${clientObj.client_name || 'N/A'}</p>
    <p><strong>Integration:</strong> ${integrationName.toUpperCase()}</p>
    <p><strong>Current Status:</strong> <span class="status-badge status-${status}">${status}</span></p>
    ${reason ? `<p><strong>Rejection Reason / Remarks:</strong> <span style="color: #dc3545;">${reason}</span></p>` : ''}
    <p><strong>Last Updated:</strong> ${lastUpdated}</p>
  `;
  
  document.getElementById('status-modal').style.display = 'flex';
};

document.addEventListener('DOMContentLoaded', () => {
  const closeBtns = document.querySelectorAll('.close-status-modal');
  closeBtns.forEach(btn => btn.addEventListener('click', () => {
    document.getElementById('status-modal').style.display = 'none';
  }));
});

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
  
  // Toggle header visibility
  const showNse = !integrationFilter || integrationFilter === 'nse';
  const showBse = !integrationFilter || integrationFilter === 'bse';
  const showCvlkra = !integrationFilter || integrationFilter === 'cvlkra';
  const showCdsl = !integrationFilter || integrationFilter === 'cdsl';
  const showTechexcel = !integrationFilter || integrationFilter === 'techexcel';
  
  const theadNse = document.querySelector('th.col-nse');
  const theadNseReason = document.querySelector('th.col-nse-reason');
  const theadBse = document.querySelector('th.col-bse');
  const theadBseReason = document.querySelector('th.col-bse-reason');
  const theadCvlkra = document.querySelector('th.col-cvlkra');
  const theadCvlkraReason = document.querySelector('th.col-cvlkra-reason');
  const theadCdsl = document.querySelector('th.col-cdsl');
  const theadCdslReason = document.querySelector('th.col-cdsl-reason');
  const theadTechexcel = document.querySelector('th.col-techexcel');
  const theadTechexcelReason = document.querySelector('th.col-techexcel-reason');
  
  if (theadNse) theadNse.style.display = showNse ? '' : 'none';
  if (theadNseReason) theadNseReason.style.display = (integrationFilter === 'nse') ? '' : 'none';
  
  if (theadBse) theadBse.style.display = showBse ? '' : 'none';
  if (theadBseReason) theadBseReason.style.display = (integrationFilter === 'bse') ? '' : 'none';
  
  if (theadCvlkra) theadCvlkra.style.display = showCvlkra ? '' : 'none';
  if (theadCvlkraReason) theadCvlkraReason.style.display = (integrationFilter === 'cvlkra') ? '' : 'none';
  
  if (theadCdsl) theadCdsl.style.display = showCdsl ? '' : 'none';
  if (theadCdslReason) theadCdslReason.style.display = (integrationFilter === 'cdsl') ? '' : 'none';
  
  if (theadTechexcel) theadTechexcel.style.display = showTechexcel ? '' : 'none';
  if (theadTechexcelReason) theadTechexcelReason.style.display = (integrationFilter === 'techexcel') ? '' : 'none';
  
  const colCount = !integrationFilter ? 11 : 8;
  tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center;">Loading...</td></tr>`;
  
  try {
    const offset = (currentPage - 1) * limit;
    const params = {
      q: searchInput,
      limit,
      offset
    };
    
    if (integrationFilter || statusFilter || fromDate || toDate) {
      if (integrationFilter) params.integration = integrationFilter;
      if (statusFilter) params.status = statusFilter;
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
      
      tr.innerHTML = `
        <td>${appDate}</td>
        <td><strong>${client.client_code || 'N/A'}</strong></td>
        <td>${client.client_name || 'Unknown'}</td>
        <td>${client.pan_number || 'N/A'}</td>
        <td>${client.email || 'N/A'}</td>
        <td>${client.mobile_number || 'N/A'}</td>
        ${!initialIntegration ? `<td>${client.current_stage || 'Not Started'}</td>` : ''}
        ${showNse ? `<td>${renderStatusBadge(client.nse_push_status, client.nse_rejection_reason, 'NSE', client)}</td>` : ''}
        ${integrationFilter === 'nse' ? `<td style="color: #dc3545; font-size: 0.85em;">${client.nse_rejection_reason || '-'}</td>` : ''}
        ${showBse ? `<td>${renderStatusBadge(client.bse_push_status, client.bse_rejection_reason, 'BSE', client)}</td>` : ''}
        ${integrationFilter === 'bse' ? `<td style="color: #dc3545; font-size: 0.85em;">${client.bse_rejection_reason || '-'}</td>` : ''}
        ${showCvlkra ? `<td>${renderStatusBadge(client.cvlkra_sync_status, client.cvlkra_rejection_reason, 'CVL KRA', client)}</td>` : ''}
        ${integrationFilter === 'cvlkra' ? `<td style="color: #dc3545; font-size: 0.85em;">${client.cvlkra_rejection_reason || '-'}</td>` : ''}
        ${showCdsl ? `<td>${renderStatusBadge(client.cdsl_push_status, client.cdsl_rejection_reason, 'CDSL', client)}</td>` : ''}
        ${integrationFilter === 'cdsl' ? `<td style="color: #dc3545; font-size: 0.85em;">${client.cdsl_rejection_reason || '-'}</td>` : ''}
        ${showTechexcel ? `<td>${renderStatusBadge(client.techexcel_push_status, client.techexcel_rejection_reason, 'TechExcel', client)}</td>` : ''}
        ${integrationFilter === 'techexcel' ? `<td style="color: #dc3545; font-size: 0.85em;">${client.techexcel_rejection_reason || '-'}</td>` : ''}
        <td><a href="client-detail.html?code=${client.client_code}" onclick="event.stopPropagation();" style="color:var(--primary-color); text-decoration:none; font-weight:500;">Check PDF</a></td>
      `;
      
      tbody.appendChild(tr);
    });
    
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: red;">Failed to load clients</td></tr>`;
    console.error(error);
  }
};
