const pool = require("./config/db");

const STEP_SEQUENCE = [
  'mobile_verification',
  'email_verification',
  'pan_details',
  'digilocker_details',
  'bank_details',
  'personal_details',
  'nominee_details',
  'live_photo',
  'signature_upload',
  'payment_summary',
  'esign'
];

const STEP_ALIASES = {
  'mobile verification': 'mobile_verification',
  'mobile_verification': 'mobile_verification',
  'contact_details': 'mobile_verification',
  'email verification': 'email_verification',
  'email_verification': 'email_verification',
  'pan number verification': 'pan_details',
  'pan and dob verification': 'pan_details',
  'pan_and_dob': 'pan_details',
  'pan_details': 'pan_details',
  'digilocker': 'digilocker_details',
  'digilocker_details': 'digilocker_details',
  'kra_details': 'digilocker_details',
  'kra_or_digilocker': 'digilocker_details',
  'bank details': 'bank_details',
  'bank_details': 'bank_details',
  'personal details': 'personal_details',
  'personal_details': 'personal_details',
  'nominee details': 'nominee_details',
  'nominee_details': 'nominee_details',
  'live image': 'live_photo',
  'live photo': 'live_photo',
  'live_photo': 'live_photo',
  'signature upload': 'signature_upload',
  'signature': 'signature_upload',
  'signature_upload': 'signature_upload',
  'payment summary': 'payment_summary',
  'scheme selection': 'payment_summary',
  'payment': 'payment_summary',
  'payment_summary': 'payment_summary',
  'pdf generation': 'pdf_generation',
  'pdf_generation': 'pdf_generation',
  'esign': 'esign',
  'e sign': 'esign'
};

const STEP_TO_STAGE_CODE = {
  mobile_verification: 'MOBILE_VERIFICATION',
  email_verification: 'EMAIL_VERIFICATION',
  pan_details: 'PAN_DOB_VERIFICATION',
  digilocker_details: 'DIGILOCKER_DETAILS',
  bank_details: 'BANK_DETAILS',
  personal_details: 'PERSONAL_DETAILS',
  nominee_details: 'NOMINEE_DETAILS',
  live_photo: 'LIVE_PHOTO',
  signature_upload: 'SIGNATURE',
  payment_summary: 'PAYMENT',
  pdf_generation: 'PDF_GENERATION',
  esign: 'ESIGN'
};

