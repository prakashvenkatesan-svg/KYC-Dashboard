document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const clientCode = urlParams.get('code');
  const grid = document.getElementById('integrations-grid');
  
  // Auth checks for skip payment
  const user = JSON.parse(localStorage.getItem('kyc_user') || '{}');
  const isAdmin = user.role === 'Admin';

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
    
    // Render Payment Details Card
    const payInfo = data.payment;
    if (payInfo) {
      const pCard = document.createElement('div');
      pCard.className = 'detail-card';
      
      const pStatus = payInfo.status || 'Pending';
      const capStatus = pStatus.charAt(0).toUpperCase() + pStatus.slice(1).toLowerCase();
      
      let skipBtnHtml = '';
      if (isAdmin && ['pending', 'failed'].includes(pStatus.toLowerCase())) {
        skipBtnHtml = `<button id="skip-payment-trigger" style="margin-top:16px; padding:6px 12px; background:var(--primary-color); border:none; border-radius:4px; color:white; cursor:pointer; width:100%;">Skip Payment</button>`;
      }
      
      let skipAuditHtml = '';
      if (pStatus.toLowerCase() === 'skipped') {
        const skippedDate = payInfo.skipped_at ? new Date(payInfo.skipped_at).toLocaleString() : 'N/A';
        skipAuditHtml = `
          <div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--surface-border);">
            <div class="detail-row"><span class="label">Skipped By</span><span class="value">${payInfo.skipped_by || 'Unknown'}</span></div>
            <div class="detail-row"><span class="label">Skipped At</span><span class="value">${skippedDate}</span></div>
            <div class="detail-row"><span class="label">Reason</span><span class="value" style="font-size:0.8rem;">${payInfo.skip_reason || 'N/A'}</span></div>
          </div>
        `;
      }

      pCard.innerHTML = `
        <h3>Payment (PayU) <span class="status-badge status-${capStatus}" style="float:right">${capStatus}</span></h3>
        <div class="detail-row"><span class="label">Amount</span><span class="value">₹${payInfo.amount || '0'}</span></div>
        <div class="detail-row"><span class="label">Provider</span><span class="value">${(payInfo.provider || 'N/A').toUpperCase()}</span></div>
        <div class="detail-row"><span class="label">Txn ID</span><span class="value">${payInfo.txnid || 'N/A'}</span></div>
        <div class="detail-row"><span class="label">Method</span><span class="value">${(payInfo.payment_method || 'N/A').toUpperCase()}</span></div>
        ${skipAuditHtml}
        ${skipBtnHtml}
      `;
      // Prepend the payment card so it shows first
      grid.insertBefore(pCard, grid.firstChild);
      
      // Bind skip logic
      const skipTrigger = document.getElementById('skip-payment-trigger');
      if (skipTrigger) {
        const skipModal = document.getElementById('skip-modal');
        const skipReason = document.getElementById('skip-reason');
        const confirmBtn = document.getElementById('confirm-skip-btn');
        const cancelBtn = document.getElementById('cancel-skip-btn');
        
        skipTrigger.addEventListener('click', () => {
          skipModal.style.display = 'flex';
        });
        
        cancelBtn.addEventListener('click', () => {
          skipModal.style.display = 'none';
          skipReason.value = '';
        });
        
        confirmBtn.addEventListener('click', async () => {
          const reason = skipReason.value.trim();
          if (!reason) {
            alert('Please provide a reason to skip the payment.');
            return;
          }
          
          confirmBtn.textContent = 'Processing...';
          confirmBtn.disabled = true;
          
          try {
            const token = localStorage.getItem('kyc_token');
            const res = await fetch(`/api/kyc-dashboard/clients/${clientCode}/skip-payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ skip_reason: reason })
            });
            const result = await res.json();
            
            if (result.success) {
              alert('Payment skipped successfully.');
              window.location.reload();
            } else {
              alert(result.message || 'Failed to skip payment.');
              confirmBtn.textContent = 'Confirm Skip';
              confirmBtn.disabled = false;
            }
          } catch(e) {
            alert('Server error while skipping payment.');
            confirmBtn.textContent = 'Confirm Skip';
            confirmBtn.disabled = false;
          }
        });
      }
    }

  } catch (error) {
    grid.innerHTML = '<div class="error-msg">Failed to load client details.</div>';
    console.error(error);
  }
});
