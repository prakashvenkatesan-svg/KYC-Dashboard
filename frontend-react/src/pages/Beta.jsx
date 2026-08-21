import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api';

const blankFilters = {
  q: '',
  flow: '',
  cvlkraStatus: '',
  currentStage: ''
};

const blockedPushPans = new Set([
  'EUXPA0011G',
  'BSBPH1408R',
  'DAFPK5513Q',
  'HJEPM7970R',
  'JNYPM9317Q',
  'AKAPN8939K',
  'AUJPR2926D',
  'GKMPS6855K',
  'CEQPG6014L',
  'BTUPB7271G',
  'KPUPS9096M',
  'ALQPN5323G'
]);

const internalTestPans = new Set([
  'HJEPM7970R',
  'PHQPK0909C'
]);

const isBlockedPushPan = (pan) => blockedPushPans.has(String(pan || '').trim().toUpperCase());
const isInternalTestPan = (pan) => internalTestPans.has(String(pan || '').trim().toUpperCase());

const cvlkraIssueText = (row) => [
  row?.cvlkra?.status,
  row?.cvlkra?.error,
  row?.cvlkra?.remarks,
  row?.cvlkra?.errorCode,
  row?.cvlkra?.modificationStatus,
  row?.cvlkra?.modificationStatusDate
].filter(Boolean).join(' ').toLowerCase();

const hasKraNameMismatch = (row) => {
  const issueText = cvlkraIssueText(row);
  return issueText.includes('name mismatch') || issueText.includes('name_mismatch');
};

const hasKraXmlHold = (row) => {
  const issueText = cvlkraIssueText(row);
  return (
    issueText.includes('aadhaar xml file not provided') ||
    issueText.includes('xml aadhaar validation failed')
  );
};

const getXmlMetadata = (row) => row?.xml || null;

const hasUsableXmlMetadata = (row) => {
  const xml = getXmlMetadata(row);
  if (!xml) return null;
  if (!xml.present) return false;
  if (xml.status === 'stored') return true;
  if (xml.status === 'validity_unknown') return Boolean(xml.isCertificate && xml.isSigned);
  return Boolean(xml.isCertificate && xml.isSigned && xml.isValidNow !== false);
};

const hasValidXmlForApi = (row) => {
  const metadataUsable = hasUsableXmlMetadata(row);
  if (metadataUsable !== null) return metadataUsable;
  const status = String(row?.xml_status || '').toLowerCase();
  return (
    status.includes('stored') ||
    status.includes('raw xml') ||
    String(row?.cvlkra?.fields?.aadhaarXmlS3Key || '').trim() !== ''
  );
};

const hasKraNotAvailable = (row) => {
  const issueText = cvlkraIssueText(row);
  return (
    issueText.includes('not available (005)') ||
    issueText.includes('status: not available') ||
    issueText.includes('kra_not_accepted') ||
    issueText.includes('not_accepted') ||
    issueText.includes('err-90029') ||
    issueText.includes('app_status err-90029')
  );
};

const hasErr90029 = (row) => cvlkraIssueText(row).includes('err-90029');

const hasKraValidated = (row) => {
  const issueText = cvlkraIssueText(row);
  const status = String(row?.cvlkra?.status || '').toLowerCase();
  return (
    status.includes('validated') ||
    issueText.includes('kra validated') ||
    issueText.includes('new kyc validated') ||
    issueText.includes('final cvlkra kyc status: kra validated (007)') ||
    issueText.includes('final cvlkra kyc status: validated (007)')
  );
};

