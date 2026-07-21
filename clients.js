let currentPage = 1;
const limit = 20;
let totalRecords = 0;

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const initialIntegration = urlParams.get('integration');
  
  if (initialIntegration) {
    document.getElementById('integration-filter').value = initialIntegration.toLowerCase();
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

const renderStatusBadge = (status, reason) => {
  const normStatus = status ? status : 'Pending';
  const badgeClass = `status-${normStatus}`;
  
  let html = `<span class="status-badge ${badgeClass}">${normStatus}</span>`;
  if (reason && ['Rejected', 'Failed'].includes(normStatus)) {
    html += `<span class="rejection-reason" title="${reason}">${reason}</span>`;
  }
  return html;
};

const loadClients = async () => {
  const tbody = document.getElementById('clients-tbody');
  const searchInput = document.getElementById('search-input').value;
  const integrationFilter = document.getElementById('integration-filter').value;
  const statusFilter = document.getElementById('status-filter').value;
  
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
    
    if (integrationFilter && statusFilter) {
      params.integration = integrationFilter;
      params.status = statusFilter;
    }
    
    // Actually, backend supports filtering even if only integration or only status is present? 
    // Wait, backend explicitly checks if (integration && status) in the controller.
    // If they select an integration but not a status, we could pass it anyway if the backend was updated, but we wrote: if (integration && status)
    
    const response = await window.api.getClients(params);
    const clients = response.data;
    totalRecords = response.pagination.total;
    
    document.getElementById('page-info').textContent = `Showing ${Math.min(offset + 1, totalRecords)} - ${Math.min(offset + limit, totalRecords)} of ${totalRecords}`;
    
    document.getElementById('prev-btn').disabled = currentPage === 1;
    document.getElementById('next-btn').disabled = currentPage * limit >= totalRecords;
    
    tbody.innerHTML = '';
    
    if (clients.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center;">No clients found</td></tr>`;
      return;
    }
    
    clients.forEach(client => {
      const tr = document.createElement('tr');
      tr.onclick = () => {
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
        ${showNse ? `<td>${renderStatusBadge(client.nse_push_status, client.nse_rejection_reason)}</td>` : ''}
        ${integrationFilter === 'nse' ? `<td style="color: #dc3545; font-size: 0.85em;">${client.nse_rejection_reason || '-'}</td>` : ''}
        ${showBse ? `<td>${renderStatusBadge(client.bse_push_status, client.bse_rejection_reason)}</td>` : ''}
        ${integrationFilter === 'bse' ? `<td style="color: #dc3545; font-size: 0.85em;">${client.bse_rejection_reason || '-'}</td>` : ''}
        ${showCvlkra ? `<td>${renderStatusBadge(client.cvlkra_sync_status, client.cvlkra_rejection_reason)}</td>` : ''}
        ${integrationFilter === 'cvlkra' ? `<td style="color: #dc3545; font-size: 0.85em;">${client.cvlkra_rejection_reason || '-'}</td>` : ''}
        ${showCdsl ? `<td>${renderStatusBadge(client.cdsl_push_status, client.cdsl_rejection_reason)}</td>` : ''}
        ${integrationFilter === 'cdsl' ? `<td style="color: #dc3545; font-size: 0.85em;">${client.cdsl_rejection_reason || '-'}</td>` : ''}
        ${showTechexcel ? `<td>${renderStatusBadge(client.techexcel_push_status, client.techexcel_rejection_reason)}</td>` : ''}
        ${integrationFilter === 'techexcel' ? `<td style="color: #dc3545; font-size: 0.85em;">${client.techexcel_rejection_reason || '-'}</td>` : ''}
      `;
      
      tbody.appendChild(tr);
    });
    
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="${colCount}" style="text-align: center; color: red;">Failed to load clients</td></tr>`;
    console.error(error);
  }
};
