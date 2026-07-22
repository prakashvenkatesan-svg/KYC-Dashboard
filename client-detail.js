document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const clientCode = urlParams.get('code');
  const grid = document.getElementById('integrations-grid');
  
  // Auth checks for skip payment
  const user = JSON.parse(localStorage.getItem('kyc_user') || '{}');
  const isAdmin = user.role === 'Admin';

  if (!clientCode || clientCode === 'null') {
    grid.innerHTML = '<div class="error-msg">No valid client code provided.</div>';
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
      let bypassBtnHtml = '';
      
      if (isAdmin && ['pending', 'failed'].includes(pStatus.toLowerCase())) {
        skipBtnHtml = `<button id="skip-payment-trigger" style="margin-top:16px; padding:6px 12px; background:var(--primary-color); border:none; border-radius:4px; color:white; cursor:pointer; width:100%;">Skip Payment</button>`;
      }
      
      if (isAdmin && pStatus.toLowerCase() === 'success' && !payInfo.payment_bypass_allowed) {
        bypassBtnHtml = `<button id="bypass-payment-trigger" style="margin-top:16px; padding:6px 12px; background:#10B981; border:none; border-radius:4px; color:white; cursor:pointer; width:100%; font-weight:bold;">Allow Payment Bypass</button>`;
      } else if (payInfo.payment_bypass_allowed) {
        bypassBtnHtml = `<button disabled style="margin-top:16px; padding:6px 12px; background:#334155; border:none; border-radius:4px; color:#94a3b8; width:100%; cursor:not-allowed;">Payment Bypass Approved</button>`;
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
      
      let bypassAuditHtml = '';
      if (payInfo.payment_bypass_allowed) {
        const bypassDate = payInfo.payment_bypass_approved_at ? new Date(payInfo.payment_bypass_approved_at).toLocaleString() : 'N/A';
        bypassAuditHtml = `
          <div style="margin-top:12px; padding-top:12px; border-top:1px solid var(--surface-border);">
            <div class="detail-row"><span class="label" style="color:#10B981;">Journey Bypass</span><span class="value" style="color:#10B981; font-weight:bold;">Approved</span></div>
            <div class="detail-row"><span class="label">Approved By</span><span class="value">${payInfo.payment_bypass_approved_by || 'Unknown'}</span></div>
            <div class="detail-row"><span class="label">Approved At</span><span class="value">${bypassDate}</span></div>
            <div class="detail-row"><span class="label">RM Ref</span><span class="value" style="font-size:0.8rem;">${payInfo.payment_bypass_rm_confirmation || 'N/A'}</span></div>
            <div class="detail-row"><span class="label">Reason</span><span class="value" style="font-size:0.8rem;">${payInfo.payment_bypass_reason || 'N/A'}</span></div>
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
        ${bypassAuditHtml}
        ${skipBtnHtml}
        ${bypassBtnHtml}
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
          } catch (err) {
            console.error(err);
            alert('Server error while skipping payment.');
            confirmBtn.textContent = 'Confirm Skip';
            confirmBtn.disabled = false;
          }
        });
      }
      
      // Bind bypass logic
      const bypassTrigger = document.getElementById('bypass-payment-trigger');
      if (bypassTrigger) {
        const bypassModal = document.getElementById('bypass-modal');
        const bypassReason = document.getElementById('bypass-reason');
        const bypassRmRef = document.getElementById('bypass-rm-ref');
        const confirmBypassBtn = document.getElementById('confirm-bypass-btn');
        const cancelBypassBtn = document.getElementById('cancel-bypass-btn');
        
        document.getElementById('bypass-txnid').textContent = payInfo.txnid || 'N/A';
        document.getElementById('bypass-amount').textContent = payInfo.amount || '0';
        
        bypassTrigger.addEventListener('click', () => {
          bypassModal.style.display = 'flex';
        });
        
        cancelBypassBtn.addEventListener('click', () => {
          bypassModal.style.display = 'none';
          bypassReason.value = '';
          bypassRmRef.value = '';
        });
        
        confirmBypassBtn.addEventListener('click', async () => {
          const reason = bypassReason.value.trim();
          const rmRef = bypassRmRef.value.trim();
          
          if (!reason || !rmRef) {
            alert('Please provide both the RM Confirmation Reference and a Reason for bypass.');
            return;
          }
          
          confirmBypassBtn.textContent = 'Processing...';
          confirmBypassBtn.disabled = true;
          
          try {
            const token = localStorage.getItem('kyc_token');
            const res = await fetch(`/api/kyc-dashboard/clients/${clientCode}/allow-bypass`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ reason: reason, rmConfirmation: rmRef })
            });
            const result = await res.json();
            
            if (result.success) {
              alert('Payment bypass approved successfully.');
              window.location.reload();
            } else {
              alert(result.message || 'Failed to approve payment bypass.');
              confirmBypassBtn.textContent = 'Confirm and Allow Bypass';
              confirmBypassBtn.disabled = false;
            }
          } catch (err) {
            console.error(err);
            alert('Server error while approving payment bypass.');
            confirmBypassBtn.textContent = 'Confirm and Allow Bypass';
            confirmBypassBtn.disabled = false;
          }
        });
      }
    }
    
    // Render Signed KYC Document section (Placeholder)
    const pdfCard = document.createElement('div');
    pdfCard.className = 'detail-card';
    pdfCard.innerHTML = `
      <h3>Signed KYC Document</h3>
      <div style="display:flex; justify-content:center; align-items:center; height:100px;">
        <span style="color:var(--text-secondary);">Loading PDF Status...</span>
      </div>
    `;
    grid.appendChild(pdfCard);
    
    // Fetch PDF presigned URL
    try {
      const pdfRes = await fetch(`${API_BASE_URL}/clients/${clientCode}/signed-pdf`, { headers: getAuthHeaders() });
      if (pdfRes.ok) {
        const pdfData = await pdfRes.json();
        if (pdfData.success && pdfData.signedPdfUrl) {
          pdfCard.innerHTML = `
            <h3>Signed KYC Document <span class="status-badge" style="background:#10B981; float:right;">Available</span></h3>
            <div class="detail-row"><span class="label">File Name</span><span class="value">${pdfData.fileName}</span></div>
            <div style="margin-top:20px; display:flex; gap:12px;">
              <a href="${pdfData.signedPdfUrl}" target="_blank" style="flex:1; text-align:center; text-decoration:none; padding:8px 16px; border-radius:6px; background:#334155; color:white; font-size:0.9rem;">View PDF</a>
              <a href="${pdfData.signedPdfUrl}" download="${pdfData.fileName}" style="flex:1; text-align:center; text-decoration:none; padding:8px 16px; border-radius:6px; background:var(--primary-color); color:white; font-size:0.9rem;">Download PDF</a>
            </div>
          `;
        } else {
          pdfCard.innerHTML = `
            <h3>Signed KYC Document <span class="status-badge" style="background:#dc3545; float:right;">Unavailable</span></h3>
            <p style="color:var(--text-secondary); margin-top:16px; font-size:0.9rem;">Signed KYC PDF is not available for this client.</p>
          `;
        }
      } else {
        const errData = await pdfRes.json().catch(() => ({}));
        const errMsg = errData.message || 'Signed KYC PDF is not available for this client.';
        pdfCard.innerHTML = `
          <h3>Signed KYC Document <span class="status-badge" style="background:#dc3545; float:right;">Unavailable</span></h3>
          <p style="color:var(--text-secondary); margin-top:16px; font-size:0.9rem;">${errMsg}</p>
        `;
      }
    } catch (err) {
      console.error("Failed to load signed PDF:", err);
      pdfCard.innerHTML = `
        <h3>Signed KYC Document <span class="status-badge" style="background:#dc3545; float:right;">Unavailable</span></h3>
        <p style="color:var(--text-secondary); margin-top:16px; font-size:0.9rem;">Failed to retrieve PDF status.</p>
      `;
    }

    // Fetch and Render KYC Stepper
    try {
      const stepperContainer = document.getElementById('kyc-stepper');
      const progressRes = await fetch(`${API_BASE_URL}/clients/${clientCode}/kyc-progress`, { headers: getAuthHeaders() });
      
      if (progressRes.ok) {
        const progressData = await progressRes.json();
        if (progressData.success) {
          
          let stepperHtml = `<div style="margin-bottom: 24px;">
            <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 8px;">Overall Status: <strong style="color: var(--text-primary); text-transform: capitalize;">${progressData.overallStatus.replace('_', ' ')}</strong></div>
            <div style="width:100%; background:#e2e8f0; border-radius:10px; height:8px; overflow:hidden; margin-bottom:4px;">
              <div style="height:100%; background:var(--primary-color); width:${progressData.progressPercentage}%;"></div>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); text-align: right;">${progressData.progressPercentage}% Complete</div>
          </div>
          <div style="position: absolute; left: 15px; top: 75px; bottom: 20px; width: 2px; background: var(--border-color); z-index: 0;"></div>
          `;

          progressData.stages.forEach((stage, idx) => {
            const isCompleted = ['completed', 'success', 'skipped', 'bypass_approved'].includes(stage.status.toLowerCase());
            const isFailed = ['failed', 'rejected'].includes(stage.status.toLowerCase());
            const isInProgress = stage.status.toLowerCase() === 'in_progress';
            
            let iconColor = 'var(--text-secondary)';
            let iconContent = idx + 1;
            let bgColor = 'var(--bg-color)';
            let statusBadge = `<span class="status-badge" style="background:#6c757d; font-size:0.7rem; padding: 2px 6px;">${stage.status}</span>`;

            if (isCompleted) {
              iconColor = '#10B981';
              bgColor = '#ecfdf5';
              iconContent = '✓';
              statusBadge = `<span class="status-badge" style="background:#10B981; font-size:0.7rem; padding: 2px 6px;">${stage.status}</span>`;
            } else if (isFailed) {
              iconColor = '#dc3545';
              bgColor = '#fef2f2';
              iconContent = '✕';
              statusBadge = `<span class="status-badge" style="background:#dc3545; font-size:0.7rem; padding: 2px 6px;">${stage.status}</span>`;
            } else if (isInProgress) {
              iconColor = '#f59e0b';
              bgColor = '#fffbeb';
              iconContent = '○';
              statusBadge = `<span class="status-badge" style="background:#f59e0b; font-size:0.7rem; padding: 2px 6px;">${stage.status}</span>`;
            }

            const timestamp = stage.completedAt ? new Date(stage.completedAt).toLocaleString('en-GB') : (stage.lastUpdated ? new Date(stage.lastUpdated).toLocaleString('en-GB') : '');

            stepperHtml += `
              <div style="display: flex; gap: 16px; margin-bottom: 24px; position: relative; z-index: 1;">
                <div style="flex: 0 0 32px; height: 32px; border-radius: 50%; background: ${bgColor}; border: 2px solid ${iconColor}; display: flex; align-items: center; justify-content: center; font-weight: bold; color: ${iconColor}; font-size: 0.9rem;">
                  ${iconContent}
                </div>
                <div style="flex: 1; padding-top: 4px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <strong style="color: var(--text-primary); font-size: 0.95rem;">${stage.stageName}</strong>
                    ${statusBadge}
                  </div>
                  ${stage.source ? `<div style="font-size: 0.8rem; color: var(--primary-color); margin-bottom: 2px;">Source: ${stage.source}</div>` : ''}
                  ${timestamp ? `<div style="font-size: 0.75rem; color: var(--text-secondary);">${timestamp}</div>` : ''}
                  ${stage.errorMessage ? `<div style="font-size: 0.8rem; color: #dc3545; margin-top: 4px;">Error: ${stage.errorMessage}</div>` : ''}
                </div>
              </div>
            `;
          });
          
          stepperContainer.innerHTML = stepperHtml;
        } else {
          stepperContainer.innerHTML = `<div class="error-msg">Failed to load KYC journey.</div>`;
        }
      } else {
        stepperContainer.innerHTML = `<div class="error-msg">Failed to load KYC journey.</div>`;
      }
    } catch (err) {
      console.error("Failed to load KYC progress:", err);
      document.getElementById('kyc-stepper').innerHTML = `<div class="error-msg">Server error.</div>`;
    }

  } catch (error) {
    grid.innerHTML = '<div class="error-msg">Failed to load client details.</div>';
    console.error(error);
  }
});
