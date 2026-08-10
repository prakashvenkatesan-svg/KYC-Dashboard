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
  
  const handleEdit = async () => {
    const newVal = prompt(`Edit ${fieldLabel}:`, value);
    if (newVal !== null && newVal !== value) {
      const oldVal = value;
      setValue(newVal);
      try {
        await onEdit(stageKey, fieldKey, newVal, oldVal, () => setValue(oldVal));
      } catch (e) {
        setValue(oldVal);
      }
    }
  };

  let displayValue = value;
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
    displayValue = new Date(value).toLocaleString('en-GB');
  } else if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
    displayValue = <a href={value} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}>View Link</a>;
  }

  return (
    <div style={{ backgroundColor: '#f1f3f5', border: '1px solid #e2e8f0', borderRadius: 6, padding: '10px 12px', position: 'relative' }}>
      <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: 2, textTransform: 'capitalize' }}>{fieldLabel}</div>
      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b', wordBreak: 'break-all' }}>{displayValue}</div>
      <EditIcon onClick={handleEdit} />
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
        if (clientCode && clientCode.startsWith('APP-')) {
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
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', position: 'relative', backgroundColor: 'var(--bg-color)' }}>
          <img src={selectedDoc.url} alt={selectedDoc.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', transition: 'transform 0.2s ease-out', transform: `scale(${zoom}) rotate(${rotation}deg)` }} />
          <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 16, background: 'rgba(0,0,0,0.7)', padding: '10px 20px', borderRadius: 30, zIndex: 10 }}>
            <button onClick={() => setZoom(z => Math.max(0.2, z - 0.2))} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 22 }}>−</button>
            <button onClick={() => { setZoom(1); setRotation(0); }} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 20 }}>↺</button>
            <button onClick={() => setZoom(z => z + 0.2)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 22 }}>+</button>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.3)', margin: '0 4px' }}></div>
            <button onClick={() => setRotation(r => r + 90)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 20 }}>↻</button>
          </div>
        </div>
      );
    }
    return <iframe src={selectedDoc.url} style={{ width: '100%', height: '100%', border: 'none' }} title={selectedDoc.name} />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header className="top-header" style={{ padding: '16px 24px', background: 'var(--surface-color)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 id="client-name" style={{ margin: '0 0 8px 0', fontSize: '1.5rem', fontWeight: 600 }}>{clientName}</h1>
          <p id="client-code-pan" style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <strong>Code:</strong> {clientCodeStr} &bull; <strong>PAN:</strong> {clientPan} &bull; <strong>Email:</strong> {clientEmail} &bull; <strong>Phone:</strong> {clientPhone}
            {clientStageLabel && <><br/><strong>Current Stage:</strong> {clientStageLabel}</>}
          </p>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: '1 1 40%', overflowY: 'auto', borderRight: '1px solid var(--border-color)', background: 'var(--surface-color)' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>KYC Modules</h2>
          </div>
          <div id="modules-accordion">
            {stageDefs.map(def => (
              <AccordionItem key={def.key} title={def.label} stageData={data.stages?.[def.key]} stageKey={def.key} timestamp={timestamps[def.label]} onEdit={handleEdit} />
            ))}
          </div>
        </div>

        <div style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-color)' }}>
          <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--surface-color)', display: 'flex', gap: 16, overflowX: 'auto' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center' }}>Documents</h2>
          </div>
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <div style={{ width: 220, borderRight: '1px solid var(--border-color)', background: 'var(--surface-color)', overflowY: 'auto' }}>
              {documents.length === 0 ? (
                <div style={{ padding: 16, color: 'var(--text-secondary)', textAlign: 'center' }}>No documents found.</div>
              ) : (
                documents.map((doc, idx) => (
                  <div key={idx} onClick={() => { setSelectedDoc(doc); setZoom(1); setRotation(0); }} style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: selectedDoc?.url === doc.url ? 'var(--primary-color)' : 'var(--text-primary)', background: selectedDoc?.url === doc.url ? 'rgba(99,102,241,0.1)' : 'transparent' }}>
                    <span style={{ fontSize: '0.95rem' }}>{doc.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem', transform: 'rotate(45deg)' }}>📌</span>
                  </div>
                ))
              )}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-color)' }}>
              <div style={{ padding: '12px 16px', background: 'var(--surface-color)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>{selectedDoc ? selectedDoc.name : 'Preview'}</h3>
                {selectedDoc && <a href={selectedDoc.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'var(--primary-color)', fontSize: '0.9rem', fontWeight: 500 }}>Open in new tab ↗</a>}
              </div>
              <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {renderDocumentPreview()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
