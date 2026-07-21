document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const clientCode = urlParams.get('code');
  const grid = document.getElementById('integrations-grid');

  if (!clientCode) {
    grid.innerHTML = '<div class="error-msg">No client code provided.</div>';
    return;
  }

  try {
    const response = await window.api.getClientByCode(clientCode);
    const data = response.data;

    document.getElementById('client-name').textContent = data.client_name || 'Unknown Client';
    document.getElementById('client-code-pan').innerHTML = `
      <strong>Code:</strong> ${data.client_code} &bull; 
      <strong>PAN:</strong> ${data.pan_number || 'N/A'} &bull; 
      <strong>Email:</strong> ${data.email || 'N/A'} &bull; 
      <strong>Phone:</strong> ${data.mobile_number || 'N/A'}
    `;

    grid.innerHTML = ''; // clear loading

    const integrations = [
      { key: 'nse', label: 'NSE' },
      { key: 'bse', label: 'BSE' },
      { key: 'cvlkra', label: 'CVL KRA' },
      { key: 'cdsl', label: 'CDSL' },
      { key: 'techexcel', label: 'TechExcel' }
    ];

    integrations.forEach(integ => {
      const info = data[integ.key];
      
      const card = document.createElement('div');
      card.className = 'detail-card';

      if (!info) {
        card.innerHTML = `<h3>${integ.label}</h3><p style="color:var(--text-secondary)">No record found.</p>`;
        grid.appendChild(card);
        return;
      }

      const status = info.status || 'Pending';
      const reqDate = info.request_date_time ? new Date(info.request_date_time).toLocaleString() : 'N/A';
      const resDate = info.response_date_time ? new Date(info.response_date_time).toLocaleString() : 'N/A';
      
      let reasonHtml = '';
      if (info.rejection_reason && ['Rejected', 'Failed'].includes(status)) {
        reasonHtml = `<div class="reason-box"><strong>Reason:</strong> ${info.rejection_reason}</div>`;
      }

      card.innerHTML = `
        <h3>${integ.label} <span class="status-badge status-${status}" style="float:right">${status}</span></h3>
        <div class="detail-row">
          <span class="label">API Request Time</span>
          <span class="value">${reqDate}</span>
        </div>
        <div class="detail-row">
          <span class="label">API Response Time</span>
          <span class="value">${resDate}</span>
        </div>
        <div class="detail-row">
          <span class="label">Retry Count</span>
          <span class="value">${info.retry_count || 0}</span>
        </div>
        ${reasonHtml}
      `;
      grid.appendChild(card);
    });

  } catch (error) {
    grid.innerHTML = '<div class="error-msg">Failed to load client details.</div>';
    console.error(error);
  }
});