const hasOldKraValidated = (row) => {
  if (!hasKraValidated(row)) return false;
  const issueText = cvlkraIssueText(row);
  const match = issueText.match(/as of\s+(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return false;
  const [, , month, year] = match.map(Number);
  return year < 2026 || (year === 2026 && month < 7);
};

const parseIndianDate = (value) => {
  const match = String(value || '').match(/(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (!match) return null;
  return {
    day: Number(match[1]),
    month: Number(match[2]),
    year: Number(match[3])
  };
};

const isJuly2026OrLater = (dateParts) => (
  Boolean(dateParts)
  && (dateParts.year > 2026 || (dateParts.year === 2026 && dateParts.month >= 7))
);

const hasRecentModifyUnderProcess = (row) => {
  const modificationText = [
    row?.cvlkra?.modificationStatus,
    row?.cvlkra?.modificationStatusDate,
    row?.cvlkra?.error,
    row?.cvlkra?.remarks
  ].filter(Boolean).join(' ').toLowerCase();
  const hasModify = modificationText.includes('modify') || modificationText.includes('modification');
  const hasUnderProcess = modificationText.includes('under process');
  const dateParts = parseIndianDate(row?.cvlkra?.modificationStatusDate) || parseIndianDate(modificationText);

  return hasModify && hasUnderProcess && isJuly2026OrLater(dateParts);
};

const isBlankValue = (value) => value === null || value === undefined || String(value).trim() === '';

const cvlkraFields = (row) => row?.cvlkra?.fields || {};

const requiredKraFieldLabels = [
  ['appOcc', 'occupation'],
  ['appIncome', 'income'],
  ['appCorAddProof', 'correspondence address proof'],
  ['appPerAddProof', 'permanent address proof'],
  ['appDocProof', 'document proof']
];

const missingCvlkraFields = (row) => {
  const fields = cvlkraFields(row);
  return requiredKraFieldLabels
    .filter(([key]) => isBlankValue(fields[key]))
    .map(([, label]) => label);
};

const getKraAction = (row) => {
  if (isInternalTestPan(row.pan)) {
    return {
      status: 'Do not push',
      tone: '#ef4444',
      detail: 'Internal/test PAN. Hidden from operational push list.'
    };
  }

  if (isBlockedPushPan(row.pan)) {
    return {
      status: 'Do not push',
      tone: '#ef4444',
      detail: 'KYC team manually completed/blocked this PAN.'
    };
  }

  if (hasRecentModifyUnderProcess(row)) {
    return {
      status: 'Do not push',
      tone: '#ef4444',
      detail: 'Modify KYC is already under process after July 2026.'
    };
  }

  if (hasKraNameMismatch(row)) {
    return {
      status: 'Admin re-push',
      tone: '#f97316',
      detail: 'Name mismatch with Income Tax. Admin may re-push after verification.'
    };
  }

  if (hasOldKraValidated(row)) {
    if (row.flow_type === 'DigiLocker') {
      return {
        status: 'KRA Push',
        tone: '#2563eb',
        detail: 'Old KRA validated before July 2026. DigiLocker flow needs fresh API KRA push.'
      };
    }

    return {
      status: 'Push downstream',
      tone: '#2563eb',
      detail: 'KRA already valid before July 2026. Skip KRA push; push CDSL/NSE/BSE/TechExcel if pending.'
    };
  }

  if (hasKraValidated(row)) {
    return {
      status: 'KRA valid',
      tone: '#16a34a',
      detail: 'KRA accepted. Continue downstream checks/pushes.'
    };
  }

  if (hasKraXmlHold(row)) {
    return {
      status: 'Doc Push only',
      tone: '#2563eb',
      detail: hasValidXmlForApi(row)
        ? 'Fresh KRA exists; upload XML/PDF only.'
        : 'Fresh KRA exists; upload docs only. Verify XML exists in S3 if it fails.'
    };
  }

  if (hasErr90029(row)) {
    return {
      status: 'KRA Push',
      tone: '#2563eb',
      detail: 'ERR-90029. Push after income/occupation/proofs are fixed.'
    };
  }

  if (hasKraNotAvailable(row)) {
    return {
      status: 'KRA Push',
      tone: '#2563eb',
      detail: 'KRA not available. Submit fresh API KRA.'
    };
  }

  return {
    status: 'Check KRA',
    tone: '#64748b',
    detail: 'Fetch latest KRA status before deciding.'
  };
};

const getKraReadiness = (row) => {
  const action = getKraAction(row);
  const disabledReason = targetDisabledReason('cvlkra', row);
  const missingFields = missingCvlkraFields(row);
  const reasons = [];

  if (isBlockedPushPan(row.pan)) reasons.push('KYC/manual blocklist');
  if (hasKraNameMismatch(row)) reasons.push('Name mismatch override requires admin confirmation');
  if (hasRecentModifyUnderProcess(row)) reasons.push('Modify KYC under process after July 2026');
  if (row.flow_type === 'DigiLocker' && !hasValidXmlForApi(row)) reasons.push('Aadhaar XML missing/not stored');
  if (missingFields.length) reasons.push(`Missing ${missingFields.join(', ')}`);
  if (!['KRA Push', 'Admin re-push'].includes(action.status)) reasons.push(action.detail);
  if (disabledReason) reasons.push(disabledReason);

  const uniqueReasons = [...new Set(reasons.filter(Boolean))];
  const canPush = ['KRA Push', 'Admin re-push'].includes(action.status)
    && !isInternalTestPan(row.pan)
    && !disabledReason
    && missingFields.length === 0
    && (row.flow_type !== 'DigiLocker' || hasValidXmlForApi(row));

  return {
    canPush,
    status: canPush ? 'Can push' : 'Cannot push',
    tone: canPush ? '#16a34a' : '#ef4444',
    action: action.status,
    reason: canPush ? action.detail : (uniqueReasons.join(' | ') || 'Not eligible for KRA push'),
    missingFields
  };
};

const actionBadge = ({ status, tone, detail }) => (
  <div title={detail} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
    <span
      style={{
        display: 'inline-flex',
        padding: '3px 9px',
        borderRadius: 999,
        background: `${tone}22`,
        color: tone,
        fontSize: '0.75rem',
        fontWeight: 800,
        whiteSpace: 'nowrap'
      }}
    >
      {status}
    </span>
    <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', lineHeight: 1.25, overflowWrap: 'anywhere' }}>
      {detail}
    </span>
  </div>
);

const displayCvlkra = (row) => {
  if (hasKraNameMismatch(row)) {
    return {
      ...(row.cvlkra || {}),
      status: 'Name_Mismatch',
      error: row.cvlkra?.error || 'Name mismatch with Income Tax. Client consent/correction needed.'
    };
  }

  if (hasRecentModifyUnderProcess(row)) {
    return {
      ...(row.cvlkra || {}),
      status: 'Modify_Under_Process',
      error: row.cvlkra?.error || 'Modify KYC is already under process after July 2026.'
    };
  }

  if (hasKraXmlHold(row)) {
    return {
      ...(row.cvlkra || {}),
      status: 'XML_Hold',
      error: row.cvlkra?.error || 'Aadhaar XML validation/document issue.'
    };
  }

  return row.cvlkra;
};

const statusTone = (status) => {
  const value = String(status || '').toLowerCase();
  if (['success', 'passed', 'documents_uploaded', 'uploaded', 's'].includes(value)) return '#22c55e';
  if (['name_mismatch', 'xml_hold', 'kra_xml_hold'].some(x => value.includes(x))) return '#f97316';
  if (['modify_under_process', 'kra_modify_under_process'].some(x => value.includes(x))) return '#f97316';
  if (['valid xml'].some(x => value.includes(x))) return '#22c55e';
  if (['invalid xml', 'expired xml', 'missing'].some(x => value.includes(x))) return '#ef4444';
  if (['xml present', 'stored', 'raw xml'].some(x => value.includes(x))) return '#eab308';
  if (['pending', 'under process', 'documents uploaded'].some(x => value.includes(x))) return '#eab308';
  if (['failed', 'rejected', 'error', 'hold'].some(x => value.includes(x))) return '#ef4444';
  return '#94a3b8';
};

const badge = (status) => (
  <span
    style={{
      display: 'inline-flex',
      maxWidth: 180,
      padding: '3px 9px',
      borderRadius: 999,
      background: `${statusTone(status)}22`,
      color: statusTone(status),
      fontSize: '0.75rem',
      fontWeight: 700,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }}
    title={status || ''}
  >
    {status || '-'}
  </span>
);

const text = (value) => {
  if (value === null || value === undefined || String(value).trim() === '') return '-';
  return String(value);
};

const formatXmlDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const xmlCell = (row) => {
  const xml = getXmlMetadata(row);
  if (!xml) return badge(row.xml_status);

  const hasSignatureCount = xml.signatureCount !== null && xml.signatureCount !== undefined;
  const detail = [
    xml.rootName ? `root: ${xml.rootName}` : '',
    hasSignatureCount ? `signatures: ${xml.signatureCount}` : '',
    xml.generatedAt ? `generated: ${formatXmlDate(xml.generatedAt)}` : '',
    xml.validUntil ? `valid until: ${formatXmlDate(xml.validUntil)}` : '',
    xml.reason || ''
  ].filter(Boolean).join('\n');

  return (
    <div title={detail} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start', minWidth: 0 }}>
      {badge(xml.label || row.xml_status)}
      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', lineHeight: 1.25, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
        {xml.rootName ? text(xml.rootName) : text(xml.source)}
        {hasSignatureCount ? ` | sig ${xml.signatureCount}` : ''}
      </div>
      {xml.generatedAt ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', lineHeight: 1.25 }}>
          Gen {formatXmlDate(xml.generatedAt)}
        </div>
      ) : null}
      {xml.validUntil ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', lineHeight: 1.25 }}>
          Till {formatXmlDate(xml.validUntil)}
        </div>
      ) : null}
    </div>
  );
};

const tableColumnStyles = {
  select: { width: 48 },
  pan: { width: 112 },
  clientCode: { width: 92 },
  application: { width: 110 },
  name: { width: 230 },
  stage: { width: 110 },
  integration: { width: 260 },
  kraAction: { width: 220 },
  xml: { width: 190 }
};

const statusCell = (integration, actions = []) => {
  const status = text(integration?.status);
  const error = text(integration?.error);
  const title = error === '-' ? status : `${status}\n${error}`;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
        minWidth: 0,
        maxWidth: 240
      }}
      title={title}
    >
      {badge(integration?.status)}
      <div
        style={{
          width: '100%',
          color: 'var(--text-muted)',
          fontSize: '0.72rem',
          lineHeight: 1.25,
          whiteSpace: 'normal',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word'
        }}
      >
        {error}
      </div>
      {actions.length > 0 ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {actions.map(action => (
            <button
              key={action.key}
              className={action.primary ? 'beta-primary-btn' : 'beta-secondary-btn'}
              onClick={action.onClick}
              disabled={action.disabled}
              title={action.title || action.label}
              style={{
                padding: '5px 8px',
                fontSize: '0.72rem',
                minHeight: 28,
                opacity: action.disabled ? 0.48 : 1,
                background: action.disabled ? 'var(--subtle-surface)' : (action.primary ? 'var(--primary-color)' : '#2563eb'),
                borderColor: action.disabled ? 'var(--surface-border)' : (action.primary ? 'var(--primary-color)' : '#1d4ed8'),
                color: action.disabled ? 'var(--text-muted)' : '#fff',
                boxShadow: action.disabled ? 'none' : '0 2px 8px rgba(37, 99, 235, 0.28)'
              }}
            >
              {action.loading ? (action.loadingLabel || 'Loading...') : action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

const isStatusSuccess = (status) => {
  const value = String(status || '').toLowerCase();
  return ['success', 'passed', 'success(s)', 's'].includes(value) || value.startsWith('success');
};
const isStatusFailed = (status) => {
  const value = String(status || '').toLowerCase();
  return ['failed', 'rejected'].some(term => value.includes(term));
};
const isCdslUploaded = (row) => {
  const status = String(row?.cdsl?.status || '').toLowerCase();
  if (status === 'uploaded') return true;
  if (isStatusSuccess(status) || isStatusFailed(status)) return false;
  return Boolean(row?.cdsl?.ackId && row?.cdsl?.zipFileName);
};

const isStatusPendingLike = (status) => {
  const value = String(status || '').toLowerCase();
  return !value || value === '-' || [
    'pending',
    'not pushed',
    'rejected',
    'failed',
    'unclear',
    'not_accepted',
    'not accepted',
    'fetch_failed',
    'fetch failed'
  ].some(term => value.includes(term));
};

const getRowKey = (row) => `${row.flow_type}-${row.application_id}-${row.pan || ''}`;
const isFinalCdslRow = (row) => isStatusSuccess(row?.cdsl?.status) || isStatusFailed(row?.cdsl?.status);

const applyRowOverrides = (row, overrides) => {
  const override = overrides[getRowKey(row)];
  if (!override || isFinalCdslRow(row)) return row;

  return {
    ...row,
    ...override,
    cdsl: {
      ...(row.cdsl || {}),
      ...(override.cdsl || {})
    }
  };
};

const markCdslWaitingOverride = (row) => ({
  cdsl: {
    status: 'Uploaded',
    ackId: row?.cdsl?.ackId,
    zipFileName: row?.cdsl?.zipFileName,
    error: 'Uploaded to CDSL; waiting for final response'
  }
});

const pushLabel = (target) => ({
  cvlkra: 'KRA Push',
  cvlkra_document: 'Doc Push',
  cvlkra_status: 'Check KRA',
  cdsl: 'CDSL Push',
  cdsl_status: 'CDSL Check',
  nse: 'NSE Push',
  bse: 'BSE Push',
  techexcel: 'TechExcel Push'
}[target] || target);

const loadingLabel = (target) => ({
  cvlkra: 'Pushing KRA...',
  cvlkra_document: 'Uploading docs...',
  cvlkra_status: 'Checking KRA...',
  cdsl: 'Pushing CDSL...',
  cdsl_status: 'Checking CDSL...',
  nse: 'Pushing NSE...',
  bse: 'Pushing BSE...',
  techexcel: 'Pushing TechExcel...'
}[target] || 'Loading...');

const includesText = (row, query) => {
  if (!query) return true;
  const tokens = query
    .split(/[\n,]+/)
    .map(token => token.trim().toLowerCase())
    .filter(Boolean);
  const needles = tokens.length > 1 ? tokens : [query.trim().toLowerCase()].filter(Boolean);
  const exactFields = [
    row.pan,
    row.client_code,
    row.application_id
  ].map(value => String(value || '').trim().toLowerCase());
  const searchableFields = [
    ...exactFields,
    row.client_name,
    row.current_step,
    row.cvlkra?.status,
    row.cdsl?.status,
    row.nse?.status,
    row.bse?.status,
    row.techexcel?.status,
    row.xml_status
  ];

  if (tokens.length > 1) {
    return needles.some(needle => exactFields.includes(needle));
  }

  return [
    ...searchableFields
  ].some(value => String(value || '').toLowerCase().includes(needles[0]));
};

const targetDisabledReason = (target, row) => {
  const cdslSuccess = isStatusSuccess(row.cdsl?.status);
  const cdslUploaded = isCdslUploaded(row);
  const directKraFlow = row.flow_type === 'KRA';
  const cvlkraStatus = String(row.cvlkra?.status || '').toLowerCase();

  if (target === 'cvlkra') {
    if (isInternalTestPan(row.pan)) return 'Push blocked: internal/test PAN';
    if (isBlockedPushPan(row.pan)) return 'Push blocked: KYC team completed KRA manually for this PAN';
    if (hasRecentModifyUnderProcess(row)) return 'Push blocked: Modify KYC already under process after July 2026';
    if (hasKraNameMismatch(row)) return '';
    if (hasOldKraValidated(row) && row.flow_type === 'DigiLocker') return '';
    if (hasKraValidated(row)) return 'KRA is already validated';
    if (hasKraXmlHold(row)) return 'Use Doc Push for XML hold rows';
    if (!isStatusPendingLike(row.cvlkra?.status)) return 'CVL KRA is not pending';
    return '';
  }

  if (target === 'cvlkra_document') {
    if (isInternalTestPan(row.pan)) return 'Push blocked: internal/test PAN';
    if (isBlockedPushPan(row.pan)) return 'Push blocked: KYC team completed KRA manually for this PAN';
    if (hasRecentModifyUnderProcess(row)) return 'Push blocked: Modify KYC already under process after July 2026';
    if (directKraFlow) return 'Not needed for direct KRA flow';
    if (hasKraNameMismatch(row)) return '';
    if (hasKraValidated(row)) return 'KRA is already validated; document upload is not needed';
    if (hasKraXmlHold(row)) return '';
    if (!isStatusSuccess(row.cvlkra?.status) && cvlkraStatus !== 'documents_uploaded') return 'Fresh KRA must be accepted before document upload';
    return '';
  }

  if (target === 'cvlkra_status') {
    if (isInternalTestPan(row.pan)) return 'Internal/test PAN hidden from operational status checks';
    if (!row.cvlkra?.status) return 'No CVL KRA row/status available to check';
    return '';
  }

  if (isInternalTestPan(row.pan)) {
    return 'Push blocked: internal/test PAN';
  }

  if (isBlockedPushPan(row.pan)) {
    return 'Push blocked: KYC team completed KRA manually for this PAN';
  }

  if (target === 'cdsl') {
    if (isStatusSuccess(row.cdsl?.status)) return 'CDSL is already success';
    if (cdslUploaded) return 'Use CDSL Check for uploaded rows';
    return '';
  }

  if (target === 'cdsl_status') {
    if (!cdslUploaded) return 'CDSL status must be Uploaded';
    return '';
  }

  if (['nse', 'bse', 'techexcel'].includes(target)) {
    if (!cdslSuccess) return 'CDSL must be success first';
    if (!isStatusPendingLike(row[target]?.status)) return `${pushLabel(target)} is not pending`;
    return '';
  }

  return '';
};

const batchTargetsForFlow = (flowType) => (
  flowType === 'KRA'
    ? ['cvlkra', 'cvlkra_status', 'cdsl', 'cdsl_status', 'nse', 'bse', 'techexcel']
    : ['cvlkra', 'cvlkra_document', 'cvlkra_status', 'cdsl', 'cdsl_status', 'nse', 'bse', 'techexcel']
);

const pushConfirmationText = (target, rows, label, skippedCount = 0) => {
  const mismatchCount = rows.filter(hasKraNameMismatch).length;
  const skipText = skippedCount
    ? ` ${skippedCount} selected row(s) are not eligible and will be skipped.`
    : '';
  const mismatchWarning = ['cvlkra', 'cvlkra_document'].includes(target) && mismatchCount
    ? `\n\nWarning: ${mismatchCount} row(s) have a name mismatch with Income Tax. This admin action will proceed despite that mismatch. Confirm the client details before continuing.`
    : '';

  return `Push ${label}?${skipText}${mismatchWarning}`;
};

const nomineeIssuePattern = /(nominee|nomination|sum of percentage|percentage of shares|allocation percentage|minor flag|relationship with bo|exact relationship)/i;

const nomineeIssueText = (row) => [
  row?.kraReadiness?.reason,
  row?.cdsl?.error,
  row?.nse?.error,
  row?.bse?.error,
  row?.techexcel?.error,
  row?.cvlkra?.error,
  row?.cvlkra?.remarks
].filter(Boolean).join(' ');

const hasNomineeIssue = (row) => nomineeIssuePattern.test(nomineeIssueText(row));

const NomineeIssueButton = ({ row, onOpenNominees }) => {
  if (!hasNomineeIssue(row) || !row?.application_id || !onOpenNominees) return null;

  return (
    <button
      type="button"
      className="beta-secondary-btn"
      onClick={() => onOpenNominees(row)}
      title="Open nominee details for this application"
      style={{
        padding: '5px 8px',
        fontSize: '0.72rem',
        minHeight: 28,
        background: '#7c3aed',
        borderColor: '#6d28d9',
        color: '#fff',
        boxShadow: '0 2px 8px rgba(124, 58, 237, 0.24)'
      }}
    >
      View Nominees
    </button>
  );
};

const formatNomineeDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

function NomineeModal({ state, onClose, onDelete }) {
  if (!state.open) return null;

  const row = state.row || {};
  const nominees = state.nominees || [];
  const totalAllocation = state.summary?.total_allocation ?? nominees.reduce((sum, nominee) => {
    const value = Number(nominee.allocation_percentage || 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nominee details"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 4000,
        background: 'rgba(15, 23, 42, 0.62)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24
      }}
    >
      <div
        style={{
          width: 'min(1180px, 96vw)',
          maxHeight: '88vh',
          overflow: 'hidden',
          background: 'var(--card-bg, var(--surface-color, #fff))',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          boxShadow: '0 24px 80px rgba(15, 23, 42, 0.35)'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            alignItems: 'flex-start',
            padding: '18px 20px',
            borderBottom: '1px solid var(--border-color)'
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.18rem' }}>Nominee Details</h2>
            <div style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: '0.86rem', lineHeight: 1.35 }}>
              Application {text(row.application_id)} · PAN {text(row.pan)} · CC {text(row.client_code)}
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {badge(`${nominees.length} nominee${nominees.length === 1 ? '' : 's'}`)}
              {badge(`Allocation ${totalAllocation}%`)}
            </div>
          </div>
          <button className="beta-secondary-btn" type="button" onClick={onClose}>Close</button>
        </div>

        <div style={{ padding: 20, overflow: 'auto', maxHeight: 'calc(88vh - 112px)' }}>
          {state.loading ? (
            <div style={{ padding: 18 }}>Loading nominees...</div>
          ) : state.error ? (
            <pre className="beta-alert" style={{ whiteSpace: 'pre-wrap' }}>{state.error}</pre>
          ) : nominees.length === 0 ? (
            <div style={{ padding: 18 }}>No nominee rows found.</div>
          ) : (
            <table style={{ width: '100%', minWidth: 1060, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: 56 }}>ID</th>
                  <th style={{ width: 160 }}>Name</th>
                  <th style={{ width: 110 }}>Relation</th>
                  <th style={{ width: 110 }}>DOB</th>
                  <th style={{ width: 92 }}>Gender</th>
                  <th style={{ width: 125 }}>Mobile</th>
                  <th style={{ width: 190 }}>Email</th>
                  <th style={{ width: 110 }}>Proof</th>
                  <th style={{ width: 150 }}>PAN/Aadhaar</th>
                  <th style={{ width: 92 }}>Alloc.</th>
                  <th style={{ width: 280 }}>Address</th>
                  <th style={{ width: 105 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {nominees.map(nominee => (
                  <tr key={nominee.id}>
                    <td style={{ verticalAlign: 'top', fontFamily: 'monospace' }}>{text(nominee.id)}</td>
                    <td style={{ verticalAlign: 'top', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{text(nominee.nominee_name)}</td>
                    <td style={{ verticalAlign: 'top' }}>{text(nominee.relation)}</td>
                    <td style={{ verticalAlign: 'top' }}>{formatNomineeDate(nominee.dob)}</td>
                    <td style={{ verticalAlign: 'top' }}>{text(nominee.gender)}</td>
                    <td style={{ verticalAlign: 'top', fontFamily: 'monospace' }}>{text(nominee.mobile)}</td>
                    <td style={{ verticalAlign: 'top', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{text(nominee.email)}</td>
                    <td style={{ verticalAlign: 'top' }}>{text(nominee.nominee_proof_type)}</td>
                    <td style={{ verticalAlign: 'top', fontFamily: 'monospace', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                      {[nominee.pan, nominee.aadhaar].filter(Boolean).join(' / ') || '-'}
                    </td>
                    <td style={{ verticalAlign: 'top' }}>{text(nominee.allocation_percentage)}</td>
                    <td style={{ verticalAlign: 'top', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{text(nominee.nominee_address)}</td>
                    <td style={{ verticalAlign: 'top' }}>
                      <button
                        type="button"
                        className="beta-secondary-btn"
                        disabled={state.deletingId === nominee.id}
                        onClick={() => onDelete(nominee)}
                        style={{
                          padding: '5px 8px',
                          fontSize: '0.72rem',
                          minHeight: 28,
                          background: state.deletingId === nominee.id ? 'var(--subtle-surface)' : '#dc2626',
                          borderColor: state.deletingId === nominee.id ? 'var(--surface-border)' : '#b91c1c',
                          color: state.deletingId === nominee.id ? 'var(--text-muted)' : '#fff'
                        }}
                      >
                        {state.deletingId === nominee.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function BetaTable({
  title,
  description,
  flowType,
  rows,
  localFilter,
  onLocalFilter,
  onPush,
  onPushSelected,
  pushingKey,
  selectedKeys,
  onToggleRow,
  onToggleVisibleRows,
  onClearSelection,
  onOpenNominees
}) {
  const filteredRows = useMemo(
    () => rows.filter(row => includesText(row, localFilter)),
    [rows, localFilter]
  );
  const filteredKeys = useMemo(() => filteredRows.map(getRowKey), [filteredRows]);
  const selectedRows = useMemo(
    () => filteredRows.filter(row => selectedKeys.has(getRowKey(row))),
    [filteredRows, selectedKeys]
  );
  const selectedCount = selectedRows.length;
  const allVisibleSelected = filteredKeys.length > 0 && filteredKeys.every(key => selectedKeys.has(key));

  const actionKey = (target, row) => `${target}:${row.application_id}:${row.pan || ''}`;

  const makeAction = (target, row, label, title = '') => {
    const key = actionKey(target, row);
    const loading = pushingKey === key;
    const disabledReason = targetDisabledReason(target, row);
    return {
      key,
      label,
      loadingLabel: loadingLabel(target),
      loading,
      disabled: Boolean(disabledReason) || Boolean(pushingKey),
      title: disabledReason || title,
      onClick: () => onPush(target, row)
    };
  };

  const rowActions = (row) => {
    const cdslSuccess = isStatusSuccess(row.cdsl?.status);
    const cdslUploaded = isCdslUploaded(row);
    const directKraFlow = row.flow_type === 'KRA';

    return {
      cvlkra: directKraFlow
        ? [
          makeAction('cvlkra', row, 'Push KRA', 'Submit the CVL KRA entry'),
          makeAction('cvlkra_status', row, 'Check KRA', 'Fetch final CVL KRA status and update the DB')
        ]
        : [
          makeAction('cvlkra', row, 'Push KRA', 'Submit the fresh CVL KRA entry'),
          makeAction('cvlkra_document', row, 'Upload Docs', 'Upload KRA PDF/XML documents'),
          makeAction('cvlkra_status', row, 'Check KRA', 'Fetch final CVL KRA status and update the DB')
        ],
      cdsl: cdslUploaded
        ? [makeAction('cdsl_status', row, 'Check CDSL', 'Download and apply the final CDSL response')]
        : [
          makeAction('cdsl', row, 'Push CDSL', 'Push this record to CDSL')
        ],
      nse: [makeAction('nse', row, 'Push NSE', cdslSuccess ? 'Push this record to NSE' : 'CDSL must be success before NSE')],
      bse: [makeAction('bse', row, 'Push BSE', cdslSuccess ? 'Push this record to BSE' : 'CDSL must be success before BSE')],
      techexcel: [makeAction('techexcel', row, 'Push TechExcel', cdslSuccess ? 'Push this record to TechExcel' : 'CDSL must be success before TechExcel')]
    };
  };

  const batchTargets = batchTargetsForFlow(flowType);
  const batchButton = (target) => {
    const eligibleRows = selectedRows.filter(row => !targetDisabledReason(target, row));
    const disabled = selectedCount === 0 || eligibleRows.length === 0 || Boolean(pushingKey);
    const loading = pushingKey === `batch:${target}`;
    return (
      <button
        key={target}
        className="beta-primary-btn"
        disabled={disabled}
        onClick={() => onPushSelected(target, eligibleRows, selectedCount - eligibleRows.length)}
        title={eligibleRows.length ? `${pushLabel(target)} for ${eligibleRows.length} selected row(s)` : 'No selected rows are eligible for this push'}
        style={{
          padding: '7px 10px',
          fontSize: '0.78rem',
          opacity: disabled ? 0.48 : 1,
          background: disabled ? 'var(--subtle-surface)' : 'var(--primary-color)',
          borderColor: disabled ? 'var(--surface-border)' : 'var(--primary-color)',
          color: disabled ? 'var(--text-muted)' : '#fff',
          boxShadow: disabled ? 'none' : '0 2px 8px rgba(37, 99, 235, 0.28)'
        }}
      >
        {loading ? loadingLabel(target) : `${pushLabel(target)} (${eligibleRows.length})`}
      </button>
    );
  };

  return (
    <section className="beta-section" style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{title}</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>{description}</p>
        </div>
        <input
          value={localFilter}
          onChange={event => onLocalFilter(event.target.value)}
          placeholder="Filter this section"
          style={{ minWidth: 240, padding: '9px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
          padding: '10px 12px',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          background: 'var(--subtle-surface)'
        }}
      >
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', fontWeight: 700 }}>
          {selectedCount} selected in this section
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {batchTargets.map(batchButton)}
          <button className="beta-secondary-btn" onClick={() => onClearSelection(filteredKeys)} disabled={!selectedCount || Boolean(pushingKey)}>
            Clear
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
        <table style={{ width: '100%', minWidth: 2260, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={tableColumnStyles.select}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={!filteredRows.length || Boolean(pushingKey)}
                  onChange={() => onToggleVisibleRows(filteredRows, !allVisibleSelected)}
                  aria-label={`Select all visible ${title} rows`}
                />
              </th>
              <th style={tableColumnStyles.pan}>PAN</th>
              <th style={tableColumnStyles.clientCode}>CC</th>
              <th style={tableColumnStyles.application}>Application</th>
              <th style={tableColumnStyles.name}>Name</th>
              <th style={tableColumnStyles.stage}>Stage</th>
              <th style={tableColumnStyles.kraAction}>KRA Action</th>
              <th style={{ width: 130 }}>Nominees</th>
              <th style={tableColumnStyles.integration}>CVL KRA</th>
              <th style={tableColumnStyles.integration}>CDSL</th>
              <th style={tableColumnStyles.integration}>NSE</th>
              <th style={tableColumnStyles.integration}>BSE</th>
              <th style={tableColumnStyles.integration}>TechExcel</th>
              <th style={tableColumnStyles.xml}>XML</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan="14" style={{ textAlign: 'center', padding: 18 }}>No records found.</td></tr>
            ) : filteredRows.map(row => {
              const actions = rowActions(row);
              const key = getRowKey(row);
              const kraAction = getKraAction(row);
              return (
                <tr key={key}>
                  <td style={{ ...tableColumnStyles.select, verticalAlign: 'top' }}>
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(key)}
                      disabled={Boolean(pushingKey)}
                      onChange={() => onToggleRow(key)}
                      aria-label={`Select ${row.pan || row.application_id}`}
                    />
                  </td>
                  <td style={{ ...tableColumnStyles.pan, fontFamily: 'monospace', fontWeight: 700, verticalAlign: 'top' }}>{text(row.pan)}</td>
                  <td style={{ ...tableColumnStyles.clientCode, fontFamily: 'monospace', verticalAlign: 'top' }}>{text(row.client_code)}</td>
                  <td style={{ ...tableColumnStyles.application, verticalAlign: 'top' }}>{text(row.application_id)}</td>
                  <td style={{ ...tableColumnStyles.name, verticalAlign: 'top', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{text(row.client_name)}</td>
                  <td style={{ ...tableColumnStyles.stage, verticalAlign: 'top' }}>{text(row.current_step)}</td>
                  <td style={{ ...tableColumnStyles.kraAction, verticalAlign: 'top' }}>{actionBadge(kraAction)}</td>
                  <td style={{ width: 130, verticalAlign: 'top' }}>
                    <NomineeIssueButton row={row} onOpenNominees={onOpenNominees} />
                  </td>
                  <td style={{ ...tableColumnStyles.integration, verticalAlign: 'top' }}>{statusCell(displayCvlkra(row), actions.cvlkra)}</td>
                  <td style={{ ...tableColumnStyles.integration, verticalAlign: 'top' }}>{statusCell(row.cdsl, actions.cdsl)}</td>
                  <td style={{ ...tableColumnStyles.integration, verticalAlign: 'top' }}>{statusCell(row.nse, actions.nse)}</td>
                  <td style={{ ...tableColumnStyles.integration, verticalAlign: 'top' }}>{statusCell(row.bse, actions.bse)}</td>
                  <td style={{ ...tableColumnStyles.integration, verticalAlign: 'top' }}>{statusCell(row.techexcel, actions.techexcel)}</td>
                  <td style={{ ...tableColumnStyles.xml, verticalAlign: 'top' }}>{xmlCell(row)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function KraReadinessPanel({
  rowsByTab,
  activeTab,
  onTabChange,
  localFilter,
  onLocalFilter,
  onCopy,
  onPush,
  onPushSelected,
  selectedKeys,
  onToggleRow,
  onToggleVisibleRows,
  onClearSelection,
  pushingKey,
  onOpenNominees
}) {
  const activeRows = rowsByTab[activeTab] || [];
  const filteredRows = useMemo(() => {
    const query = String(localFilter || '').trim().toLowerCase();
    if (!query) return activeRows;
    return activeRows.filter(row => {
      const readiness = row.kraReadiness || getKraReadiness(row);
      return [
        row.pan,
        row.client_code,
        row.application_id,
        row.client_name,
        row.flow_type,
        readiness.action,
        readiness.reason,
        row.cvlkra?.status,
        row.xml_status
      ].some(value => String(value || '').toLowerCase().includes(query));
    });
  }, [activeRows, localFilter]);
  const filteredKeys = useMemo(() => filteredRows.map(getRowKey), [filteredRows]);
  const selectedRows = useMemo(
    () => filteredRows.filter(row => selectedKeys.has(getRowKey(row))),
    [filteredRows, selectedKeys]
  );
  const selectedCount = selectedRows.length;
  const allVisibleSelected = filteredKeys.length > 0 && filteredKeys.every(key => selectedKeys.has(key));
  const selectedPushableRows = selectedRows.filter(row => {
    const readiness = row.kraReadiness || getKraReadiness(row);
    return readiness.canPush && !targetDisabledReason('cvlkra', row);
  });
  const bulkPushDisabled = selectedPushableRows.length === 0 || Boolean(pushingKey);

  const renderPushButton = (row) => {
    const readiness = row.kraReadiness || getKraReadiness(row);
    const key = `cvlkra:${row.application_id}:${row.pan || ''}`;
    const loading = pushingKey === key;
    const disabled = !readiness.canPush || Boolean(pushingKey);
    return (
      <button
        className="beta-primary-btn"
        disabled={disabled}
        onClick={() => onPush('cvlkra', row)}
        title={readiness.canPush ? 'Push this PAN to CVL KRA' : readiness.reason}
        style={{
          padding: '6px 10px',
          fontSize: '0.76rem',
          opacity: disabled ? 0.48 : 1,
          background: disabled ? 'var(--subtle-surface)' : '#16a34a',
          borderColor: disabled ? 'var(--surface-border)' : '#15803d',
          color: disabled ? 'var(--text-muted)' : '#fff',
          boxShadow: disabled ? 'none' : '0 2px 8px rgba(22, 163, 74, 0.28)'
        }}
      >
        {loading ? loadingLabel('cvlkra') : 'Push KRA'}
      </button>
    );
  };

  const tabButton = (key, label) => (
    <button
      type="button"
      className={activeTab === key ? 'beta-primary-btn' : 'beta-secondary-btn'}
      onClick={() => onTabChange(key)}
      style={{
        background: activeTab === key ? 'var(--primary-color)' : 'var(--bg-color)',
        borderColor: activeTab === key ? 'var(--primary-color)' : 'var(--border-color)',
        color: activeTab === key ? '#fff' : 'var(--text-primary)'
      }}
    >
      {label} ({rowsByTab[key]?.length || 0})
    </button>
  );

  return (
    <section className="beta-section" style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>KRA Push Readiness</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
            Clear list of PANs that can be pushed now and PANs blocked by data, XML, KRA status, or manual hold.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tabButton('canPush', 'Can Push')}
          {tabButton('cannotPush', 'Cannot Push')}
          <button className="beta-secondary-btn" onClick={() => onCopy(activeTab)}>
            Copy PANs
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <input
          value={localFilter}
          onChange={event => onLocalFilter(event.target.value)}
          placeholder="Filter readiness list"
          style={{ minWidth: 260, padding: '9px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)' }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.86rem', fontWeight: 700 }}>
            Showing {filteredRows.length} of {activeRows.length}; {selectedCount} selected
          </span>
          <button
            className="beta-primary-btn"
            disabled={bulkPushDisabled}
            onClick={() => onPushSelected('cvlkra', selectedPushableRows, selectedCount - selectedPushableRows.length)}
            title={selectedPushableRows.length ? `KRA Push for ${selectedPushableRows.length} selected row(s)` : 'No selected rows are ready for KRA push'}
            style={{
              padding: '7px 10px',
              fontSize: '0.78rem',
              opacity: bulkPushDisabled ? 0.48 : 1,
              background: bulkPushDisabled ? 'var(--subtle-surface)' : '#16a34a',
              borderColor: bulkPushDisabled ? 'var(--surface-border)' : '#15803d',
              color: bulkPushDisabled ? 'var(--text-muted)' : '#fff',
              boxShadow: bulkPushDisabled ? 'none' : '0 2px 8px rgba(22, 163, 74, 0.28)'
            }}
          >
            {pushingKey === 'batch:cvlkra' ? loadingLabel('cvlkra') : `KRA Push selected (${selectedPushableRows.length})`}
          </button>
          <button className="beta-secondary-btn" onClick={() => onClearSelection(filteredKeys)} disabled={!selectedCount || Boolean(pushingKey)}>
            Clear
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
        <table style={{ width: '100%', minWidth: 1620, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={tableColumnStyles.select}>
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  disabled={!filteredRows.length || Boolean(pushingKey)}
                  onChange={event => onToggleVisibleRows(filteredRows, event.target.checked)}
                  aria-label="Select all visible readiness rows"
                />
              </th>
              <th style={tableColumnStyles.pan}>PAN</th>
              <th style={tableColumnStyles.clientCode}>CC</th>
              <th style={tableColumnStyles.application}>Application</th>
              <th style={tableColumnStyles.name}>Name</th>
              <th style={tableColumnStyles.stage}>Flow</th>
              <th style={{ width: 160 }}>Readiness</th>
              <th style={{ width: 160 }}>KRA Action</th>
              <th style={{ width: 360 }}>Reason</th>
              <th style={{ width: 130 }}>Nominees</th>
              <th style={tableColumnStyles.xml}>XML</th>
              <th style={{ width: 130 }}>Push</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan="12" style={{ textAlign: 'center', padding: 18 }}>No records found.</td></tr>
            ) : filteredRows.map(row => {
              const readiness = row.kraReadiness || getKraReadiness(row);
              const key = getRowKey(row);
              return (
                <tr key={`readiness-${key}`}>
                  <td style={{ ...tableColumnStyles.select, verticalAlign: 'top' }}>
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(key)}
                      disabled={Boolean(pushingKey)}
                      onChange={() => onToggleRow(key)}
                      aria-label={`Select ${row.pan || row.application_id}`}
                    />
                  </td>
                  <td style={{ ...tableColumnStyles.pan, fontFamily: 'monospace', fontWeight: 700, verticalAlign: 'top' }}>{text(row.pan)}</td>
                  <td style={{ ...tableColumnStyles.clientCode, fontFamily: 'monospace', verticalAlign: 'top' }}>{text(row.client_code)}</td>
                  <td style={{ ...tableColumnStyles.application, verticalAlign: 'top' }}>{text(row.application_id)}</td>
                  <td style={{ ...tableColumnStyles.name, verticalAlign: 'top', whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{text(row.client_name)}</td>
                  <td style={{ ...tableColumnStyles.stage, verticalAlign: 'top' }}>{text(row.flow_type)}</td>
                  <td style={{ width: 160, verticalAlign: 'top' }}>{badge(readiness.status)}</td>
                  <td style={{ width: 160, verticalAlign: 'top' }}>{badge(readiness.action)}</td>
                  <td style={{ width: 360, verticalAlign: 'top', whiteSpace: 'normal', overflowWrap: 'anywhere', color: 'var(--text-muted)', fontSize: '0.78rem', lineHeight: 1.35 }}>
                    {readiness.reason}
                  </td>
                  <td style={{ width: 130, verticalAlign: 'top' }}>
                    <NomineeIssueButton row={row} onOpenNominees={onOpenNominees} />
                  </td>
                  <td style={{ ...tableColumnStyles.xml, verticalAlign: 'top' }}>{xmlCell(row)}</td>
                  <td style={{ width: 130, verticalAlign: 'top' }}>{renderPushButton(row)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function Beta() {
  const [filters, setFilters] = useState(blankFilters);
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [pushingKey, setPushingKey] = useState('');
  const [message, setMessage] = useState('');
  const [kraLocalFilter, setKraLocalFilter] = useState('');
  const [digiLocalFilter, setDigiLocalFilter] = useState('');
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [rowOverrides, setRowOverrides] = useState({});
  const [responseCopied, setResponseCopied] = useState(false);
  const [readinessTab, setReadinessTab] = useState('canPush');
  const [readinessFilter, setReadinessFilter] = useState('');
  const [nomineeModal, setNomineeModal] = useState({
    open: false,
    row: null,
    nominees: [],
    summary: null,
    loading: false,
    error: '',
    deletingId: null
  });

  const updateFilter = (key, value) => {
    setFilters(current => ({ ...current, [key]: value }));
  };

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      setEntries([]);
      setSummary({});
      const params = { ...filters, completed: 'true', limit: 500 };
      Object.keys(params).forEach(key => {
        if (params[key] === '') delete params[key];
      });
      const response = await api.getBetaEntries(params);
      const nextEntries = response?.data || [];
      setEntries(nextEntries);
      setSummary(response?.summary || {});
      setSelectedKeys(current => {
        const validKeys = new Set(nextEntries.map(getRowKey));
        return new Set([...current].filter(key => validKeys.has(key)));
      });
      setRowOverrides(current => {
        const next = {};
        nextEntries.forEach(row => {
          const key = getRowKey(row);
          if (current[key] && !isFinalCdslRow(row)) next[key] = current[key];
        });
        return next;
      });
      if (response?.forbidden) setMessage(response.message || 'Admin access required.');
    } catch (error) {
      setMessage(error.message || 'Failed to load beta entries.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const displayEntries = useMemo(
    () => entries
      .map(row => applyRowOverrides(row, rowOverrides))
      .filter(row => !isInternalTestPan(row.pan))
      .filter(row => includesText(row, filters.q)),
    [entries, rowOverrides, filters.q]
  );

  const grouped = useMemo(() => {
    const kra = displayEntries.filter(row => row.flow_type === 'KRA');
    const digilocker = displayEntries.filter(row => row.flow_type === 'DigiLocker');
    return { kra, digilocker };
  }, [displayEntries]);

  const kraActionSummary = useMemo(() => {
    const initial = {
      kraPush: 0,
      docPushOnly: 0,
      kraValid: 0,
      downstreamPush: 0,
      doNotPush: 0,
      checkKra: 0
    };

    return displayEntries.reduce((counts, row) => {
      const action = getKraAction(row).status;
      if (action === 'KRA Push') counts.kraPush += 1;
      else if (action === 'Doc Push only') counts.docPushOnly += 1;
      else if (action === 'Push downstream') counts.downstreamPush += 1;
      else if (action === 'KRA valid') counts.kraValid += 1;
      else if (action === 'Do not push') counts.doNotPush += 1;
      else counts.checkKra += 1;
      return counts;
    }, initial);
  }, [displayEntries]);

  const kraReadinessRows = useMemo(() => {
    const rows = displayEntries.map(row => ({
      ...row,
      kraReadiness: getKraReadiness(row)
    }));

    return {
      canPush: rows.filter(row => row.kraReadiness.canPush),
      cannotPush: rows.filter(row => !row.kraReadiness.canPush)
    };
  }, [displayEntries]);

  const copyKraPans = async () => {
    const pans = grouped.kra.map(row => row.pan).filter(Boolean).join('\n');
    if (!pans) {
      setMessage('No KRA flow PANs available for the current filter.');
      return;
    }
    await navigator.clipboard.writeText(pans);
    setMessage(`Copied ${grouped.kra.length} KRA flow PAN(s).`);
  };

  const copyResponse = async () => {
    if (!message) return;
    await navigator.clipboard.writeText(message);
    setResponseCopied(true);
    window.setTimeout(() => setResponseCopied(false), 1600);
  };

  const copyReadinessPans = async (tab = readinessTab) => {
    const rows = kraReadinessRows[tab] || [];
    const pans = rows.map(row => row.pan).filter(Boolean).join('\n');
    if (!pans) {
      setMessage('No PANs available for this readiness list.');
      return;
    }
    await navigator.clipboard.writeText(pans);
    setMessage(`Copied ${rows.length} ${tab === 'canPush' ? 'pushable' : 'not-ready'} PAN(s).`);
  };

  const openNomineeModal = async (row) => {
    setNomineeModal({
      open: true,
      row,
      nominees: [],
      summary: null,
      loading: true,
      error: '',
      deletingId: null
    });
    try {
      const response = await api.get(`/beta/applications/${row.application_id}/nominees`);
      if (response?.success === false) {
        throw new Error(response.message || response.error || 'Failed to fetch nominee details.');
      }
      setNomineeModal(current => ({
        ...current,
        nominees: response?.data || [],
        summary: response?.summary || null,
        loading: false,
        error: ''
      }));
    } catch (error) {
      setNomineeModal(current => ({
        ...current,
        loading: false,
        error: error.message || 'Failed to fetch nominee details.'
      }));
    }
  };

  const closeNomineeModal = () => {
    setNomineeModal({
      open: false,
      row: null,
      nominees: [],
      summary: null,
      loading: false,
      error: '',
      deletingId: null
    });
  };

  const deleteNomineeFromModal = async (nominee) => {
    const appId = nomineeModal.row?.application_id;
    if (!appId || !nominee?.id) return;
    const nomineeName = nominee.nominee_name || `ID ${nominee.id}`;
    if (!window.confirm(`Delete nominee ${nomineeName} from application ${appId}? Integration statuses will not be changed.`)) return;

    setNomineeModal(current => ({ ...current, deletingId: nominee.id, error: '' }));
    try {
      const response = await api.delete(`/beta/applications/${appId}/nominees/${nominee.id}`);
      if (response?.success === false) {
        throw new Error(response.message || response.error || 'Failed to delete nominee.');
      }
      setNomineeModal(current => ({
        ...current,
        nominees: response?.data || [],
        summary: response?.summary || null,
        deletingId: null,
        error: ''
      }));
      setMessage(JSON.stringify(response, null, 2));
      await loadEntries();
    } catch (error) {
      setNomineeModal(current => ({
        ...current,
        deletingId: null,
        error: error.message || 'Failed to delete nominee.'
      }));
    }
  };

  const toggleRow = (key) => {
    setSelectedKeys(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleVisibleRows = (rowsToToggle, shouldSelect) => {
    setSelectedKeys(current => {
      const next = new Set(current);
      rowsToToggle.forEach(row => {
        const key = getRowKey(row);
        if (shouldSelect) next.add(key);
        else next.delete(key);
      });
      return next;
    });
  };

  const clearSelectedRows = (keysToClear) => {
    setSelectedKeys(current => {
      const next = new Set(current);
      keysToClear.forEach(key => next.delete(key));
      return next;
    });
  };

  const buildBatchPayload = (target, rows) => {
    const applicationIds = rows.map(row => Number(row.application_id)).filter(Boolean);
    const pans = [...new Set(rows.map(row => row.pan).filter(Boolean))];

    if (target === 'cvlkra') {
      return {
        mode: 'process',
        pans,
        applicationIds,
        limit: rows.length,
        forceRepush: true,
        allowNameMismatchUpdate: true
      };
    }

    if (target === 'cvlkra_document') {
      return {
        mode: 'documentUploadOnly',
        applicationIds,
        pans,
        limit: rows.length,
        reconcileFinalStatus: true,
        allowNameMismatchUpdate: true
      };
    }

    if (target === 'cvlkra_status') {
      return {
        mode: 'kraStatus',
        applicationIds,
        pans,
        limit: rows.length
      };
    }

    if (target === 'cdsl_status') {
      return {
        mode: 'uploadedStatus',
        applicationIds,
        pans,
        limit: rows.length,
        minAgeMinutes: 0,
        forceDownload: true
      };
    }

    return {
      mode: 'process',
      applicationIds,
      pans,
      limit: rows.length
    };
  };

  const pushSelected = async (target, rows, skippedCount = 0) => {
    if (!rows.length) return;
    const label = `${pushLabel(target)} for ${rows.length} selected row(s)`;
    const skipText = skippedCount ? ` ${skippedCount} selected row(s) are not eligible and will be skipped.` : '';
    if (!window.confirm(pushConfirmationText(target, rows, label, skippedCount))) return;

    setPushingKey(`batch:${target}`);
    setResponseCopied(false);
    setMessage(`Sending ${label}...${skipText}`);
    try {
      const payload = buildBatchPayload(target, rows);
      const firstRow = rows[0];
      const response = await api.pushBetaEntry({
        target,
        applicationId: firstRow.application_id,
        pan: firstRow.pan,
        payload
      });
      if (target === 'cdsl' || target === 'cdsl_status') {
        setRowOverrides(current => {
          const next = { ...current };
          rows.forEach(row => {
            next[getRowKey(row)] = markCdslWaitingOverride(row);
          });
          return next;
        });
      }
      await loadEntries();
      setMessage(JSON.stringify(response, null, 2));
    } catch (error) {
      setMessage(error.payload ? JSON.stringify(error.payload, null, 2) : (error.message || `Push failed for ${label}.`));
    } finally {
      setPushingKey('');
    }
  };

  const pushRow = async (target, row) => {
    const label = `${row.pan || row.application_id} via ${pushLabel(target)}`;
    if (!window.confirm(pushConfirmationText(target, [row], label))) return;
    const nextPushingKey = `${target}:${row.application_id}:${row.pan || ''}`;
    setPushingKey(nextPushingKey);
    setResponseCopied(false);
    setMessage(`Sending ${label}...`);
    try {
      const payload = target === 'cvlkra'
        ? {
          mode: 'process',
          applicationIds: [row.application_id],
          pans: row.pan ? [row.pan] : [],
          limit: 1,
          forceRepush: true,
          allowNameMismatchUpdate: true
        }
        : target === 'cvlkra_document'
          ? {
            mode: 'documentUploadOnly',
            applicationId: row.application_id,
            reconcileFinalStatus: true,
            allowNameMismatchUpdate: true
          }
          : target === 'cdsl_status'
            ? {
              mode: 'uploadedStatus',
              applicationIds: [row.application_id],
              pans: row.pan ? [row.pan] : [],
              limit: 1,
              minAgeMinutes: 0,
              forceDownload: true
            }
            : undefined;
      const response = await api.pushBetaEntry({
        target,
        applicationId: row.application_id,
        pan: row.pan,
        ...(payload ? { payload } : {})
      });
      if (target === 'cdsl' || target === 'cdsl_status') {
        setRowOverrides(current => ({
          ...current,
          [getRowKey(row)]: markCdslWaitingOverride(row)
        }));
      }
      await loadEntries();
      setMessage(JSON.stringify(response, null, 2));
    } catch (error) {
      setMessage(error.payload ? JSON.stringify(error.payload, null, 2) : (error.message || `Push failed for ${label}.`));
    } finally {
      setPushingKey('');
    }
  };

  return (
    <div className="table-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem' }}>Beta Push Desk</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>PAN, client code, flow type, integration status, and controlled push actions.</p>
        </div>
        <button className="beta-secondary-btn" onClick={copyKraPans}>Copy KRA PANs</button>
      </div>

      <div className="beta-filter-panel">
        <div className="beta-filter-grid">
          <input value={filters.q} onChange={e => updateFilter('q', e.target.value)} placeholder="Search PAN, CC, name, application" />
          <select value={filters.flow} onChange={e => updateFilter('flow', e.target.value)}>
            <option value="">All flows</option>
            <option value="KRA">KRA flow</option>
            <option value="DigiLocker">DigiLocker flow</option>
            <option value="Unknown">Unknown</option>
          </select>
          <input value={filters.cvlkraStatus} onChange={e => updateFilter('cvlkraStatus', e.target.value)} placeholder="CVL KRA status" />
          <input value={filters.currentStage} onChange={e => updateFilter('currentStage', e.target.value)} placeholder="Stage" />
        </div>
        <div className="beta-actions-row">
          <button className="beta-primary-btn" onClick={loadEntries} disabled={loading}>{loading ? 'Loading...' : 'Apply Filter'}</button>
          <button className="beta-secondary-btn" onClick={() => setFilters(blankFilters)}>Reset</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, margin: '16px 0' }}>
        <div className="beta-section"><div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Total</div><strong>{displayEntries.length}</strong></div>
        <div className="beta-section"><div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>KRA Flow</div><strong>{grouped.kra.length}</strong></div>
        <div className="beta-section"><div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>DigiLocker Flow</div><strong>{grouped.digilocker.length}</strong></div>
        <div className="beta-section"><div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Completed</div><strong>{displayEntries.length}</strong></div>
        <div className="beta-section"><div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>KRA Push</div><strong>{kraActionSummary.kraPush}</strong></div>
        <div className="beta-section"><div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Doc Push Only</div><strong>{kraActionSummary.docPushOnly}</strong></div>
        <div className="beta-section"><div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Downstream Push</div><strong>{kraActionSummary.downstreamPush}</strong></div>
        <div className="beta-section"><div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>KRA Valid</div><strong>{kraActionSummary.kraValid}</strong></div>
        <div className="beta-section"><div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Do Not Push</div><strong>{kraActionSummary.doNotPush}</strong></div>
        <div className="beta-section"><div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Can Push Now</div><strong>{kraReadinessRows.canPush.length}</strong></div>
        <div className="beta-section"><div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Cannot Push</div><strong>{kraReadinessRows.cannotPush.length}</strong></div>
      </div>

      {message ? (
        <section className="beta-response-panel">
          <div className="beta-response-header">
            <strong>Response</strong>
            <button className="beta-secondary-btn beta-response-copy-btn" onClick={copyResponse}>
              {responseCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="beta-alert">{message}</pre>
        </section>
      ) : null}

      <KraReadinessPanel
        rowsByTab={kraReadinessRows}
        activeTab={readinessTab}
        onTabChange={setReadinessTab}
        localFilter={readinessFilter}
        onLocalFilter={setReadinessFilter}
        onCopy={copyReadinessPans}
        onPush={pushRow}
        onPushSelected={pushSelected}
        selectedKeys={selectedKeys}
        onToggleRow={toggleRow}
        onToggleVisibleRows={toggleVisibleRows}
        onClearSelection={clearSelectedRows}
        pushingKey={pushingKey}
        onOpenNominees={openNomineeModal}
      />

      <BetaTable
        title="KRA Flow"
        description="Rows classified as direct KRA flow. Use Copy KRA PANs for this list."
        rows={grouped.kra}
        localFilter={kraLocalFilter}
        onLocalFilter={setKraLocalFilter}
        onPush={pushRow}
        onPushSelected={pushSelected}
        pushingKey={pushingKey}
        selectedKeys={selectedKeys}
        onToggleRow={toggleRow}
        onToggleVisibleRows={toggleVisibleRows}
        onClearSelection={clearSelectedRows}
        flowType="KRA"
        onOpenNominees={openNomineeModal}
      />
      <BetaTable
        title="DigiLocker Flow"
        description="Rows where DigiLocker, KYC mode 5, or Aadhaar XML evidence is present."
        rows={grouped.digilocker}
        localFilter={digiLocalFilter}
        onLocalFilter={setDigiLocalFilter}
        onPush={pushRow}
        onPushSelected={pushSelected}
        pushingKey={pushingKey}
        selectedKeys={selectedKeys}
        onToggleRow={toggleRow}
        onToggleVisibleRows={toggleVisibleRows}
        onClearSelection={clearSelectedRows}
        flowType="DigiLocker"
        onOpenNominees={openNomineeModal}
      />

      <NomineeModal
        state={nomineeModal}
        onClose={closeNomineeModal}
        onDelete={deleteNomineeFromModal}
      />
    </div>
  );
}
