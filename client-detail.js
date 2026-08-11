document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const clientCode = urlParams.get('code');
  const appId = urlParams.get('id');
  
  // Auth checks for skip payment
  const user = JSON.parse(localStorage.getItem('kyc_user') || '{}');
  const isAdmin = user.role === 'Admin';

  if (!clientCode && !appId) {
    document.getElementById('modules-container').innerHTML = '<div class="error-msg">No client reference provided.</div>';
    return;
  }

  try {
    // 1. Fetch details by code or application id, then upgrade to the full payload when needed.
    let detailsData;
    let data = null;

    if (appId) {
      detailsData = await window.api.getClientById(appId);
      if (!detailsData.success) throw new Error(detailsData.message);
      data = detailsData.data || null;
    } else {
      detailsData = await window.api.getClientByCode(clientCode);
      if (!detailsData.success) throw new Error(detailsData.message);
      data = normalizeClientDetailData(detailsData.data, clientCode);

      if (!data.stages || Object.keys(data.stages).length === 0) {
        const resolvedAppId = data.application?.application_id || data.application_id || data.id;
        if (resolvedAppId) {
          const fullDetails = await window.api.getClientById(resolvedAppId);
          if (fullDetails && fullDetails.success && fullDetails.data) {
            data = mergeClientDetailData(data, fullDetails.data);
          }
        }
      }
    }

    data = normalizeClientDetailData(data, clientCode);

    const pData = data.stages?.pan_and_dob || {};
    const perData = data.stages?.personal_details || {};

    const clientName = data.application?.full_name || pData.name || perData.name || perData.client_name || data.client_name || 'Unknown Client';
    const clientPan = data.application?.pan_number || pData.temp_pan_no || pData.pan_number || data.pan_number || 'N/A';
    const clientEmail = data.application?.email || data.email || 'N/A';
    const clientPhone = data.application?.mobile_number || data.mobile_number || 'N/A';
    const clientCodeStr = data.application?.client_code || data.client_code || clientCode || 'N/A';
    const clientStageLabel = formatCurrentStage(
      data.application?.current_stage || data.current_stage,
      data.application?.kyc_status || data.kyc_status
    );

    document.getElementById('client-name').textContent = clientName;
    document.getElementById('client-code-pan').innerHTML = `
      <strong>Code:</strong> ${clientCodeStr} &bull; 
      <strong>PAN:</strong> ${clientPan} &bull; 
      <strong>Email:</strong> ${clientEmail} &bull; 
      <strong>Phone:</strong> ${clientPhone}
      ${clientStageLabel ? `<br><strong>Current Stage:</strong> ${clientStageLabel}` : ''}
    `;

    // 2. Render Modules (Accordion)
    renderModules(data.stages);

    // 3. Extract and Render Documents
    renderDocuments(data.stages);
    
    // Inject timestamps asynchronously
    fetchAndInjectStageTimestamps(clientCodeStr);

  } catch (error) {
    console.error(error);
    document.getElementById('modules-accordion').innerHTML = '<div class="error-msg" style="padding:16px;">Failed to load client details.</div>';
  }
});

function normalizeClientDetailData(rawData, fallbackCode) {
  const source = rawData && typeof rawData === 'object' ? rawData : {};
  const application = source.application && typeof source.application === 'object'
    ? { ...source.application }
    : {
        application_id: source.application_id || source.id || null,
        client_code: source.client_code || fallbackCode || 'N/A',
        full_name: source.client_name || source.full_name || 'Unknown Client',
        pan_number: source.pan_number || 'N/A',
        email: source.email || source.email_id || 'N/A',
        mobile_number: source.mobile_number || source.phone || 'N/A'
      };

  if (!application.client_code && fallbackCode) {
    application.client_code = fallbackCode;
  }

  const stages = source.stages && typeof source.stages === 'object' ? source.stages : {};

  return {
    ...source,
    application,
    stages
  };
}

function mergeClientDetailData(baseData, fullData) {
  const normalizedFull = normalizeClientDetailData(fullData, baseData?.application?.client_code);
  return {
    ...baseData,
    ...normalizedFull,
    application: {
      ...(baseData.application || {}),
      ...(normalizedFull.application || {})
    },
    stages: {
      ...(baseData.stages || {}),
      ...(normalizedFull.stages || {})
    }
  };
}

