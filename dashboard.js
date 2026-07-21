document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('metrics-container');

  try {
    const response = await window.api.getDashboardSummary();
    const data = response.data;
    
    container.innerHTML = ''; // clear loading
    
    // Integrations to show
    const integrations = ['NSE', 'BSE', 'CVL KRA', 'CDSL', 'TechExcel'];
    
    integrations.forEach(integration => {
      const metrics = data[integration] || { total: 0, success: 0, pending: 0, rejected: 0 };
      
      const card = document.createElement('div');
      card.className = 'integration-card';
      card.innerHTML = `
        <div class="card-header">
          <h3>${integration}</h3>
          <span class="total-badge">${metrics.total} Total</span>
        </div>
        <div class="card-stats">
          <div class="stat stat-success">
            <span class="label">Success</span>
            <span class="value">${metrics.success}</span>
          </div>
          <div class="stat stat-pending">
            <span class="label">Pending</span>
            <span class="value">${metrics.pending}</span>
          </div>
          <div class="stat stat-rejected">
            <span class="label">Failed/Rejected</span>
            <span class="value">${metrics.rejected}</span>
          </div>
        </div>
        <div class="card-action">
          <a href="${integration.toLowerCase().replace(' ', '')}.html" class="view-link">View Records ➔</a>
        </div>
      `;
      container.appendChild(card);
    });

  } catch (error) {
    container.innerHTML = `<div class="error-msg">Failed to load metrics. Please try again later.</div>`;
    console.error(error);
  }
});
