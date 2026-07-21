let currentPage = 1;
const limit = 20;
let totalRecords = 0;

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const initialIntegration = urlParams.get('integration');
  
  if (initialIntegration) {
    document.getElementById('integration-filter').value = initialIntegration.toLowerCase();
    document.getElementById('page-title').textContent = \`\${initialIntegration.toUpperCase()} - Client Listing\`;
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
  const badgeClass = \`status-\${normStatus}\`;
  
  let html = \`<span class="status-badge \${badgeClass}">\${normStatus}</span>\`;
  if (reason && ['Rejected', 'Failed'].includes(normStatus)) {
    html += \`<span class="rejection-reason" title="\${reason}">\${reason}</span>\`;
  }
  return html;
};

const loadClients = async () => {
  const tbody = document.getElementById('clients-tbody');
  const searchInput = document.getElementById('search-input').value;
  const integrationFilter = document.getElementById('integration-filter').value;
  const statusFilter = document.getElementById('status-filter').value;
  
  tbody.innerHTML = '<tr><td colspan="10" style="text-align: center;">Loading...</td></tr>';
  
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
    
    document.getElementById('page-info').textContent = \`Showing \${Math.min(offset + 1, totalRecords)} - \${Math.min(offset + limit, totalRecords)} of \${totalRecords}\`;
    
    document.getElementById('prev-btn').disabled = currentPage === 1;
    document.getElementById('next-btn').disabled = currentPage * limit >= totalRecords;
    
    tbody.innerHTML = '';
    
    if (clients.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align: center;">No clients found</td></tr>';
      return;
    }
    
    clients.forEach(client => {
      const tr = document.createElement('tr');
      tr.onclick = () => {
        window.location.href = `client-detail.html?code=${client.client_code}`;
      };
      
      tr.innerHTML = `
        <td><strong>${client.client_code || 'N/A'}</strong></td>
        <td>${client.client_name || 'Unknown'}</td>
        <td>${client.pan_number || 'N/A'}</td>
        <td>${client.email || 'N/A'}</td>
        <td>${client.mobile_number || 'N/A'}</td>
        <td>${renderStatusBadge(client.nse_push_status, client.nse_rejection_reason)}</td>
        <td>${renderStatusBadge(client.bse_push_status, client.bse_rejection_reason)}</td>
        <td>${renderStatusBadge(client.cvlkra_sync_status, client.cvlkra_rejection_reason)}</td>
        <td>${renderStatusBadge(client.cdsl_push_status, client.cdsl_rejection_reason)}</td>
        <td>${renderStatusBadge(client.techexcel_push_status, client.techexcel_rejection_reason)}</td>
      `;
      
      tbody.appendChild(tr);
    });
    
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: red;">Failed to load clients</td></tr>`;
    console.error(error);
  }
};
