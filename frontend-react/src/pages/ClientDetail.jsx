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
    const docs = [];
    const getS3Url = (pathOrUrl) => {
        if (!pathOrUrl) return null;
        if (pathOrUrl.startsWith('http')) return pathOrUrl;
        return pathOrUrl.startsWith('/') ? s3Base + pathOrUrl : s3Base + '/' + pathOrUrl;
    };

    if (stages.pan_and_dob?.upload?.s3_url || stages.pan_and_dob?.file_path) docs.push({ name: 'Uploadpan', url: getS3Url(stages.pan_and_dob.upload?.s3_url || stages.pan_and_dob.file_path) });
    if (stages.live_photo?.s3_url || stages.live_photo?.file_path) docs.push({ name: 'Clientimage', url: getS3Url(stages.live_photo.s3_url || stages.live_photo.file_path) });
    if (stages.signature_upload?.s3_url || stages.signature_upload?.file_path) docs.push({ name: 'Signature upload', url: getS3Url(stages.signature_upload.s3_url || stages.signature_upload.file_path) });
    if (stages.esign?.audit_log?.document_url) docs.push({ name: 'Esigned pdf', url: getS3Url(stages.esign.audit_log.document_url) });
    if (stages.esign?.application_info?.signed_pdf_url) docs.push({ name: 'Esigned pdf (Legacy)', url: getS3Url(stages.esign.application_info.signed_pdf_url) });
    
    if (stages.nominee_details && Array.isArray(stages.nominee_details)) {
        stages.nominee_details.forEach((n, idx) => {
            if (n.proof_file_url || n.file_path) docs.push({ name: `Nominee ${idx+1} upload`, url: getS3Url(n.proof_file_url || n.file_path) });
        });
    }

    setDocuments(docs);
    if (docs.length > 0) setSelectedDoc(docs[0]);
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
      return <iframe src={selectedDoc.url} style={{ width: '100%', height: '100%', border: 'none' }} title={selectedDoc.name} />;
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