function formatCurrentStage(currentStep, kycStatus) {
  const step = String(currentStep || '').toLowerCase();
  const status = String(kycStatus || '').toLowerCase();

  if (step === 'esign' && status === 'completed') {
    return 'eSign Completed';
  }

  if (step === 'esign' && status === 'in_progress') {
    return 'eSign (In Progress)';
  }

  const formattedStep = step
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();

  const formattedStatus = status
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();

  if (!formattedStep && !formattedStatus) return 'Not Started';
  if (!formattedStatus) return formattedStep || 'Not Started';
  return `${formattedStep} (${formattedStatus})`;
}

function renderModules(stages) {
  const container = document.getElementById('modules-accordion');
  if (!container) return;
  if (!stages) {
    container.innerHTML = '<div class="error-msg" style="padding:16px;">No stage data available.</div>';
    return;
  }
  
  const stageDefs = [
    { key: 'mobile_verification', label: 'Mobile' },
    { key: 'email_verification', label: 'Email' },
    { key: 'pan_and_dob', label: 'Pan' },
    { key: 'digilocker_details', label: 'Digilocker' },
    { key: 'personal_details', label: 'Personal details' },
    { key: 'bank_details', label: 'Bank' },
    { key: 'nominee_details', label: 'Nominee' },
    { key: 'live_photo', label: 'Liveimage' },
    { key: 'signature_upload', label: 'Sign upload' },
    { key: 'scheme_details', label: 'Payment plan' },
    { key: 'payment_summary', label: 'payment_gateway' },
    { key: 'esign', label: 'Esign' }
  ];

  let html = '';
  
  stageDefs.forEach(def => {
    const stageData = stages[def.key];
    
    html += `<div class="accordion-item" style="border-bottom:1px solid var(--border-color);">
      <div class="accordion-header" style="padding:12px 16px; cursor:pointer; font-weight:500; display:flex; justify-content:space-between; align-items:center; color: var(--text-color);" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
        <span>${def.label}</span>
        <span style="font-size:0.8rem; transform: scaleY(0.7);">▼</span>
      </div>
      <div class="accordion-content" style="display:none; padding:12px 16px; background:var(--bg-color); font-size: 0.9rem;">`;
      
    if (!stageData || (Array.isArray(stageData) && stageData.length === 0)) {
      html += `<p style="color:var(--text-secondary); margin:0;">No data available</p>`;
    } else {
      html += renderStageDataRecursive(stageData, def.key);
    }
    
    html += `</div></div>`;
  });
  
  container.innerHTML = html;
}

async function fetchAndInjectStageTimestamps(clientCode) {
  try {
    if (!window.api || !window.api.get) return;
    const res = await window.api.get(`/clients/${clientCode}/stage-timestamps`);
    if (res && res.success && Array.isArray(res.data)) {
      const stageMap = {};
      // Map the backend stage codes/names to frontend accordion labels
      res.data.forEach(log => {
        // Find matching frontend key
        const labelStr = (log.stage_name || '').replace(/_/g, ' ').toLowerCase();
        let displayLabel = null;
        if (labelStr.includes('mobile')) displayLabel = 'Mobile';
        else if (labelStr.includes('email')) displayLabel = 'Email';
        else if (labelStr.includes('pan')) displayLabel = 'Pan';
        else if (labelStr.includes('digilocker')) displayLabel = 'Digilocker';
        else if (labelStr.includes('personal')) displayLabel = 'Personal details';
        else if (labelStr.includes('bank')) displayLabel = 'Bank';
        else if (labelStr.includes('nominee')) displayLabel = 'Nominee';
        else if (labelStr.includes('photo') || labelStr.includes('image')) displayLabel = 'Liveimage';
        else if (labelStr.includes('sign') && !labelStr.includes('esign')) displayLabel = 'Sign upload';
        else if (labelStr.includes('scheme') || labelStr.includes('plan')) displayLabel = 'Payment plan';
        else if (labelStr.includes('payment')) displayLabel = 'payment_gateway';
        else if (labelStr.includes('esign')) displayLabel = 'Esign';
        
        if (displayLabel) {
           stageMap[displayLabel] = log;
        }
      });

      // Inject into DOM
      const headers = document.querySelectorAll('.accordion-header span:first-child');
      headers.forEach(header => {
        const title = header.textContent.trim();
        const log = stageMap[title];
        if (log) {
           let timeStr = '';
           if (log.completed_at) {
             const dt = new Date(log.completed_at);
             timeStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${dt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: false})}`;
           } else if (log.entered_at) {
             const dt = new Date(log.entered_at);
             timeStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${dt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit', hour12: false})}`;
           }
           
           if (timeStr) {
             const accordionContent = header.closest('.accordion-header').nextElementSibling;
             if (accordionContent) {
               // Remove any "No data available" if it exists
               const noData = accordionContent.querySelector('p');
               if (noData && noData.textContent === 'No data available') {
                 noData.remove();
                 // If the content was completely empty, we might need to add the flex column gap container
                 if (!accordionContent.querySelector('div[style*="flex-direction:column"]')) {
                   accordionContent.innerHTML = `<div style="display:flex; flex-direction:column; gap:8px;"></div>`;
                 }
               }
               
               let flexContainer = accordionContent.querySelector('div[style*="flex-direction:column"]');
               if (!flexContainer) {
                 // wrap existing content
                 const existingHTML = accordionContent.innerHTML;
                 accordionContent.innerHTML = `<div style="display:flex; flex-direction:column; gap:8px;">${existingHTML}</div>`;
                 flexContainer = accordionContent.querySelector('div[style*="flex-direction:column"]');
               }

               const timestampHtml = `
               <div style="background-color:#f1f3f5; border:1px solid #e2e8f0; border-radius:6px; padding:10px 12px; position:relative;">
                 <div style="color:#64748b; font-size:0.75rem; margin-bottom:2px; text-transform:capitalize;">Stage Timestamp</div>
                 <div style="font-weight:600; font-size:0.95rem; color:#1e293b; word-break:break-all;">${timeStr}</div>
               </div>`;
               
               flexContainer.insertAdjacentHTML('afterbegin', timestampHtml);
             }
           }
        }
      });
    }
  } catch (error) {
    console.warn("Could not fetch stage timestamps:", error);
  }
}