function normalizeStepValue(step) {
  return String(step || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveJourneyStep(step) {
  const normalized = normalizeStepValue(step);
  return STEP_ALIASES[normalized] || null;
}

function getStepIndex(step) {
  const resolved = resolveJourneyStep(step);
  return resolved ? STEP_SEQUENCE.indexOf(resolved) : -1;
}

function getAdjacentStep(step, direction) {
  const idx = getStepIndex(step);
  if (idx < 0) return null;
  if (direction === 'previous') {
    return STEP_SEQUENCE[Math.max(0, idx - 1)];
  }
  return STEP_SEQUENCE[Math.min(STEP_SEQUENCE.length - 1, idx + 1)];
}

function getStageCode(step) {
  const resolved = resolveJourneyStep(step);
  return STEP_TO_STAGE_CODE[resolved] || 'MANUAL_STEP_CHANGE';
}

function getIdentifier(req) {
  return req.params.applicationId || req.params.clientCode || req.body.application_id || req.body.client_code || null;
}

async function findApplicationContext(identifier) {
  if (!identifier) return null;

  const result = await pool.query(
    `SELECT
       ka.id AS application_id,
       COALESCE(cc.client_code, ka.client_code) AS client_code,
       ka.current_step,
       ka.kyc_status
     FROM public.kyc_applications ka
     LEFT JOIN public.contact_details cd ON cd.application_id = ka.id
     LEFT JOIN public.client_codes cc ON cc.email = cd.email
     WHERE ka.id::text = $1
        OR COALESCE(cc.client_code, ka.client_code) = $1
     ORDER BY ka.id DESC
     LIMIT 1`,
    [String(identifier)]
  );

  return result.rows[0] || null;
}

function getUserContext(req) {
  return {
    user_name: req.body.user_name || req.body.moved_by || req.user?.username || 'system',
    user_role: req.body.user_role || req.user?.role || 'User'
  };
}

function buildAuditPayload(actionType, currentStep, targetStep, remarks, req) {
  const user = getUserContext(req);
  const now = new Date();
  return {
    action_type: actionType,
    previous_step: currentStep,
    selected_step: targetStep,
    remarks: remarks || '',
    user_name: user.user_name,
    user_role: user.user_role,
    client_id: req.body.client_id || req.body.application_id || req.params.applicationId || null,
    client_code: req.body.client_code || req.params.clientCode || null,
    date: now.toISOString().slice(0, 10),
    time: now.toTimeString().slice(0, 8)
  };
}

async function writeAuditLog(context, actionType, currentStep, targetStep, remarks, req) {
  const payload = buildAuditPayload(actionType, currentStep, targetStep, remarks, req);
  const stageCode = getStageCode(targetStep || currentStep);

  try {
    await pool.query(
      `INSERT INTO public.kyc_stage_audit_logs (
         application_id, client_code, stage_code, previous_status, new_status, updated_by, error_message
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        context.application_id,
        context.client_code,
        stageCode,
        currentStep || null,
        targetStep || null,
        payload.user_name,
        JSON.stringify(payload)
      ]
    );
  } catch (error) {
    console.error("Failed to write journey audit log:", error);
  }
}

async function updateJourneyStep(req, res, actionType, defaultDirection) {
  const identifier = getIdentifier(req);
  const remarks = (req.body.remarks || req.body.reason || req.body.skip_reason || '').trim();
  const moveDirection = (req.body.move_direction || req.body.direction || defaultDirection || 'next').toLowerCase();

  if (!identifier) {
    return res.status(400).json({ success: false, message: "Application ID or client code is required" });
  }

  const context = await findApplicationContext(identifier);
  if (!context) {
    return res.status(404).json({ success: false, message: "Client not found" });
  }

  const currentStep = resolveJourneyStep(req.body.current_step_key || req.body.current_step || context.current_step);
  const requestedStep = resolveJourneyStep(
    req.body.selected_step_key ||
    req.body.new_step_key ||
    req.body.selected_step ||
    req.body.new_step ||
    ''
  );

  const targetStep = requestedStep || getAdjacentStep(currentStep || context.current_step, moveDirection);

  if (!targetStep) {
    return res.status(400).json({ success: false, message: "Unable to determine target step" });
  }

  const client = await pool.connect();
  let actionSucceeded = false;

  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE public.kyc_applications
       SET current_step = $1,
           kyc_status = 'in_progress',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [targetStep, context.application_id]
    );

    if (actionType === 'payment_skip' && !requestedStep) {
      const paymentCheck = await client.query('SELECT 1 FROM public.payments_details WHERE application_id = $1', [context.application_id]);
      if (paymentCheck.rowCount > 0) {
        await client.query(
          `UPDATE public.payments_details
           SET payment_status = 'skipped',
               skipped_by = $2,
               skipped_at = CURRENT_TIMESTAMP,
               skip_reason = $3
           WHERE application_id = $1`,
          [context.application_id, getUserContext(req).user_name, remarks]
        );
      } else {
        await client.query(
          `INSERT INTO public.payments_details (application_id, payment_status, skipped_by, skipped_at, skip_reason)
           VALUES ($1, 'skipped', $2, CURRENT_TIMESTAMP, $3)`,
          [context.application_id, getUserContext(req).user_name, remarks]
        );
      }
    }

    await client.query('COMMIT');
    actionSucceeded = true;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Journey update failed:", error);
    return res.status(500).json({
      success: false,
      message: "Journey update failed",
      error: error.message
    });
  } finally {
    client.release();
  }

  if (actionSucceeded) {
    await writeAuditLog(context, actionType, context.current_step, targetStep, remarks, req);
  }

  return res.status(200).json({
    success: true,
    message: "Journey step updated successfully",
    application_id: context.application_id,
    client_code: context.client_code,
    previous_step: context.current_step,
    new_step: targetStep,
    action_type: actionType
  });
}

const skipPaymentAction = (req, res) => updateJourneyStep(req, res, 'payment_skip', 'next');
const stepBackAction = (req, res) => updateJourneyStep(req, res, 'step_back', 'previous');
const changeStepAction = (req, res) => updateJourneyStep(req, res, 'change_client_step', 'next');

module.exports = {
  skipPaymentAction,
  stepBackAction,
  changeStepAction
};
