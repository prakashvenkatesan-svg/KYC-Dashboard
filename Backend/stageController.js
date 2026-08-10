const pool = require("./config/db");

const DEFAULT_STAGES = [
  { code: 'MOBILE_VERIFICATION', name: 'Mobile Verification', order: 1 },
  { code: 'EMAIL_VERIFICATION', name: 'Email Verification', order: 2 },
  { code: 'PAN_DOB_VERIFICATION', name: 'PAN and DOB Verification', order: 3 },
  { code: 'BANK_DETAILS', name: 'Bank Details', order: 4 },
  { code: 'PERSONAL_DETAILS', name: 'Personal Details', order: 5 },
  { code: 'NOMINEE_DETAILS', name: 'Nominee Details', order: 6 },
  { code: 'LIVE_PHOTO', name: 'Live Photo', order: 7 },
  { code: 'SIGNATURE', name: 'Signature', order: 8 },
  { code: 'SCHEME_SELECTION', name: 'Scheme Selection', order: 9 },
  { code: 'PAYMENT', name: 'Payment', order: 10 },
  { code: 'PDF_GENERATION', name: 'PDF Generation', order: 11 },
  { code: 'ESIGN', name: 'eSign', order: 12 }
];

const getKycProgress = async (req, res) => {
  try {
    const { clientCode } = req.params;

    // First check if the application exists and get its ID
    const appQuery = await pool.query(
      `SELECT ka.id as application_id, tech."Client_Name"
       FROM public.kyc_applications ka
       LEFT JOIN public.techexcel tech ON tech."Client_id" = $1
       WHERE tech."Client_id" = $1 LIMIT 1`,
      [clientCode]
    );

    if (appQuery.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }

    const applicationId = appQuery.rows[0].application_id;

    // Use our new dynamic view to fetch the status!
    const viewQuery = await pool.query(
      `SELECT * FROM public.kyc_overall_status_vw WHERE application_id = $1`,
      [applicationId]
    );

    const viewData = viewQuery.rows.length > 0 ? viewQuery.rows[0] : null;

    if (!viewData) {
      return res.status(404).json({ success: false, message: "Could not calculate KYC progress" });
    }
    
    // Instead of querying `kyc_stage_status`, we will run the dynamic checks manually here
    // to build the array of 12 stages, just like the View does!
    
    // 1. Mobile
    const mobileQ = await pool.query(`SELECT 1 FROM public.otp_sessions o LEFT JOIN public.contact_details cd ON cd.mobile_number = o.mobile_number WHERE cd.application_id = $1 AND o.is_verified = true`, [applicationId]);
    // 2. Email
    const emailQ = await pool.query(`SELECT 1 FROM public.email_otp_sessions e LEFT JOIN public.contact_details cd ON cd.email = e.email WHERE cd.application_id = $1 AND e.is_verified = true`, [applicationId]);
    // 3. PAN
    const panQ = await pool.query(`SELECT 1 FROM public.identity_verifications p WHERE p.application_id = $1 AND p.pan_verified = true`, [applicationId]);
    // 4. Bank
    const bankQ = await pool.query(`SELECT 1 FROM public.bank_details b WHERE b.application_id = $1`, [applicationId]);
    // 5. Personal
    const personalQ = await pool.query(`SELECT 1 FROM public.personal_details pd WHERE pd.application_id = $1`, [applicationId]);
    // 6. Nominee
    const nomineeQ = await pool.query(`SELECT 1 FROM public.nominee_details nd WHERE nd.application_id = $1`, [applicationId]);
    // 7. Live Photo
    const photoQ = await pool.query(`SELECT 1 FROM public.applicant_photo_uploads pu WHERE pu.application_id = $1`, [applicationId]);
    // 8. Signature
    const sigQ = await pool.query(`SELECT 1 FROM public.signature_uploads su WHERE su.application_id = $1`, [applicationId]);
    // 10. Payment
    const payQ = await pool.query(`SELECT 1 FROM public.payments_details pay WHERE pay.application_id = $1 AND (pay.payment_status ILIKE 'success' OR pay.payment_bypass_allowed = true OR pay.payment_status ILIKE 'completed')`, [applicationId]);
    // 11. PDF
    const pdfQ = await pool.query(`SELECT 1 FROM public.application_compliance_documents doc WHERE doc.application_id = $1`, [applicationId]);
    // 12. eSign
    const esignQ = await pool.query(`SELECT 1 FROM public.kyc_applications ka WHERE ka.id = $1 AND ka.current_step = 'esign' AND ka.kyc_status = 'completed'`, [applicationId]);

    const isDone = (q) => q.rows.length > 0 ? 'completed' : 'pending';

    const rawStages = {
      'MOBILE_VERIFICATION': isDone(mobileQ),
      'EMAIL_VERIFICATION': isDone(emailQ),
      'PAN_DOB_VERIFICATION': isDone(panQ),
      'BANK_DETAILS': isDone(bankQ),
      'PERSONAL_DETAILS': isDone(personalQ),
      'NOMINEE_DETAILS': isDone(nomineeQ),
      'LIVE_PHOTO': isDone(photoQ),
      'SIGNATURE': isDone(sigQ),
      'PAYMENT': isDone(payQ),
      'SCHEME_SELECTION': isDone(payQ), // Derived from payment
      'PDF_GENERATION': isDone(pdfQ),
      'ESIGN': isDone(esignQ)
    };

    // Calculate "Current Stage" logically: the first stage that is NOT completed
    let calculatedCurrentStage = 'Completed';
    let overallStatus = 'in_progress';
    let completedCount = 0;
    
    // Check in exact order
    const stages = DEFAULT_STAGES.map(ds => {
      const status = rawStages[ds.code];
      if (status === 'completed') {
        completedCount++;
      } else if (calculatedCurrentStage === 'Completed') {
        calculatedCurrentStage = ds.name;
      }
      return {
        stageCode: ds.code,
        stageName: ds.name,
        status: status
      };
    });
    
    if (completedCount === 0) overallStatus = 'not_started';
    if (completedCount === 12) overallStatus = 'completed';

    res.json({
      success: true,
      clientCode,
      overallStatus: overallStatus,
      currentStage: calculatedCurrentStage,
      completedStages: completedCount,
      totalStages: 12,
      progressPercentage: Math.round((completedCount / 12) * 100),
      stages
    });

  } catch (error) {
    console.error("Error fetching KYC progress:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const updateStageStatus = async (req, res) => {
  const client = await pool.connect();
  try {
    const { applicationId, stageCode } = req.params;
    const { stageStatus, stageSource, errorCode, errorMessage, metadata } = req.body;
    
    // Auth user making this request (can be system or an admin)
    const updatedBy = req.user ? req.user.email : 'system';

    const stageDef = DEFAULT_STAGES.find(s => s.code === stageCode);
    if (!stageDef) {
      return res.status(400).json({ success: false, message: "Invalid stage code" });
    }

    await client.query('BEGIN');

    // Get current status to check for transitions
    const currentQuery = await client.query(
      `SELECT stage_status, client_code FROM public.kyc_stage_status WHERE application_id = $1 AND stage_code = $2`,
      [applicationId, stageCode]
    );

    let previousStatus = null;
    let clientCode = null;

    if (currentQuery.rows.length > 0) {
      previousStatus = currentQuery.rows[0].stage_status;
      clientCode = currentQuery.rows[0].client_code;
    } else {
      // Need to get client code from techexcel
      const ccQuery = await client.query(
        `SELECT tech."Client_id" FROM public.kyc_applications ka
         LEFT JOIN public.techexcel tech ON tech."Client_Name" IS NOT NULL
         WHERE ka.id = $1 LIMIT 1`,
        [applicationId]
      );
      if (ccQuery.rows.length > 0) clientCode = ccQuery.rows[0].Client_id;
    }

    // Set dates
    let startedAt = null;
    let completedAt = null;
    
    if (!previousStatus && stageStatus === 'in_progress') {
      startedAt = new Date();
    }
    if (['completed', 'skipped', 'bypass_approved', 'success'].includes(stageStatus)) {
      completedAt = new Date();
    }

    // Upsert stage status
    await client.query(
      `INSERT INTO public.kyc_stage_status (
          application_id, client_code, stage_code, stage_name, stage_order, 
          stage_status, stage_source, started_at, completed_at, 
          error_code, error_message, updated_by, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (application_id, stage_code) 
       DO UPDATE SET 
          stage_status = EXCLUDED.stage_status,
          stage_source = COALESCE(EXCLUDED.stage_source, kyc_stage_status.stage_source),
          completed_at = COALESCE(EXCLUDED.completed_at, kyc_stage_status.completed_at),
          last_updated_at = CURRENT_TIMESTAMP,
          error_code = EXCLUDED.error_code,
          error_message = EXCLUDED.error_message,
          retry_count = CASE WHEN EXCLUDED.stage_status = 'failed' THEN kyc_stage_status.retry_count + 1 ELSE kyc_stage_status.retry_count END,
          updated_by = EXCLUDED.updated_by,
          metadata = EXCLUDED.metadata`,
      [
        applicationId, clientCode, stageCode, stageDef.name, stageDef.order,
        stageStatus, stageSource, startedAt, completedAt, 
        errorCode, errorMessage, updatedBy, metadata ? JSON.stringify(metadata) : null
      ]
    );

    // Insert audit log
    await client.query(
      `INSERT INTO public.kyc_stage_audit_logs (
          application_id, client_code, stage_code, previous_status, new_status, updated_by, error_message
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [applicationId, clientCode, stageCode, previousStatus, stageStatus, updatedBy, errorMessage]
    );

    await client.query('COMMIT');

    res.json({ success: true, message: "Stage updated successfully" });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error updating stage status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};

module.exports = {
  getKycProgress,
  updateStageStatus,
  DEFAULT_STAGES
};