const blacklist = ['id', 'application_id', 'otp_hash', 'expires_at', 'attempts', 'is_used', 'created_at', 'updated_at', 'request_payload', 'response_payload', 'session_id', 'verification_id', 'metadata', 'raw_response', 'email_otp_hash', 'terms_accepted', 'payment_status_code'];

function renderStageDataRecursive(data, stageKey = '') {
  if (data === null || data === undefined) return '<span style="color:var(--text-muted);">N/A</span>';
  if (typeof data !== 'object') {
     if (typeof data === 'string' && data.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
        return new Date(data).toLocaleString('en-GB');
     }
     return data;
  }
  
  if (Array.isArray(data)) {
    let html = '';
    data.forEach((item, idx) => {
      html += `<div style="margin-bottom:8px; padding-bottom:8px; border-bottom:1px dashed var(--border-color);">
                 <strong style="display:block; margin-bottom:4px;">Item ${idx + 1}</strong>
                 ${renderStageDataRecursive(item, stageKey)}
               </div>`;
    });
    return html;
  }

  let html = `<div style="display:flex; flex-direction:column; gap:8px;">`;
  for (const [k, v] of Object.entries(data)) {
     if (blacklist.includes(k.toLowerCase())) continue;
     const dKey = k.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
     
     if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
         html += `<div style="margin-top: 8px;"><strong>${dKey}</strong><div style="padding-left: 8px; border-left: 2px solid var(--border-color); margin-top: 4px;">${renderStageDataRecursive(v, stageKey)}</div></div>`;
     } else {
         const dVal = (v === null || v === '') ? 'N/A' : renderStageDataRecursive(v, stageKey);
         let finalVal = dVal;
         if (typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://'))) {
            finalVal = `<a href="${v}" target="_blank" style="color:var(--primary-color); text-decoration:underline;">View Link</a>`;
         }
         
         const editIcon = `<svg style="position:absolute; right:12px; top:12px; cursor:pointer;" onclick="window.handleEditField(this, '${stageKey}', '${k}', '${dKey}', \`${String(v).replace(/`/g, '\\`')}\`)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>`;
         html += `
         <div style="background-color:#f1f3f5; border:1px solid #e2e8f0; border-radius:6px; padding:10px 12px; position:relative;">
           <div style="color:#64748b; font-size:0.75rem; margin-bottom:2px; text-transform:capitalize;">${dKey}</div>
           <div style="font-weight:600; font-size:0.95rem; color:#1e293b; word-break:break-all;">${finalVal}</div>
           ${editIcon}
         </div>`;
     }
  }
  html += `</div>`;
  return html;
}

