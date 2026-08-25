import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import api from '../api';

const blacklist = ['id', 'application_id', 'otp_hash', 'expires_at', 'attempts', 'is_used', 'created_at', 'updated_at', 'request_payload', 'response_payload', 'session_id', 'verification_id', 'metadata', 'raw_response', 'email_otp_hash', 'terms_accepted', 'payment_status_code'];

const formatCurrentStage = (currentStep, kycStatus) => {
  const step = String(currentStep || '').toLowerCase();
  const status = String(kycStatus || '').toLowerCase();
  if (step === 'esign' && status === 'completed') return 'eSign Completed';
  if (step === 'esign' && status === 'in_progress') return 'eSign (In Progress)';
  const fStep = step.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
  const fStatus = status.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
  if (!fStep && !fStatus) return 'Not Started';
  if (!fStatus) return fStep || 'Not Started';
  return `${fStep} (${fStatus})`;
};

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('kyc_user') || '{}');
  } catch (e) {
    return {};
  }
};

const isAdminUser = (user) => String(user?.role || '').toLowerCase().includes('admin');

const EditIcon = ({ onClick }) => (
  <svg style={{ position: 'absolute', right: 12, top: 12, cursor: 'pointer' }} onClick={onClick} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
  </svg>
);

const StageDataValue = ({ stageKey, fieldKey, fieldLabel, initialValue, onEdit }) => {
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(initialValue);
  
  const handleEditClick = () => {
    setEditValue(value);
    setIsEditing(true);
    window.hasUnsavedChanges = true;
  };

  const handleSave = async () => {
    if (editValue !== value) {
      const oldVal = value;
      setValue(editValue);
      setIsEditing(false);
      window.hasUnsavedChanges = false;
      try {
        await onEdit(stageKey, fieldKey, editValue, oldVal, () => setValue(oldVal));
      } catch (e) {
        setValue(oldVal);
      }
    } else {
      setIsEditing(false);
      window.hasUnsavedChanges = false;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(value);
      window.hasUnsavedChanges = false;
    }
  };

  let displayValue = value;
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
    displayValue = new Date(value).toLocaleString('en-GB');
  } else if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
    displayValue = <a href={value} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}>View Link</a>;
  }

  if (isEditing) {
    return (
      <div style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--primary-color)', borderRadius: 6, padding: '8px 10px', position: 'relative', boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.2)' }}>
        <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: 2, textTransform: 'capitalize' }}>{fieldLabel}</div>
        <input 
          type="text" 
          value={editValue} 
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          style={{ width: '90%', border: 'none', outline: 'none', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', background: 'transparent' }}
        />
        <EditIcon onClick={handleSave} />
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '10px 12px', position: 'relative' }}>
      <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: 2, textTransform: 'capitalize' }}>{fieldLabel}</div>
      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{displayValue}</div>
      <EditIcon onClick={handleEditClick} />
    </div>
  );
};

const StageDataRecursive = ({ data, stageKey, onEdit }) => {
  if (data === null || data === undefined) return <span style={{ color: 'var(--text-muted)' }}>N/A</span>;
  if (typeof data !== 'object') {
    if (typeof data === 'string' && data.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      return new Date(data).toLocaleString('en-GB');
    }
    return String(data);
  }
  
  if (Array.isArray(data)) {
    return (
      <>
        {data.map((item, idx) => (
          <div key={idx} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px dashed var(--border-color)' }}>
            <strong style={{ display: 'block', marginBottom: 4 }}>Item {idx + 1}</strong>
            <StageDataRecursive data={item} stageKey={stageKey} onEdit={onEdit} />
          </div>
        ))}
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Object.entries(data).map(([k, v]) => {
        if (blacklist.includes(k.toLowerCase())) return null;
        const dKey = k.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        
        if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
          return (
            <div key={k} style={{ marginTop: 8 }}>
              <strong>{dKey}</strong>
              <div style={{ paddingLeft: 8, borderLeft: '2px solid var(--border-color)', marginTop: 4 }}>
                <StageDataRecursive data={v} stageKey={stageKey} onEdit={onEdit} />
              </div>
            </div>
          );
        }
        
        return <StageDataValue key={k} stageKey={stageKey} fieldKey={k} fieldLabel={dKey} initialValue={v === null || v === '' ? 'N/A' : v} onEdit={onEdit} />;
      })}
    </div>
  );
};