window.handleEditField = async (iconEl, stageKey, fieldId, fieldName, currentVal) => {
  const newVal = prompt(`Edit ${fieldName}:`, currentVal);
  if (newVal !== null && newVal !== currentVal) {
    const valContainer = iconEl.previousElementSibling;
    const oldVal = valContainer.textContent;
    valContainer.textContent = newVal;
    try {
       const urlParams = new URLSearchParams(window.location.search);
       const clientCode = urlParams.get('code');
       if (window.api && window.api.put && clientCode) {
         const response = await window.api.put(`/clients/${clientCode}/edit-field`, { stage_key: stageKey, field_key: fieldId, new_value: newVal });
         if (!response.success) {
           console.warn('Edit failed on backend, reverting.');
           valContainer.textContent = oldVal;
           alert(response.message || "Failed to update field.");
         } else {
           alert("Field updated successfully!");
         }
       }
    } catch(e) {
       console.warn('Update API fallback:', e);
       valContainer.textContent = oldVal;
       alert("Failed to update field due to server error.");
    }
  }
};

function renderDocuments(stages) {
  const container = document.getElementById('documents-list');
  if (!container || !stages) return;

  const documents = [];

  function extractUrls(obj, path = '') {
    if (!obj) return;
    
    // Auto-convert known path fields into S3 URLs
    if (typeof obj === 'object') {
       const s3Base = 'https://aionion-kyc-staging-documents.s3.ap-south-1.amazonaws.com/clients';
       for (const [k, v] of Object.entries(obj)) {
          if (k === 'file_path' && typeof v === 'string' && v.includes('/uploads/')) {
             const url = v.startsWith('/') ? s3Base + v : s3Base + '/' + v;
             let docName = path || 'Document';
             docName = docName.replace(/_/g, ' ').replace(/(?:^|\s)\S/g, a => a.toUpperCase());
             documents.push({ name: docName, url: url });
          }
       }
    }

    if (typeof obj === 'string' && (obj.startsWith('http://') || obj.startsWith('https://'))) {
       let docName = path || 'Document';
       docName = docName.replace(/_/g, ' ').replace(/(?:^|\s)\S/g, a => a.toUpperCase());
       documents.push({ name: docName, url: obj });
    } else if (typeof obj === 'object') {
       for (const [k, v] of Object.entries(obj)) {
          let childPath = path ? `${path} ${k}` : k;
          if (k.toLowerCase().includes('url') || k.toLowerCase().includes('document') || k.toLowerCase().includes('file') || k.toLowerCase().includes('image')) {
             extractUrls(v, k);
          } else {
             extractUrls(v, k); 
          }
       }
    }
  }

  extractUrls(stages);

  const explicitDocs = [];
  const s3Base = 'https://aionion-kyc-staging-documents.s3.ap-south-1.amazonaws.com/clients';
  
  const getS3Url = (pathOrUrl) => {
      if (!pathOrUrl) return null;
      if (pathOrUrl.startsWith('http')) return pathOrUrl;
      return pathOrUrl.startsWith('/') ? s3Base + pathOrUrl : s3Base + '/' + pathOrUrl;
  };

  if (stages.pan_and_dob?.upload?.s3_url || stages.pan_and_dob?.file_path) {
      explicitDocs.push({ name: 'Uploadpan', url: getS3Url(stages.pan_and_dob.upload?.s3_url || stages.pan_and_dob.file_path) });
  }
  if (stages.live_photo?.s3_url || stages.live_photo?.file_path) {
      explicitDocs.push({ name: 'Clientimage', url: getS3Url(stages.live_photo.s3_url || stages.live_photo.file_path) });
  }
  if (stages.signature_upload?.s3_url || stages.signature_upload?.file_path) {
      explicitDocs.push({ name: 'Signature upload', url: getS3Url(stages.signature_upload.s3_url || stages.signature_upload.file_path) });
  }
  if (stages.esign?.audit_log?.document_url) {
      explicitDocs.push({ name: 'Esigned pdf', url: getS3Url(stages.esign.audit_log.document_url) });
  }
  if (stages.esign?.application_info?.signed_pdf_url) {
      explicitDocs.push({ name: 'Esigned pdf (Legacy)', url: getS3Url(stages.esign.application_info.signed_pdf_url) });
  }
  
  if (stages.nominee_details && Array.isArray(stages.nominee_details)) {
      stages.nominee_details.forEach((n, idx) => {
          if (n.proof_file_url || n.file_path) {
              explicitDocs.push({ name: `Nominee ${idx+1} upload`, url: getS3Url(n.proof_file_url || n.file_path) });
          }
      });
  }

  const finalDocs = [...explicitDocs];
  documents.forEach(d => {
     if (!finalDocs.find(fd => fd.url === d.url)) {
         finalDocs.push({ name: d.name, url: d.url });
     }
  });

  if (finalDocs.length === 0) {
    container.innerHTML = '<div style="padding:16px; color:var(--text-secondary); text-align:center;">No documents found.</div>';
    return;
  }

  let html = '';
  finalDocs.forEach((doc, idx) => {
     html += `
       <div class="document-item" onclick="previewDocument('${doc.url}', '${doc.name}')" style="padding: 10px 16px; cursor: pointer; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; color: var(--primary-color);">
         <span style="font-size: 0.95rem;">${doc.name}</span>
         <span style="color: var(--text-muted); font-size: 1.1rem; transform: rotate(45deg);">📌</span>
       </div>
     `;
  });
  
  container.innerHTML = html;

  if (finalDocs.length > 0) {
     previewDocument(finalDocs[0].url, finalDocs[0].name);
  }
}

window.currentZoom = 1;
window.currentRotation = 0;

window.updateImageTransform = () => {
  const img = document.getElementById('preview-image');
  if (img) {
    img.style.transform = `scale(${window.currentZoom}) rotate(${window.currentRotation}deg)`;
  }
};

window.zoomImage = (amount) => {
  window.currentZoom += amount;
  if (window.currentZoom < 0.2) window.currentZoom = 0.2;
  window.updateImageTransform();
};

window.rotateImage = () => {
  window.currentRotation += 90;
  window.updateImageTransform();
};

window.resetZoom = () => {
  window.currentZoom = 1;
  window.currentRotation = 0;
  window.updateImageTransform();
};

window.previewDocument = (url, title) => {
  const previewTitle = document.getElementById('preview-title');
  const previewPane = document.getElementById('preview-pane');
  
  if (previewTitle) previewTitle.textContent = title;
  
  if (!previewPane) return;

  // Reset state on new document
  window.currentZoom = 1;
  window.currentRotation = 0;

  // Presigned URLs contain query params (?X-Amz-...), so we strip them to check the extension
  const urlWithoutParams = url.split('?')[0];
  const lowerUrl = urlWithoutParams.toLowerCase();
  
  if (lowerUrl.endsWith('.pdf')) {
     previewPane.innerHTML = `<iframe src="${url}" style="width:100%; height:100%; border:none;"></iframe>`;
  } else if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg') || lowerUrl.endsWith('.png') || lowerUrl.endsWith('.gif')) {
     previewPane.innerHTML = `
     <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:auto; position:relative; background-color: var(--bg-color);">
       <img id="preview-image" src="${url}" style="max-width:100%; max-height:100%; object-fit:contain; transition: transform 0.2s ease-out; transform-origin: center center;" alt="${title}" />
       <div style="position:absolute; bottom:20px; left:50%; transform:translateX(-50%); display:flex; gap:16px; background:rgba(0,0,0,0.7); padding:10px 20px; border-radius:30px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); z-index: 10;">
         <button onclick="zoomImage(-0.2)" style="background:none; border:none; color:white; cursor:pointer; font-size:22px; display:flex; align-items:center; justify-content:center; width:30px; height:30px;" title="Zoom Out">−</button>
         <button onclick="resetZoom()" style="background:none; border:none; color:white; cursor:pointer; font-size:20px; display:flex; align-items:center; justify-content:center; width:30px; height:30px;" title="Reset">↺</button>
         <button onclick="zoomImage(0.2)" style="background:none; border:none; color:white; cursor:pointer; font-size:22px; display:flex; align-items:center; justify-content:center; width:30px; height:30px;" title="Zoom In">+</button>
         <div style="width:1px; background:rgba(255,255,255,0.3); margin:0 4px;"></div>
         <button onclick="rotateImage()" style="background:none; border:none; color:white; cursor:pointer; font-size:20px; display:flex; align-items:center; justify-content:center; width:30px; height:30px;" title="Rotate Right">↻</button>
       </div>
     </div>`;
  } else {
     previewPane.innerHTML = `<iframe src="${url}" style="width:100%; height:100%; border:none;"></iframe>`;
  }
};