const AccordionItem = ({ title, stageData, stageKey, timestamp, onEdit }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  let timeStr = null;
  if (timestamp) {
    const dt = new Date(timestamp.completed_at || timestamp.entered_at);
    timeStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${dt.toLocaleTimeString('en-GB')}`;
  }

  return (
    <div className="accordion-item" style={{ borderBottom: '1px solid var(--border-color)' }}>
      <div className="accordion-header" onClick={() => setIsOpen(!isOpen)} style={{ padding: '12px 16px', cursor: 'pointer', fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-color)' }}>
        <span>{title}</span>
        <span style={{ fontSize: '0.8rem', transform: isOpen ? 'scaleY(0.7) rotate(180deg)' : 'scaleY(0.7)' }}>▼</span>
      </div>
      {isOpen && (
        <div className="accordion-content" style={{ padding: '12px 16px', background: 'var(--bg-color)', fontSize: '0.9rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {timeStr && (
              <div style={{ backgroundColor: '#f1f3f5', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 12px', position: 'relative' }}>
                <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: 2, textTransform: 'capitalize' }}>Stage Timestamp</div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b', wordBreak: 'break-all' }}>{timeStr}</div>
              </div>
            )}
            {!stageData || (Array.isArray(stageData) && stageData.length === 0) ? (
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No data available</p>
            ) : (
              <StageDataRecursive data={stageData} stageKey={stageKey} onEdit={onEdit} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function ClientDetail() {
  const { id } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const clientCode = searchParams.get('code') || id; // handle both id and code from URL or router params

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timestamps, setTimestamps] = useState({});
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [adminActionLoading, setAdminActionLoading] = useState('');
  const [adminActionResult, setAdminActionResult] = useState(null);
  const [nameEditorOpen, setNameEditorOpen] = useState(false);
  const [applicantNameInput, setApplicantNameInput] = useState('');
  
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let detailsData;
        let cData = null;
        if (clientCode && (clientCode.startsWith('APP-') || /^\d+$/.test(clientCode))) {
          detailsData = await api.getClientById(clientCode);
        } else {
          detailsData = await api.getClientByCode(clientCode);
        }
        
        if (!detailsData.success) throw new Error(detailsData.message);
        cData = detailsData.data || null;

        // If data lacks full stages, attempt to load full application
        if (cData && (!cData.stages || Object.keys(cData.stages).length === 0)) {
          const resolvedAppId = cData.application?.application_id || cData.application_id || cData.id;
          if (resolvedAppId) {
            const fullDetails = await api.getClientById(resolvedAppId);
            if (fullDetails?.success && fullDetails.data) {
              cData = { ...cData, ...fullDetails.data, stages: { ...(cData.stages||{}), ...(fullDetails.data.stages||{}) }, application: { ...(cData.application||{}), ...(fullDetails.data.application||{}) } };
            }
          }
        }
        setData(cData);
        extractDocuments(cData?.stages);
        
        // Fetch timestamps
        const resolvedCode = cData?.application?.client_code || cData?.client_code || clientCode;
        if (resolvedCode) {
          const res = await api.get(`/clients/${resolvedCode}/stage-timestamps`);
          if (res?.success && Array.isArray(res.data)) {
            const tMap = {};
            res.data.forEach(log => {
              const labelStr = (log.stage_name || '').replace(/_/g, ' ').toLowerCase();
              if (labelStr.includes('mobile')) tMap['Mobile'] = log;
              else if (labelStr.includes('email')) tMap['Email'] = log;
              else if (labelStr.includes('pan')) tMap['Pan'] = log;
              else if (labelStr.includes('digilocker')) tMap['Digilocker'] = log;
              else if (labelStr.includes('personal')) tMap['Personal details'] = log;
              else if (labelStr.includes('bank')) tMap['Bank'] = log;
              else if (labelStr.includes('nominee')) tMap['Nominee'] = log;
              else if (labelStr.includes('photo') || labelStr.includes('image')) tMap['Liveimage'] = log;
              else if (labelStr.includes('sign') && !labelStr.includes('esign')) tMap['Sign upload'] = log;
              else if (labelStr.includes('scheme') || labelStr.includes('plan')) tMap['Payment plan'] = log;
              else if (labelStr.includes('payment')) tMap['payment_gateway'] = log;
              else if (labelStr.includes('esign')) tMap['Esign'] = log;
            });
            setTimestamps(tMap);
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (clientCode) fetchData();
  }, [clientCode]);

  const extractDocuments = (stages) => {
    if (!stages) return;
    const s3Base = 'https://aionion-kyc-staging-documents.s3.ap-south-1.amazonaws.com/clients';
    
    const extractedDocs = [];
    
    const extractUrls = (obj, path = '') => {
      if (!obj) return;
      
      if (typeof obj === 'object' && !Array.isArray(obj)) {
        for (const [k, v] of Object.entries(obj)) {
          if (k === 'file_path' && typeof v === 'string' && v.includes('/uploads/')) {
            const url = v.startsWith('/') ? s3Base + v : s3Base + '/' + v;
            let docName = path || 'Document';
            docName = docName.replace(/_/g, ' ').replace(/(?:^|\s)\S/g, a => a.toUpperCase());
            extractedDocs.push({ name: docName, url: url });
          }
        }
      }

      if (typeof obj === 'string' && (obj.startsWith('http://') || obj.startsWith('https://'))) {
        let docName = path || 'Document';
        docName = docName.replace(/_/g, ' ').replace(/(?:^|\s)\S/g, a => a.toUpperCase());
        extractedDocs.push({ name: docName, url: obj });
      } else if (typeof obj === 'object') {
        for (const [k, v] of Object.entries(obj)) {
          extractUrls(v, k);
        }
      }
    };
    
    extractUrls(stages);
    
    const explicitDocs = [];
    const getS3Url = (pathOrUrl) => {
        if (!pathOrUrl) return null;
        if (pathOrUrl.startsWith('http')) return pathOrUrl;
        return pathOrUrl.startsWith('/') ? s3Base + pathOrUrl : s3Base + '/' + pathOrUrl;
    };

    if (stages.pan_and_dob?.upload?.s3_url || stages.pan_and_dob?.file_path) explicitDocs.push({ name: 'Uploadpan', url: getS3Url(stages.pan_and_dob.upload?.s3_url || stages.pan_and_dob.file_path) });
    if (stages.live_photo?.s3_url || stages.live_photo?.file_path) explicitDocs.push({ name: 'Clientimage', url: getS3Url(stages.live_photo.s3_url || stages.live_photo.file_path) });
    if (stages.signature_upload?.s3_url || stages.signature_upload?.file_path) explicitDocs.push({ name: 'Signature upload', url: getS3Url(stages.signature_upload.s3_url || stages.signature_upload.file_path) });
    if (stages.esign?.audit_log?.document_url) explicitDocs.push({ name: 'Esigned pdf', url: getS3Url(stages.esign.audit_log.document_url) });
    if (stages.esign?.application_info?.signed_pdf_url) explicitDocs.push({ name: 'Esigned pdf (Legacy)', url: getS3Url(stages.esign.application_info.signed_pdf_url) });
    
    if (stages.nominee_details && Array.isArray(stages.nominee_details)) {
        stages.nominee_details.forEach((n, idx) => {
            if (n.proof_file_url || n.file_path) explicitDocs.push({ name: `Nominee ${idx+1} upload`, url: getS3Url(n.proof_file_url || n.file_path) });
        });
    }

    const finalDocs = [...explicitDocs];
    extractedDocs.forEach(d => {
       if (!finalDocs.find(fd => fd.url === d.url)) {
           finalDocs.push({ name: d.name, url: d.url });
       }
    });

    setDocuments(finalDocs);
    if (finalDocs.length > 0) setSelectedDoc(finalDocs[0]);
  };

  const handleEdit = async (stageKey, fieldKey, newVal, oldVal, revert) => {
    try {
      const res = await api.put(`/clients/${clientCode}/edit-field`, { stage_key: stageKey, field_key: fieldKey, new_value: newVal });
      if (!res.success) {
        alert(res.message || "Failed to update field.");
        revert();
      } else {
        alert("Field updated successfully!");
      }
    } catch (e) {
      alert("Failed to update field due to server error.");
      revert();
      throw e;
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading client details...</div>;
  if (error || !data) return <div className="error-msg" style={{ padding: 16 }}>Failed to load client details: {error}</div>;

  const pData = data.stages?.pan_and_dob || {};
  const perData = data.stages?.personal_details || {};
  const clientName = data.application?.full_name || pData.name || perData.name || perData.client_name || data.client_name || 'Unknown Client';
  const clientPan = data.application?.pan_number || pData.temp_pan_no || pData.pan_number || data.pan_number || 'N/A';
  const clientEmail = data.application?.email || data.email || 'N/A';
  const clientPhone = data.application?.mobile_number || data.mobile_number || 'N/A';
  const clientCodeStr = data.application?.client_code || data.client_code || clientCode || 'N/A';
  const clientStageLabel = formatCurrentStage(data.application?.current_stage || data.current_stage, data.application?.kyc_status || data.kyc_status);
  const applicationId = data.application?.application_id || data.application?.id || data.application_id || data.id || (/^\d+$/.test(String(clientCode || '')) ? clientCode : null);
  const adminUser = getStoredUser();
  const canUseAdminJourneyActions = isAdminUser(adminUser) && applicationId;

  const handleAdminJourneyAction = async (action) => {
    if (!applicationId) return;

    const cleanPan = clientPan && clientPan !== 'N/A' ? String(clientPan).trim().toUpperCase() : '';
    const confirmed = window.confirm(action.confirmText(applicationId, cleanPan));
    if (!confirmed) return;

    const numericApplicationId = Number(applicationId);

    setAdminActionLoading(action.key);
    setAdminActionResult(null);
    try {
      const result = await api.post(action.endpoint(numericApplicationId), {
        application_id: numericApplicationId,
        client_code: clientCodeStr !== 'N/A' ? clientCodeStr : undefined,
        pan: cleanPan || undefined,
        remarks: action.remarks,
        user_name: adminUser?.username || adminUser?.email || 'Admin',
        user_role: adminUser?.role || 'Admin'
      });
      if (result?.success === false) {
        const error = new Error(result?.message || `${action.label} failed.`);
        error.payload = result;
        throw error;
      }
      setAdminActionResult({ success: true, data: result });
      if (action.nextState) {
        setData(prev => {
          if (!prev) return prev;
          const updated = result?.data || {};
          const nextStep = updated.current_step || action.nextState.current_step;
          const nextKycStatus = updated.kyc_status || action.nextState.kyc_status;
          const nextIsCompleted = typeof updated.is_completed === 'boolean' ? updated.is_completed : action.nextState.is_completed;
          const nextEsignStatus = updated.esign_status || action.nextState.esign_status;
          return {
            ...prev,
            application: {
              ...(prev.application || {}),
              current_step: nextStep,
              current_stage: nextStep,
              kyc_status: nextKycStatus,
              is_completed: nextIsCompleted,
              ...(nextEsignStatus ? { esign_status: nextEsignStatus } : {})
            },
            stages: action.clearLivePhoto
              ? {
                  ...(prev.stages || {}),
                  live_photo: null
                }
              : prev.stages,
            current_stage: nextStep,
            kyc_status: nextKycStatus
          };
        });
      }
    } catch (err) {
      setAdminActionResult({
        success: false,
        data: err.payload || { message: err.message || `${action.label} failed.` }
      });
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleApplicantNameUpdate = async (event) => {
    event.preventDefault();
    if (!applicationId) return;

    const cleanPan = clientPan && clientPan !== 'N/A' ? String(clientPan).trim().toUpperCase() : '';
    const newName = String(applicantNameInput || '').replace(/\s+/g, ' ').trim().toUpperCase();
    const currentName = String(clientName || '').replace(/\s+/g, ' ').trim().toUpperCase();
    if (newName.length < 2) {
      setAdminActionResult({ success: false, data: { message: 'Enter the complete corrected applicant name.' } });
      return;
    }
    if (newName === currentName) {
      setAdminActionResult({ success: false, data: { message: 'The new name is the same as the current name.' } });
      return;
    }

    const confirmed = window.confirm(
      `Change applicant name for application ${applicationId}${cleanPan ? ` / ${cleanPan}` : ''}?\n\n` +
      `Current: ${currentName}\nNew: ${newName}\n\n` +
      'This updates application-scoped database rows only. It does not change the signed PDF or records already submitted to external integrations.'
    );
    if (!confirmed) return;

    const numericApplicationId = Number(applicationId);
    setAdminActionLoading('update-applicant-name');
    setAdminActionResult(null);
    try {
      const result = await api.post(`/kyc-applications/${numericApplicationId}/applicant-name`, {
        new_name: newName,
        expected_current_name: currentName,
        expected_pan: cleanPan || undefined,
        user_name: adminUser?.username || adminUser?.email || 'Admin'
      });
      if (result?.success === false) {
        const updateError = new Error(result?.message || 'Applicant name update failed.');
        updateError.payload = result;
        throw updateError;
      }

      setAdminActionResult({ success: true, data: result });
      setApplicantNameInput(newName);
      setNameEditorOpen(false);

      try {
        const refreshed = await api.getClientById(numericApplicationId);
        if (refreshed?.success && refreshed.data) {
          setData(refreshed.data);
          extractDocuments(refreshed.data.stages);
        }
      } catch (refreshError) {
        console.warn('Applicant name saved, but client details could not be refreshed:', refreshError);
      }
    } catch (updateError) {
      setAdminActionResult({
        success: false,
        data: updateError.payload || { message: updateError.message || 'Applicant name update failed.' }
      });
    } finally {
      setAdminActionLoading('');
    }
  };

  const adminJourneyActions = [
    {
      key: 'reopen-digilocker',
      label: 'Reopen at DigiLocker',
      buttonLabel: 'Reopen DigiLocker',
      loadingLabel: 'Reopening...',
      endpoint: (appId) => `/kyc-applications/${appId}/reopen-digilocker`,
      remarks: 'Reopened at DigiLocker from dashboard detail page',
      nextState: { current_step: 'digilocker_details', kyc_status: 'in_progress', is_completed: false },
      confirmText: (appId, pan) => `Reopen application ${appId}${pan ? ` / ${pan}` : ''} at DigiLocker? The client will need to act again.`,
      background: '#f59e0b',
      loadingBackground: '#fcd34d'
    },
    {
      key: 'reopen-live-photo',
      label: 'Reopen Live Photo',
      buttonLabel: 'Reopen Live Photo',
      loadingLabel: 'Reopening...',
      endpoint: (appId) => `/kyc-applications/${appId}/reopen-live-photo`,
      remarks: 'Reopened at live photo and removed existing photo from dashboard detail page',
      nextState: { current_step: 'live_photo', kyc_status: 'in_progress', is_completed: false, esign_status: 'pending' },
      confirmText: (appId, pan) => `Reopen application ${appId}${pan ? ` / ${pan}` : ''} at Live Photo? This removes the existing live photo and resets eSign to pending.`,
      background: '#dc2626',
      loadingBackground: '#fca5a5',
      clearLivePhoto: true
    },
    {
      key: 'move-esign',
      label: 'Move to eSign',
      buttonLabel: 'Move to eSign',
      loadingLabel: 'Moving...',
      endpoint: (appId) => `/kyc-applications/${appId}/move-esign`,
      remarks: 'Moved to eSign from dashboard detail page',
      nextState: { current_step: 'esign', kyc_status: 'in_progress', is_completed: false, esign_status: 'pending' },
      confirmText: (appId, pan) => `Move application ${appId}${pan ? ` / ${pan}` : ''} to eSign? eSign status will be set to pending.`,
      background: '#2563eb',
      loadingBackground: '#93c5fd'
    },
    {
      key: 'mark-completed',
      label: 'Mark Completed',
      buttonLabel: 'Mark Completed',
      loadingLabel: 'Marking...',
      endpoint: (appId) => `/kyc-applications/${appId}/complete`,
      remarks: 'Marked completed from dashboard detail page',
      nextState: { current_step: 'completed', kyc_status: 'completed', is_completed: true },
      confirmText: (appId, pan) => `Mark application ${appId}${pan ? ` / ${pan}` : ''} as completed? This will not run orchestrator or integrations.`,
      background: '#16a34a',
      loadingBackground: '#86efac'
    },
    {
      key: 'repopulate-tables',
      label: 'Re-populate Tables',
      buttonLabel: 'Re-populate Tables',
      loadingLabel: 'Re-populating...',
      endpoint: (appId) => `/kyc-applications/${appId}/repopulate-tables`,
      remarks: 'Re-populated downstream tables from dashboard detail page',
      confirmText: (appId, pan) => `Re-populate downstream integration tables for application ${appId}${pan ? ` / ${pan}` : ''}? This does not push to CDSL, NSE, BSE, TechExcel, or KRA.`,
      background: '#7c3aed',
      loadingBackground: '#c4b5fd'
    }
  ];

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

  const renderDocumentPreview = () => {
    if (!selectedDoc) return <div style={{ padding: 20 }}>No document selected</div>;
    const lowerUrl = selectedDoc.url.split('?')[0].toLowerCase();
    
    if (lowerUrl.endsWith('.pdf')) {
      const pdfUrl = selectedDoc.url.includes('#') ? selectedDoc.url : `${selectedDoc.url}#view=FitH`;
      return <iframe src={pdfUrl} style={{ width: '100%', height: '100%', border: 'none' }} title={selectedDoc.name} />;
    }
    if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg') || lowerUrl.endsWith('.png') || lowerUrl.endsWith('.gif')) {
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
          <img src={selectedDoc.url} alt={selectedDoc.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', transition: 'transform 0.2s ease-out', transform: `scale(${zoom}) rotate(${rotation}deg)` }} />
          
          <div style={{ position: 'absolute', bottom: 20, right: 20, display: 'flex', gap: 12, alignItems: 'center', background: '#ffffff', padding: '6px 16px', borderRadius: '30px', zIndex: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
            <button onClick={() => setZoom(z => Math.max(0.2, z - 0.2))} style={{ background: 'none', border: 'none', color: '#0f172a', cursor: 'pointer', fontSize: 16, padding: '0 4px', display: 'flex', alignItems: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
            </button>
            <button onClick={() => setZoom(z => z + 0.2)} style={{ background: 'none', border: 'none', color: '#0f172a', cursor: 'pointer', fontSize: 16, padding: '0 4px', display: 'flex', alignItems: 'center' }}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
            </button>
            <button onClick={() => setRotation(r => r - 90)} style={{ background: 'none', border: 'none', color: '#0f172a', cursor: 'pointer', fontSize: 16, padding: '0 4px', display: 'flex', alignItems: 'center' }}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
            </button>
            <button onClick={() => setRotation(r => r + 90)} style={{ background: 'none', border: 'none', color: '#0f172a', cursor: 'pointer', fontSize: 16, padding: '0 4px', display: 'flex', alignItems: 'center' }}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path></svg>
            </button>
            <button onClick={() => { setZoom(1); setRotation(0); }} style={{ background: 'none', border: 'none', color: '#0f172a', cursor: 'pointer', fontSize: 16, padding: '0 4px', display: 'flex', alignItems: 'center' }}>
               <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
            </button>
            <span style={{ display: 'flex', alignItems: 'center', fontWeight: 600, color: '#2563eb', fontSize: '0.85rem', marginLeft: '4px' }}>{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      );
    }
    return <iframe src={selectedDoc.url} style={{ width: '100%', height: '100%', border: 'none' }} title={selectedDoc.name} />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8fafc' }}>
      <header className="top-header" style={{ display: 'none' }}></header> {/* Hidden as per screenshot 1 */}

      {canUseAdminJourneyActions && (
        <section style={{ margin: '12px 12px 0', padding: '18px 20px', borderRadius: 10, border: '2px solid #16a34a', background: '#ecfdf5', boxShadow: '0 8px 24px rgba(22, 163, 74, 0.16)' }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#166534', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Admin Action</div>
              <h2 style={{ margin: '0 0 6px', color: '#052e16', fontSize: '1.45rem', lineHeight: 1.2 }}>Journey Controls</h2>
              <p style={{ margin: 0, color: '#166534', fontWeight: 600 }}>
                Journey buttons update dashboard state. Re-populate Tables refreshes downstream rows only; it does not push integrations.
                <span style={{ marginLeft: 10 }}>Application ID: {applicationId}</span>
                <span style={{ marginLeft: 10 }}>PAN: {clientPan}</span>
                <span style={{ marginLeft: 10 }}>Client: {clientCodeStr}</span>
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {adminJourneyActions.map(action => {
                const loading = adminActionLoading === action.key;
                return (
                  <button
                    key={action.key}
                    type="button"
                    onClick={() => handleAdminJourneyAction(action)}
                    disabled={Boolean(adminActionLoading)}
                    style={{ minWidth: 180, padding: '16px 18px', border: 'none', borderRadius: 8, background: loading ? action.loadingBackground : action.background, color: '#ffffff', fontSize: '1rem', fontWeight: 800, cursor: adminActionLoading ? 'wait' : 'pointer', boxShadow: '0 8px 16px rgba(15, 23, 42, 0.16)' }}
                  >
                    {loading ? action.loadingLabel : action.buttonLabel}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setApplicantNameInput(clientName === 'Unknown Client' ? '' : String(clientName).toUpperCase());
                  setAdminActionResult(null);
                  setNameEditorOpen(true);
                }}
                disabled={Boolean(adminActionLoading)}
                style={{ minWidth: 180, padding: '16px 18px', border: 'none', borderRadius: 8, background: '#0f766e', color: '#ffffff', fontSize: '1rem', fontWeight: 800, cursor: adminActionLoading ? 'wait' : 'pointer', boxShadow: '0 8px 16px rgba(15, 23, 42, 0.16)' }}
              >
                Update Name
              </button>
            </div>
          </div>
          {nameEditorOpen && (
            <form onSubmit={handleApplicantNameUpdate} style={{ marginTop: 14, padding: 14, border: '1px solid #99f6e4', borderRadius: 8, background: '#f0fdfa' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 12, alignItems: 'end' }}>
                <div>
                  <div style={{ color: '#475569', fontSize: '0.75rem', fontWeight: 700, marginBottom: 6 }}>Current applicant name</div>
                  <div style={{ minHeight: 42, display: 'flex', alignItems: 'center', padding: '9px 11px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#ffffff', color: '#0f172a', fontWeight: 700 }}>{clientName}</div>
                </div>
                <label style={{ display: 'block' }}>
                  <span style={{ display: 'block', color: '#134e4a', fontSize: '0.75rem', fontWeight: 800, marginBottom: 6 }}>Corrected full name</span>
                  <input
                    type="text"
                    value={applicantNameInput}
                    onChange={(event) => setApplicantNameInput(event.target.value.toUpperCase())}
                    maxLength={150}
                    autoFocus
                    required
                    aria-label="Corrected applicant full name"
                    style={{ boxSizing: 'border-box', width: '100%', height: 42, padding: '9px 11px', border: '1px solid #0f766e', borderRadius: 6, background: '#ffffff', color: '#0f172a', fontSize: '0.95rem', fontWeight: 700 }}
                  />
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="submit"
                    disabled={Boolean(adminActionLoading)}
                    style={{ height: 42, padding: '0 16px', border: 'none', borderRadius: 6, background: '#0f766e', color: '#ffffff', fontWeight: 800, cursor: adminActionLoading ? 'wait' : 'pointer' }}
                  >
                    {adminActionLoading === 'update-applicant-name' ? 'Updating...' : 'Save Name'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNameEditorOpen(false)}
                    disabled={Boolean(adminActionLoading)}
                    style={{ height: 42, padding: '0 14px', border: '1px solid #94a3b8', borderRadius: 6, background: '#ffffff', color: '#334155', fontWeight: 700, cursor: adminActionLoading ? 'wait' : 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <p style={{ margin: '10px 0 0', color: '#475569', fontSize: '0.78rem' }}>
                Updates identity, PAN verification (when present), CVLKRA, CDSL, NSE, BSE, and the exact PAN/client-code TechExcel row. Signed PDFs and external submissions are not changed.
              </p>
            </form>
          )}
          {adminActionResult && (
            <div style={{ marginTop: 14, borderRadius: 8, border: `1px solid ${adminActionResult.success ? '#86efac' : '#fecaca'}`, background: adminActionResult.success ? '#f0fdf4' : '#fff1f2', color: adminActionResult.success ? '#14532d' : '#991b1b', padding: 12 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>{adminActionResult.success ? 'Admin action saved' : 'Admin action failed'}</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 260, overflow: 'auto', fontSize: '0.78rem' }}>
                {JSON.stringify(adminActionResult.data, null, 2)}
              </pre>
            </div>
          )}
        </section>
      )}

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '12px', gap: '12px' }}>
        
        {/* Modules Column */}
        <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
          <div style={{ padding: '12px', background: '#e6f0ff', color: '#1d4ed8', textAlign: 'center', fontSize: '0.9rem', fontWeight: 600, margin: '8px 8px 0 8px', borderRadius: '4px' }}>
            Modules
          </div>
          <div id="modules-accordion" style={{ overflowY: 'auto', padding: '8px' }}>
            {stageDefs.map(def => (
              <AccordionItem key={def.key} title={def.label} stageData={data.stages?.[def.key]} stageKey={def.key} timestamp={timestamps[def.label]} onEdit={handleEdit} />
            ))}
          </div>
        </div>

        {/* Documents Column */}
        <div style={{ flex: '0 0 220px', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}>
          <div style={{ padding: '12px', background: '#e6f0ff', color: '#1d4ed8', textAlign: 'center', fontSize: '0.9rem', fontWeight: 600, margin: '8px 8px 0 8px', borderRadius: '4px' }}>
            Documents
          </div>
          <div style={{ overflowY: 'auto', padding: '8px 0' }}>
            {documents.length === 0 ? (
              <div style={{ padding: 16, color: 'var(--text-secondary)', textAlign: 'center' }}>No documents found.</div>
            ) : (
              documents.map((doc, idx) => (
                <div key={idx} onClick={() => { setSelectedDoc(doc); setZoom(1); setRotation(0); }} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: selectedDoc?.url === doc.url ? '#1d4ed8' : '#475569', background: '#ffffff' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{doc.name}</span>
                  <span style={{ color: '#94a3b8', fontSize: '1rem', transform: 'rotate(45deg)' }}>📌</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Preview Column */}
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', position: 'relative' }}>
          
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative', padding: '16px' }}>
            <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, background: '#e6f0ff', color: '#1d4ed8', padding: '4px 12px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 600 }}>Preview</div>
            
            <div style={{ width: '100%', height: '100%', border: '1px dashed #cbd5e1', borderRadius: '8px', overflow: 'hidden', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)', backgroundSize: '10px 10px' }}>
              {renderDocumentPreview()}
            </div>
          </div>
          
          <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff' }}>
            <button style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '20px', background: '#ffffff', color: '#1d4ed8', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>Upload File</button>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button style={{ padding: '8px 24px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#f8fafc', color: '#0f172a', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>Save ⓘ</button>
              <button style={{ padding: '8px 24px', border: 'none', borderRadius: '6px', background: '#2563eb', color: '#ffffff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>Save & Generate PDF ⓘ</button>
            </div>
          </div>
          
        </div>

      </div>
    </div>
  );
}
