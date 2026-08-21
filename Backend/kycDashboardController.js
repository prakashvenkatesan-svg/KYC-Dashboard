const pool = require("./config/db");
const {
  getDashboardSummaryQuery,
  getClientsListBaseQuery,
  getClientIntegrationDetailsQuery,
  getClientIntegrationDetailsByIdQuery,
  getClientKycStagesQuery,
  getClientKycOverallStatusQuery,
  getClientKycFullDetailsQuery,
  getPaymentsListBaseQuery
} = require("./kycDashboardQueries"); // assuming it's in the same folder
const { generateGenericPresignedUrl, generatePresignedPdfUrl } = require("./s3Service");

const normalizeStatus = (status) => {
  if (!status) return 'Pending'; // Default if null
  const s = status.trim().toUpperCase();
  if (['SUCCESS', 'S'].includes(s)) return 'Success';
  if (['PENDING', 'P'].includes(s)) return 'Pending';
  if (['REJECTED', 'R'].includes(s)) return 'Rejected';
  if (['FAILED', 'F'].includes(s)) return 'Failed';
  
  // If it's already properly cased or unrecognized, return capitalized
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
};

const normalizeStageFilterValue = (value) => String(value || '')
  .toLowerCase()
  .replace(/\(.*?\)/g, '')
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const normalizeKycStatusFilterValue = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '_');

const applyClientDetailMasking = (payload, isAdmin) => {
  if (isAdmin || !payload) return;

  const maskPan = (pan) => pan ? pan.substring(0, 2) + '******' + pan.substring(8) : null;
  const maskEmail = (email) => {
    if (!email) return null;
    const [name, domain] = email.split('@');
    if (!domain) return email;
    return name.substring(0, 2) + '***@' + domain;
  };
  const maskMobile = (mob) => mob ? '******' + mob.substring(6) : null;
  const maskAccount = (acc) => acc ? '******' + acc.slice(-4) : null;

  if (payload.application) {
    payload.application.pan_number = maskPan(payload.application.pan_number);
    payload.application.email = maskEmail(payload.application.email);
    payload.application.mobile_number = maskMobile(payload.application.mobile_number);
  }

  if (payload.pan_number) payload.pan_number = maskPan(payload.pan_number);
  if (payload.email) payload.email = maskEmail(payload.email);
  if (payload.mobile_number) payload.mobile_number = maskMobile(payload.mobile_number);

  if (payload.stages?.mobile_verification) payload.stages.mobile_verification.mobile_number = maskMobile(payload.stages.mobile_verification.mobile_number);
  if (payload.stages?.email_verification) payload.stages.email_verification.email_id = maskEmail(payload.stages.email_verification.email_id);
  if (payload.stages?.pan_and_dob) payload.stages.pan_and_dob.pan_number = maskPan(payload.stages.pan_and_dob.pan_number);
  if (payload.stages?.kra_or_digilocker) {
    payload.stages.kra_or_digilocker.mobile = maskMobile(payload.stages.kra_or_digilocker.mobile);
    payload.stages.kra_or_digilocker.email_id = maskEmail(payload.stages.kra_or_digilocker.email_id);
  }
  if (payload.stages?.bank_details) {
    payload.stages.bank_details.account_number = maskAccount(payload.stages.bank_details.account_number);
    payload.stages.bank_details.confirm_account_number = maskAccount(payload.stages.bank_details.confirm_account_number);
  }
};

const getDashboardSummary = async (req, res) => {
  try {
    const result = await pool.query(getDashboardSummaryQuery);
    
    // Process results into a dictionary by integration name
    const summaryData = {};
    result.rows.forEach(row => {
      summaryData[row.integration] = {
        total: parseInt(row.total) || 0,
        success: parseInt(row.success) || 0,
        pending: parseInt(row.pending) || 0,
        rejected: parseInt(row.rejected) || 0
      };
    });

    return res.status(200).json({
      success: true,
      message: "Dashboard summary fetched successfully",
      data: summaryData
    });
  } catch (error) {
    console.error("Get dashboard summary error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching dashboard summary",
      error: error.message
    });
  }
};

const getClients = async (req, res) => {
  try {
    const isExportMode = String(req.query.isExport || 'false').toLowerCase() === 'true';
    const {
      q = "",
      integration = "",
      status = "",
      currentStage = "",
      fromDate = "",
      toDate = "",
      sortBy = "application_date",
      sortOrder = "desc",
      limit = "20",
      offset = "0"
    } = req.query;

    const parsedLimit = isExportMode
      ? Math.min(Math.max(parseInt(limit, 10) || 5000, 1), 50000)
      : Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    const conditions = [];
    const params = [];

    if (q.trim()) {
      params.push(`%${q.trim()}%`);
      const idx = params.length;
      conditions.push(`
        (
          cc.client_code ILIKE $${idx}
          OR ka.client_code ILIKE $${idx}
          OR iv.pan_number ILIKE $${idx}
          OR cvl.app_pan_no ILIKE $${idx}
          OR cd.email ILIKE $${idx}
          OR cd.mobile_number ILIKE $${idx}
          OR iv.full_name ILIKE $${idx}
          OR digi.name ILIKE $${idx}
        )
      `);
    }

    if (integration && status) {
      // Dynamic filtering based on integration name and status
      const validIntegrations = {
        'nse': 'nse.nse_push_status',
        'bse': 'bse.bse_status',
        'cvlkra': 'cvl.sync_status',
        'cdsl': 'cdsl.cdsl_push_status',
        'techexcel': 'tech.techexcel_push_status'
      };

      const column = validIntegrations[integration.toLowerCase()];
      if (column) {
        // Status mapping to cover multiple variations like 'S', 'SUCCESS', etc.
        const s = status.toUpperCase();
        let statusList = [];
        if (s === 'SUCCESS') statusList = ['Success', 'SUCCESS', 'S'];
        else if (s === 'PENDING') statusList = ['Pending', 'PENDING', 'P'];
        else if (s === 'REJECTED') statusList = ['Rejected', 'REJECTED', 'R', 'Failed', 'FAILED', 'F'];
        else if (s === 'FAILED') statusList = ['Failed', 'FAILED', 'F', 'Rejected', 'REJECTED', 'R'];
        
        if (statusList.length > 0) {
          const placeholders = statusList.map((st) => {
            params.push(st);
            return `$${params.length}`;
          });
          conditions.push(`${column} IN (${placeholders.join(',')})`);
        }
      }
    }

    const requestedKycStatus = normalizeKycStatusFilterValue(req.query.kyc_status || req.query.kycStatus);
    if (requestedKycStatus) {
      params.push(requestedKycStatus);
      conditions.push(`LOWER(COALESCE(ka.kyc_status, '')) = $${params.length}`);
    }

    // Stage filter
    if (currentStage && currentStage.trim()) {
      const stageMap = {
        'mobile verification': 'contact_details',
        'email verification': 'email_verification',
        'pan and dob verification': 'pan_details',
        'bank details': 'bank_details',
        'personal details': 'personal_details',
        'nominee details': 'nominee_details',
        'live photo': 'live_photo',
        'signature': 'signature',
        'scheme selection': 'scheme_selection',
        'payment': 'payment',
        'pdf generation': 'pdf_generation',
        'esign': 'esign'
      };
      const normalizedCurrentStage = normalizeStageFilterValue(currentStage);
      const dbStageValue = stageMap[normalizedCurrentStage] || normalizedCurrentStage;
      params.push(`%${dbStageValue.replace(/[_-]+/g, ' ')}%`);
      conditions.push(`LOWER(REPLACE(REPLACE(COALESCE(ka.current_step, ''), '_', ' '), '-', ' ')) ILIKE LOWER($${params.length})`);
    }

    // Date range filter
    if (fromDate && fromDate.trim()) {
      params.push(fromDate);
      conditions.push(`ka.created_at::date >= $${params.length}::date`);
    }
    if (toDate && toDate.trim()) {
      params.push(toDate);
      conditions.push(`ka.created_at::date <= $${params.length}::date`);
    }

    let query = getClientsListBaseQuery;

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    // Sort by
    const validSortCols = { 'application_date': 'ka.created_at', 'client_code': 'cc.client_code' };
    const orderCol = validSortCols[sortBy] || 'ka.created_at';
    const orderDir = sortOrder === 'asc' ? 'ASC' : 'DESC';
    params.push(parsedLimit, parsedOffset);
    query += ` ORDER BY ${orderCol} ${orderDir} NULLS LAST LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(query, params);

    // Normalize statuses in the result
    const mappedRows = result.rows.map(row => {
      row.nse_push_status = normalizeStatus(row.nse_push_status);
      row.bse_push_status = normalizeStatus(row.bse_push_status);
      row.cvlkra_sync_status = normalizeStatus(row.cvlkra_sync_status);
      row.cdsl_push_status = normalizeStatus(row.cdsl_push_status);
      row.techexcel_push_status = normalizeStatus(row.techexcel_push_status);
      return row;
    });

    // Count query — use same joins and conditions but no LIMIT/OFFSET
    let countQuery = `SELECT COUNT(*) FROM public.kyc_applications ka 
                      LEFT JOIN public.contact_details cd ON cd.application_id = ka.id
                      LEFT JOIN public.client_codes cc ON cc.email = cd.email
                      LEFT JOIN public.identity_verifications iv ON iv.application_id = ka.id
                      LEFT JOIN public.digilocker_details digi ON digi.application_id = ka.id::text
                      LEFT JOIN public.nse_data nse ON nse.application_id = ka.id
                      LEFT JOIN public.bse_data bse ON bse.application_id = ka.id
                      LEFT JOIN public.cvlkra_data cvl ON cvl.application_id = ka.id
                      LEFT JOIN public.cdsl_data cdsl ON cdsl.application_id = ka.id
                      LEFT JOIN public.techexcel tech ON tech."Client_id" = ka.client_code`;
    
    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(" AND ")}`;
    }
    
    const countParams = params.slice(0, params.length - 2); // remove limit and offset params
    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count) || 0;

    return res.status(200).json({
      success: true,
      message: "Clients fetched successfully",
      data: mappedRows,
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        total: totalCount
      }
    });
  } catch (error) {
    console.error("Get clients error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching clients",
      error: error.message
    });
  }
};

const getClientByCode = async (req, res) => {
  try {
    const clientCode = req.params.clientCode;

    if (!clientCode) {
      return res.status(400).json({
        success: false,
        message: "Client code is required"
      });
    }

    const result = await pool.query(getClientIntegrationDetailsQuery, [clientCode]);

    const payload = result.rows[0]?.data;

    if (!payload) {
      return res.status(404).json({
        success: false,
        message: "Client not found"
      });
    }

    applyClientDetailMasking(payload, req.user && req.user.role === 'Admin');

    // Normalize statuses
    if (payload.nse) payload.nse.status = normalizeStatus(payload.nse.status);
    if (payload.bse) payload.bse.status = normalizeStatus(payload.bse.status);
    if (payload.cvlkra) payload.cvlkra.status = normalizeStatus(payload.cvlkra.status);
    if (payload.cdsl) payload.cdsl.status = normalizeStatus(payload.cdsl.status);
    if (payload.techexcel) payload.techexcel.status = normalizeStatus(payload.techexcel.status);

    return res.status(200).json({
      success: true,
      message: "Client details fetched successfully",
      data: payload
    });
  } catch (error) {
    console.error("Get client detail error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching client detail",
      error: error.message
    });
  }
};

const convertPathsToPresignedUrls = async (obj) => {
  if (!obj) return;
  if (Array.isArray(obj)) {
    await Promise.all(obj.map(item => convertPathsToPresignedUrls(item)));
    return;
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && v.includes('/uploads/')) {
         obj[k] = await generateGenericPresignedUrl(v) || v;
      } else if (typeof v === 'object' && v !== null) {
         await convertPathsToPresignedUrls(v);
      }
    }
  }
};

const getClientById = async (req, res) => {
  try {
    const appId = req.params.applicationId;

    if (!appId) {
      return res.status(400).json({ success: false, message: "Application ID is required" });
    }

    const [integrationResult, detailsResult] = await Promise.all([
      pool.query(getClientIntegrationDetailsByIdQuery, [appId]),
      pool.query(getClientKycFullDetailsQuery, [appId])
    ]);

    const intData = integrationResult.rows[0]?.data;
    let payload = detailsResult.rows[0]?.data;

    if (!payload && !intData) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }

    if (!payload) payload = { application: {}, stages: {} };

    // Convert all /uploads/ paths to AWS S3 Presigned URLs recursively!
    await convertPathsToPresignedUrls(payload.stages);

    // Attach dynamically generated signed PDF URL if it exists
    const pan = payload.pan_number || payload.application?.pan_number;
    if (pan) {
      const pdfData = await generatePresignedPdfUrl(pan);
      if (pdfData && pdfData.signedPdfUrl) {
        if (!payload.stages) payload.stages = {};
        if (!payload.stages.esign) payload.stages.esign = {};
        if (!payload.stages.esign.audit_log) payload.stages.esign.audit_log = {};
        payload.stages.esign.audit_log.document_url = pdfData.signedPdfUrl;
      }
    }

    // Create integrations object
    payload.integrations = {
      nse: intData?.nse ? { ...intData.nse, status: normalizeStatus(intData.nse.status) } : { status: 'NOT_STARTED' },
      bse: intData?.bse ? { ...intData.bse, status: normalizeStatus(intData.bse.status) } : { status: 'NOT_STARTED' },
      cvlkra: intData?.cvlkra ? { ...intData.cvlkra, status: normalizeStatus(intData.cvlkra.status) } : { status: 'NOT_STARTED' },
      cdsl: intData?.cdsl ? { ...intData.cdsl, status: normalizeStatus(intData.cdsl.status) } : { status: 'NOT_STARTED' },
      techexcel: intData?.techexcel ? { ...intData.techexcel, status: normalizeStatus(intData.techexcel.status) } : { status: 'NOT_STARTED' }
    };

    applyClientDetailMasking(payload, req.user && req.user.role === 'Admin');

    return res.status(200).json({ success: true, message: "Client details fetched successfully", data: payload });
  } catch (error) {
    console.error("Get client by ID error:", error);
    return res.status(500).json({ success: false, message: "Server error: " + error.message });
  }
};

const getClientKycStages = async (req, res) => {
  try {
    const appId = req.params.applicationId;
    if (!appId) return res.status(400).json({ success: false, message: "Application ID is required" });

    const [stagesResult, overallResult] = await Promise.all([
      pool.query(getClientKycStagesQuery, [appId]),
      pool.query(getClientKycOverallStatusQuery, [appId])
    ]);

    const stages = stagesResult.rows;
    const overall = overallResult.rows[0] || { overallStatus: 'not_started', progressPercentage: 0 };

    return res.status(200).json({
      success: true,
      stages: stages,
      overallStatus: overall.overallStatus,
      progressPercentage: overall.progressPercentage
    });
  } catch (error) {
    console.error("Get KYC stages error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

const getIntegrationRecords = async (req, res) => {
    req.query.integration = req.params.integrationName;
    return getClients(req, res);
};

const getPayments = async (req, res) => {
  try {
    const {
      clientName = "",
      mobileNumber = "",
      txnId = "",
      paymentStatus = "",
      fromDate = "",
      toDate = "",
      sortBy = "payment_date",
      sortOrder = "desc",
      limit = "20",
      offset = "0",
      isExport = "false"
    } = req.query;

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 5000);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
    const isExportMode = String(isExport).toLowerCase() === 'true';
    const amountNumericExpr = `NULLIF(regexp_replace(pd.amount::text, '[^0-9.-]', '', 'g'), '')::numeric`;
    const statusNormalizedExpr = `LOWER(TRIM(COALESCE(pd.payment_status, '')))`;
    const defaultPaymentStartDate = '2026-07-19';

    const conditions = [];
    const params = [];

    if (clientName.trim()) {
      params.push(`%${clientName.trim()}%`);
      conditions.push(`
        (
          iv.full_name ILIKE $${params.length}
          OR digi.name ILIKE $${params.length}
          OR cvl.app_name ILIKE $${params.length}
          OR tech."Client_Name" ILIKE $${params.length}
        )
      `);
    }

    if (mobileNumber.trim()) {
      params.push(`%${mobileNumber.trim()}%`);
      conditions.push(`cd.mobile_number ILIKE $${params.length}`);
    }

    if (txnId.trim()) {
      params.push(`%${txnId.trim()}%`);
      conditions.push(`pd.txnid ILIKE $${params.length}`);
    }

    if (paymentStatus.trim()) {
      const s = paymentStatus.toUpperCase();
      let statusList = [];
      if (s === 'SUCCESS') statusList = ['success', 's'];
      else if (s === 'PENDING') statusList = ['pending', 'p'];
      else if (s === 'REJECTED' || s === 'FAILED') statusList = ['rejected', 'failed', 'r', 'f'];
      
      if (statusList.length > 0) {
        const placeholders = statusList.map((st) => {
          params.push(st);
          return `$${params.length}`;
        });
        conditions.push(`LOWER(TRIM(COALESCE(pd.payment_status, ''))) IN (${placeholders.join(',')})`);
      }
    }

    if (fromDate && fromDate.trim()) {
      params.push(fromDate);
      conditions.push(`pd.created_at::date >= $${params.length}::date`);
    }
    if (toDate && toDate.trim()) {
      params.push(toDate);
      conditions.push(`pd.created_at::date <= $${params.length}::date`);
    }

    if (!fromDate.trim() && !toDate.trim()) {
      params.push(defaultPaymentStartDate);
      conditions.push(`pd.created_at::date >= $${params.length}::date`);
    }

    let query = getPaymentsListBaseQuery;
    let whereClause = "";

    if (conditions.length > 0) {
      whereClause = ` WHERE ${conditions.join(" AND ")}`;
      query += whereClause;
    }

    const validSortCols = { 'payment_date': 'pd.created_at', 'amount': amountNumericExpr };
    const orderCol = validSortCols[sortBy] || 'pd.created_at';
    const orderDir = sortOrder === 'asc' ? 'ASC' : 'DESC';
    
    const aggQuery = `
      SELECT 
        COUNT(*) as total_count, 
        COALESCE(SUM(COALESCE(${amountNumericExpr}, 0)), 0) as total_amount,
        COUNT(*) FILTER (WHERE ${statusNormalizedExpr} IN ('success', 's')) as success_count,
        COALESCE(SUM(COALESCE(${amountNumericExpr}, 0)) FILTER (WHERE ${statusNormalizedExpr} IN ('success', 's')), 0) as success_amount,
        COUNT(*) FILTER (WHERE ${statusNormalizedExpr} IN ('pending', 'p')) as pending_count,
        COALESCE(SUM(COALESCE(${amountNumericExpr}, 0)) FILTER (WHERE ${statusNormalizedExpr} IN ('pending', 'p')), 0) as pending_amount,
        COUNT(*) FILTER (WHERE ${statusNormalizedExpr} IN ('failed', 'f')) as failed_count,
        COALESCE(SUM(COALESCE(${amountNumericExpr}, 0)) FILTER (WHERE ${statusNormalizedExpr} IN ('failed', 'f')), 0) as failed_amount
      FROM public.payments_details pd
      LEFT JOIN public.kyc_applications ka ON ka.id = pd.application_id
      LEFT JOIN public.contact_details cd ON cd.application_id = pd.application_id
      LEFT JOIN public.identity_verifications iv ON iv.application_id = pd.application_id
      LEFT JOIN public.digilocker_details digi ON digi.application_id = pd.application_id::text
      LEFT JOIN public.cvlkra_data cvl ON cvl.application_id = pd.application_id
      LEFT JOIN public.techexcel tech ON tech."Client_id" = ka.client_code
      ${whereClause}
    `;

    const aggResult = await pool.query(aggQuery, params);
    const totalTransactions = parseInt(aggResult.rows[0].total_count) || 0;
    const totalAmount = parseFloat(aggResult.rows[0].total_amount) || 0;
    const successCount = parseInt(aggResult.rows[0].success_count) || 0;
    const successAmount = parseFloat(aggResult.rows[0].success_amount) || 0;
    const pendingCount = parseInt(aggResult.rows[0].pending_count) || 0;
    const pendingAmount = parseFloat(aggResult.rows[0].pending_amount) || 0;
    const failedCount = parseInt(aggResult.rows[0].failed_count) || 0;
    const failedAmount = parseFloat(aggResult.rows[0].failed_amount) || 0;

    query += ` ORDER BY ${orderCol} ${orderDir} NULLS LAST`;

    if (!isExportMode) {
        params.push(parsedLimit, parsedOffset);
        query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    }

    const result = await pool.query(query, params);

    const mappedRows = result.rows.map(row => {
      row.payment_status = normalizeStatus(row.payment_status);
      return row;
    });

    return res.status(200).json({
      success: true,
      message: "Payments fetched successfully",
      data: mappedRows,
      summary: {
        total_transactions: totalTransactions,
        total_amount: totalAmount,
        success: {
          count: successCount,
          amount: successAmount
        },
        pending: {
          count: pendingCount,
          amount: pendingAmount
        },
        failed: {
          count: failedCount,
          amount: failedAmount
        },
        total_successful_amount: successAmount
      },
      pagination: isExportMode ? null : {
        limit: parsedLimit,
        offset: parsedOffset,
        total: totalTransactions
      }
    });
  } catch (error) {
    console.error("Get payments error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching payments",
      error: error.message
    });
  }
};

const editClientField = async (req, res) => {
  const { clientCode } = req.params;
  const { stage_key, field_key, new_value } = req.body;

  if (!clientCode || !stage_key || !field_key) {
    return res.status(400).json({ success: false, message: "clientCode, stage_key, and field_key are required" });
  }

  // Determine target table based on stage
  let targetTable = '';
  switch (stage_key) {
    case 'mobile_verification':
    case 'email_verification':
      targetTable = 'contact_details';
      break;
    case 'pan_and_dob':
      targetTable = 'pan_details';
      break;
    case 'personal_details':
      targetTable = 'personal_details';
      break;
    case 'bank_details':
      targetTable = 'bank_details';
      break;
    case 'nominee_details':
      targetTable = 'nominee_details';
      break;
    case 'live_photo':
      targetTable = 'live_photo';
      break;
    case 'signature_upload':
      targetTable = 'signature_upload';
      break;
    default:
      return res.status(400).json({ success: false, message: "Unsupported stage for editing" });
  }

  // Very basic sanitization/protection against SQL injection for column names
  if (!/^[a-zA-Z0-9_]+$/.test(field_key)) {
    return res.status(400).json({ success: false, message: "Invalid field key format" });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Lookup applicationId from clientCode
    const appQuery = await client.query(
      `SELECT ka.id FROM public.kyc_applications ka 
       LEFT JOIN public.contact_details cd ON cd.application_id = ka.id
       LEFT JOIN public.client_codes cc ON cc.email = cd.email
       WHERE COALESCE(cc.client_code, ka.client_code) = $1 
       ORDER BY ka.id DESC LIMIT 1`,
      [clientCode]
    );

    if (appQuery.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: "Client not found" });
    }
    const applicationId = appQuery.rows[0].id;

    // Check if a row exists for this application
    const checkRes = await client.query(`SELECT 1 FROM public.${targetTable} WHERE application_id = $1`, [applicationId]);
    if (checkRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: `No record found in ${targetTable} for this application.` });
    }

    const updateQuery = `UPDATE public.${targetTable} SET ${field_key} = $1, updated_at = CURRENT_TIMESTAMP WHERE application_id = $2`;
    await client.query(updateQuery, [new_value, applicationId]);
    
    // Audit logging
    const userName = req.user?.username || 'system';
    await client.query(
      `INSERT INTO public.kyc_stage_audit_logs (application_id, stage_code, updated_by, error_message)
       VALUES ($1, $2, $3, $4)`,
      [applicationId, 'MANUAL_EDIT', userName, JSON.stringify({ action: 'edit_field', stage: stage_key, field: field_key, new_value })]
    );

    await client.query('COMMIT');
    
    return res.status(200).json({ success: true, message: "Field updated successfully" });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Edit field error:", error);
    // Suppress Postgres errors like "column does not exist" gracefully
    return res.status(500).json({ success: false, message: "Failed to update field. Please check if the field is editable.", error: error.message });
  } finally {
    client.release();
  }
};

const getStageTimestamps = async (req, res) => {
  try {
    const clientCode = req.params.clientCode;
    if (!clientCode) {
      return res.status(400).json({ success: false, message: "Client code required" });
    }
    
    // First find application_id for this client_code
    const appQuery = await pool.query(
      `SELECT ka.id FROM public.kyc_applications ka 
       LEFT JOIN public.contact_details cd ON cd.application_id = ka.id
       LEFT JOIN public.client_codes cc ON cc.email = cd.email
       WHERE COALESCE(cc.client_code, ka.client_code) = $1 
       ORDER BY ka.id DESC LIMIT 1`,
      [clientCode]
    );

    if (appQuery.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }

    const applicationId = appQuery.rows[0].id;
    
    // Fetch from the new stage_lifecycle_timestamps table
    // We wrap it in a try/catch in case the table is not created yet
    let lifecycleData = [];
    try {
      const tsQuery = await pool.query(
        `SELECT stage_name, entered_at, completed_at, duration_seconds 
         FROM public.stage_lifecycle_timestamps 
         WHERE application_id = $1 ORDER BY entered_at ASC`,
        [applicationId]
      );
      lifecycleData = tsQuery.rows;
    } catch (e) {
      console.warn("Table stage_lifecycle_timestamps might not exist yet.", e.message);
    }

    // --- FALLBACK LOGIC FOR EXISTING RECORDS ---
    // If the record was processed before the trigger was added, pull timestamps from individual tables.
    const fallbackTables = [
      { stage_name: 'mobile_verification', table: 'contact_details' },
      { stage_name: 'email_verification', table: 'contact_details' },
      { stage_name: 'pan_and_dob', table: 'identity_verifications' },
      { stage_name: 'digilocker_details', table: 'digilocker_details' },
      { stage_name: 'personal_details', table: 'personal_details' },
      { stage_name: 'bank_details', table: 'bank_details' },
      { stage_name: 'nominee_details', table: 'nominee_details' },
      { stage_name: 'live_photo', table: 'applicant_photo_uploads' },
      { stage_name: 'signature_upload', table: 'signature_uploads' },
      { stage_name: 'scheme_details', table: 'payments_details' },
      { stage_name: 'esign', table: 'esign_audit_logs' }
    ];

    const existingStages = new Set(lifecycleData.map(l => l.stage_name));

    for (const fb of fallbackTables) {
      if (!existingStages.has(fb.stage_name)) {
        try {
          const res = await pool.query(`SELECT created_at, updated_at FROM public.${fb.table} WHERE application_id = $1 LIMIT 1`, [applicationId]);
          if (res.rows.length > 0) {
             const row = res.rows[0];
             lifecycleData.push({
               stage_name: fb.stage_name,
               entered_at: row.created_at || row.updated_at,
               completed_at: row.updated_at || row.created_at,
               duration_seconds: null
             });
          }
        } catch (e) {
          // Table or column might not exist for some, just ignore silently
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: lifecycleData
    });
  } catch (error) {
    console.error("Get stage timestamps error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

const getSystemAuditLogs = async (req, res) => {
  try {
    const query = `
      SELECT id, user_id, user_name, user_role, action_type, module, 
             entity_type, entity_id, client_code, field_name, 
             old_value, new_value, changes_json, description, 
             ip_address, created_at
      FROM public.system_audit_logs
      ORDER BY created_at DESC
      LIMIT 500
    `;
    const { rows } = await pool.query(query);
    
    return res.status(200).json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error("Get system audit logs error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

const mapBetaFlowType = (row) => {
  if (!row) return 'Unknown';
  if (row.has_digilocker_flow) return 'DigiLocker';
  if (row.has_kra_flow) return 'KRA';
  return 'Unknown';
};

const betaCvlkraIssueText = (row) => [
  row.cvlkra_error,
  row.cvlkra_remarks,
  row.cvlkra_error_code,
  row.cvlkra_mod_status,
  row.cvlkra_mod_status_date,
  row.cvlkra_response_text
].filter(Boolean).join(' ');

const parseBetaIndianDate = (value) => {
  const match = String(value || '').match(/(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (!match) return null;
  return {
    raw: match[0],
    day: Number(match[1]),
    month: Number(match[2]),
    year: Number(match[3])
  };
};

const isBetaJuly2026OrLater = (dateParts) => (
  Boolean(dateParts)
  && (dateParts.year > 2026 || (dateParts.year === 2026 && dateParts.month >= 7))
);

const extractRecentModifyStatusDate = (row) => {
  const explicitDate = parseBetaIndianDate(row.cvlkra_mod_status_date);
  if (isBetaJuly2026OrLater(explicitDate)) return explicitDate.raw;

  const text = betaCvlkraIssueText(row);
  const matches = [...String(text || '').matchAll(/(\d{2})[/-](\d{2})[/-](\d{4})/g)]
    .map(match => parseBetaIndianDate(match[0]))
    .filter(Boolean);

  const recentDate = matches.find(isBetaJuly2026OrLater);
  return recentDate?.raw || null;
};

const hasRecentModifyUnderProcessStatus = (row) => {
  const issueText = betaCvlkraIssueText(row).toLowerCase();
  const hasModify = issueText.includes('modify') || issueText.includes('modification');
  const hasUnderProcess = issueText.includes('under process');
  return hasModify && hasUnderProcess && Boolean(extractRecentModifyStatusDate(row));
};

const classifyBetaCvlkraStatus = (row, normalizeOptionalStatus) => {
  const normalizedStatus = normalizeOptionalStatus(row.cvlkra_status);
  const issueText = betaCvlkraIssueText(row).toLowerCase();

  if (hasRecentModifyUnderProcessStatus(row)) return 'KRA_Modify_Under_Process';
  if (issueText.includes('name mismatch with income tax')) return 'KRA_Name_Mismatch';
  if (
    issueText.includes('aadhaar xml file not provided') ||
    issueText.includes('xml aadhaar validation failed')
  ) return 'KRA_XML_Hold';

  return normalizedStatus;
};


const parseBetaXmlAttribute = (tag, attr) => {
  if (!tag) return null;
  const pattern = new RegExp('\\b' + attr + '\\s*=\\s*["\']([^"\']*)["\']', 'i');
  const match = String(tag).match(pattern);
  return match ? match[1] : null;
};

const parseBetaXmlDate = (value) => {
  if (!value) return null;
  const parsed = new Date(String(value).trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getBetaXmlMetadata = ({ rawXml, s3Key, xmlStatus }) => {
  const hasS3Key = String(s3Key || '').trim() !== '';
  const raw = String(rawXml || '').trim();
  const emptyResult = {
    present: false,
    source: null,
    status: 'missing',
    label: 'Missing',
    rootName: null,
    signatureCount: null,
    generatedAt: null,
    validUntil: null,
    isCertificate: null,
    isSigned: null,
    isValidNow: null,
    reason: 'Aadhaar XML is not available in DB/S3 key.'
  };

  if (!raw) {
    if (hasS3Key) {
      return {
        ...emptyResult,
        present: true,
        source: 's3_key',
        status: 'stored',
        label: xmlStatus || 'Stored',
        reason: 'S3 key present. Validity is not available because raw XML is not stored in DB.'
      };
    }
    return emptyResult;
  }

  const xmlWithoutDecl = raw.replace(/^\s*<\?xml[^>]*\?>\s*/i, '');
  const rootMatch = xmlWithoutDecl.match(/^<\s*([A-Za-z_][\w:.-]*)/);
  const rootName = rootMatch ? rootMatch[1].split(':').pop() : null;
  const signatureCount = (raw.match(/<\s*(?:[A-Za-z_][\w.-]*:)?Signature\b/g) || []).length;
  const kycResTag = (raw.match(/<\s*(?:[A-Za-z_][\w.-]*:)?KycRes\b[^>]*>/i) || [null])[0];
  const generatedAt = parseBetaXmlAttribute(kycResTag, 'ts');
  const validUntil = parseBetaXmlAttribute(kycResTag, 'ttl');
  const validUntilDate = parseBetaXmlDate(validUntil);
  const isCertificate = rootName === 'Certificate';
  const isSigned = signatureCount > 0;
  let isValidNow = null;
  if (validUntilDate) isValidNow = validUntilDate.getTime() >= Date.now();

  let status = 'validity_unknown';
  let label = 'XML present';
  let reason = 'Signed Certificate XML is present; validity date was not found.';
  if (!isCertificate || !isSigned) {
    status = 'invalid';
    label = 'Invalid XML';
    reason = `${rootName || 'unknown'} XML with ${signatureCount} signature(s). CVLKRA API needs signed Certificate XML.`;
  } else if (isValidNow === false) {
    status = 'expired';
    label = 'Expired XML';
    reason = `XML validity expired on ${validUntil}.`;
  } else if (isValidNow === true) {
    status = 'valid';
    label = 'Valid XML';
    reason = 'Signed Certificate XML is present and within validity.';
  }

  return {
    present: true,
    source: hasS3Key ? 's3_key_and_db' : 'db_raw_xml',
    status,
    label,
    rootName,
    signatureCount,
    generatedAt,
    validUntil,
    isCertificate,
    isSigned,
    isValidNow,
    reason
  };
};

const getBetaEntries = async (req, res) => {
  try {
    const {
      q = "",
      flow = "",
      cvlkraStatus = "",
      currentStage = "",
      limit = "200",
      offset = "0"
    } = req.query;

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 1000);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
    const conditions = [];
    const params = [];

    conditions.push(`ka.is_completed = true`);
    conditions.push(`COALESCE(ka.is_test_entry, false) = false`);

    const flowExpr = `
      CASE
        WHEN (
          digi.id IS NOT NULL
          OR LOWER(COALESCE(iv.provider, '')) = 'digilocker'
          OR LOWER(COALESCE(digi.provider, '')) = 'digilocker'
          OR COALESCE(cvl.app_kyc_mode, '') = '5'
          OR COALESCE(cvl.aadhaar_xml_s3_key, '') <> ''
        ) THEN 'DigiLocker'
        WHEN cvl.id IS NOT NULL THEN 'KRA'
        ELSE 'Unknown'
      END
    `;

    if (q.trim()) {
      const qTokens = q
        .split(/[\n,]+/)
        .map(token => token.trim())
        .filter(Boolean);

      if (qTokens.length > 1) {
        params.push(qTokens.map(token => token.toUpperCase()));
        conditions.push(`(
          UPPER(COALESCE(ka.client_code, cc.client_code, tech."Client_id", '')) = ANY($${params.length})
          OR UPPER(COALESCE(iv.pan_number, cvl.app_pan_no, tech."PAN_NO", '')) = ANY($${params.length})
          OR ka.id::text = ANY($${params.length})
        )`);
      } else {
        const token = qTokens[0] || q.trim();
        params.push(token.toUpperCase());
        const exactIdx = params.length;
        params.push(`%${token}%`);
        const likeIdx = params.length;
        conditions.push(`(
          UPPER(COALESCE(ka.client_code, cc.client_code, tech."Client_id", '')) = $${exactIdx}
          OR UPPER(COALESCE(iv.pan_number, cvl.app_pan_no, tech."PAN_NO", '')) = $${exactIdx}
          OR ka.id::text = $${exactIdx}
          OR COALESCE(ka.client_code, cc.client_code, tech."Client_id", '') ILIKE $${likeIdx}
          OR COALESCE(iv.pan_number, cvl.app_pan_no, tech."PAN_NO", '') ILIKE $${likeIdx}
          OR COALESCE(iv.full_name, digi.name, cvl.app_name, tech."Client_Name", '') ILIKE $${likeIdx}
          OR COALESCE(cd.email, '') ILIKE $${likeIdx}
          OR COALESCE(cd.mobile_number, '') ILIKE $${likeIdx}
        )`);
      }
    }

    if (flow.trim()) {
      params.push(flow.trim());
      conditions.push(`${flowExpr} = $${params.length}`);
    }

    if (cvlkraStatus.trim()) {
      params.push(`%${cvlkraStatus.trim()}%`);
      conditions.push(`COALESCE(cvl.sync_status, '') ILIKE $${params.length}`);
    }

    if (currentStage.trim()) {
      params.push(`%${currentStage.trim()}%`);
      conditions.push(`COALESCE(ka.current_step, '') ILIKE $${params.length}`);
    }

    const baseFrom = `
      FROM public.kyc_applications ka
      LEFT JOIN public.contact_details cd ON cd.application_id = ka.id
      LEFT JOIN LATERAL (
        SELECT client_code
        FROM public.client_codes
        WHERE email = cd.email
        ORDER BY updated_at DESC NULLS LAST, id DESC
        LIMIT 1
      ) cc ON true
      LEFT JOIN public.identity_verifications iv ON iv.application_id = ka.id
      LEFT JOIN public.digilocker_details digi ON digi.application_id = ka.id::text
      LEFT JOIN LATERAL (
        SELECT *
        FROM public.cvlkra_data
        WHERE application_id = ka.id
        ORDER BY updated_at DESC NULLS LAST, id DESC
        LIMIT 1
      ) cvl ON true
      LEFT JOIN LATERAL (
        SELECT *
        FROM public.cdsl_data
        WHERE application_id = ka.id
        ORDER BY updated_at DESC NULLS LAST, id DESC
        LIMIT 1
      ) cdsl ON true
      LEFT JOIN LATERAL (
        SELECT *
        FROM public.nse_data
        WHERE application_id = ka.id
        ORDER BY updated_at DESC NULLS LAST, id DESC
        LIMIT 1
      ) nse ON true
      LEFT JOIN LATERAL (
        SELECT *
        FROM public.bse_data
        WHERE application_id = ka.id
        ORDER BY updated_at DESC NULLS LAST, id DESC
        LIMIT 1
      ) bse ON true
      LEFT JOIN LATERAL (
        SELECT *
        FROM public.techexcel
        WHERE "Client_id" = COALESCE(ka.client_code, cc.client_code)
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 1
      ) tech ON true
    `;

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const dataQuery = `
      SELECT
        ka.id AS application_id,
        COALESCE(NULLIF(ka.client_code, ''), NULLIF(cc.client_code, ''), NULLIF(tech."Client_id", '')) AS client_code,
        COALESCE(NULLIF(iv.pan_number, ''), NULLIF(cvl.app_pan_no, ''), NULLIF(tech."PAN_NO", '')) AS pan,
        COALESCE(NULLIF(iv.full_name, ''), NULLIF(digi.name, ''), NULLIF(cvl.app_name, ''), NULLIF(tech."Client_Name", '')) AS client_name,
        cd.email,
        cd.mobile_number,
        ka.current_step,
        ka.esign_status,
        ka.is_completed,
        ka.is_test_entry,
        ${flowExpr} AS flow_type,
        (${flowExpr} = 'DigiLocker') AS has_digilocker_flow,
        (${flowExpr} = 'KRA') AS has_kra_flow,
        cvl.id AS cvlkra_id,
        cvl.sync_status AS cvlkra_status,
        cvl.error_description AS cvlkra_error,
        COALESCE(
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYC_DATA,APP_REMARKS}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYCDATA,APP_REMARKS}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYC_DATA,APP_REMARKS}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYCDATA,APP_REMARKS}' END
        ) AS cvlkra_remarks,
        COALESCE(
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYC_DATA,APP_ERROR_DESC}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYCDATA,APP_ERROR_DESC}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYC_DATA,APP_ERROR_DESC}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYCDATA,APP_ERROR_DESC}' END
        ) AS cvlkra_error_code,
        COALESCE(
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYC_DATA,APP_UPDT_STATUS}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYC_DATA,APP_UPDATE_STATUS}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYC_DATA,APP_MOD_STATUS}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYC_DATA,APP_MODIFICATION_STATUS}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYCDATA,APP_UPDT_STATUS}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYCDATA,APP_UPDATE_STATUS}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYCDATA,APP_MOD_STATUS}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYCDATA,APP_MODIFICATION_STATUS}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYC_DATA,APP_UPDT_STATUS}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYC_DATA,APP_UPDATE_STATUS}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYC_DATA,APP_MOD_STATUS}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYC_DATA,APP_MODIFICATION_STATUS}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYCDATA,APP_UPDT_STATUS}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYCDATA,APP_UPDATE_STATUS}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYCDATA,APP_MOD_STATUS}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYCDATA,APP_MODIFICATION_STATUS}' END
        ) AS cvlkra_mod_status,
        COALESCE(
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYC_DATA,APP_UPDT_STATUSDT}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYC_DATA,APP_UPDATE_STATUSDT}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYC_DATA,APP_MOD_STATUSDT}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYC_DATA,APP_MODIFICATION_STATUSDT}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYC_DATA,APP_MODDT}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYCDATA,APP_UPDT_STATUSDT}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYCDATA,APP_UPDATE_STATUSDT}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYCDATA,APP_MOD_STATUSDT}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYCDATA,APP_MODIFICATION_STATUSDT}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{final_status_response,resdtls,KYCDATA,APP_MODDT}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYC_DATA,APP_UPDT_STATUSDT}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYC_DATA,APP_UPDATE_STATUSDT}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYC_DATA,APP_MOD_STATUSDT}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYC_DATA,APP_MODIFICATION_STATUSDT}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYC_DATA,APP_MODDT}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYCDATA,APP_UPDT_STATUSDT}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYCDATA,APP_UPDATE_STATUSDT}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYCDATA,APP_MOD_STATUSDT}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYCDATA,APP_MODIFICATION_STATUSDT}' END,
          CASE WHEN LEFT(BTRIM(cvl.api_response_payload::text), 1) = '{' THEN cvl.api_response_payload::jsonb #>> '{resdtls,KYCDATA,APP_MODDT}' END
        ) AS cvlkra_mod_status_date,
        LEFT(COALESCE(cvl.api_response_payload::text, ''), 20000) AS cvlkra_response_text,
        cvl.cvlkra_acknowledgment_id,
        cvl.aadhaar_xml_s3_key,
        digi.digilocker_raw_xml AS digilocker_raw_xml,
        cvl.app_occ,
        cvl.app_income,
        cvl.app_cor_add_proof,
        cvl.app_per_add_proof,
        cvl.app_doc_proof,
        cvl.app_kyc_mode,
        CASE
          WHEN COALESCE(cvl.aadhaar_xml_s3_key, '') <> '' THEN 'Stored'
          WHEN COALESCE(digi.digilocker_raw_xml, '') <> '' THEN 'Raw XML in DB'
          ELSE 'Missing'
        END AS xml_status,
        cdsl.id AS cdsl_id,
        cdsl.cdsl_push_status,
        cdsl.bo_id,
        cdsl.cdsl_msg_desc,
        nse.id AS nse_id,
        nse.nse_push_status,
        nse.nse_msg_desc,
        bse.id AS bse_id,
        bse.bse_status,
        bse.client_code AS bse_client_code,
        tech."Client_id" AS techexcel_client_id,
        tech.techexcel_push_status,
        GREATEST(
          COALESCE(ka.updated_at, ka.created_at),
          COALESCE(cvl.updated_at, cvl.created_at),
          COALESCE(cdsl.updated_at, cdsl.created_at),
          COALESCE(nse.updated_at, nse.created_at),
          COALESCE(bse.updated_at, bse.created_at)
        ) AS updated_at
      ${baseFrom}
      ${whereClause}
      ORDER BY updated_at DESC NULLS LAST, ka.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const countQuery = `
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE ${flowExpr} = 'KRA') AS kra_flow_count,
        COUNT(*) FILTER (WHERE ${flowExpr} = 'DigiLocker') AS digilocker_flow_count,
        COUNT(*) FILTER (
          WHERE ka.is_completed = true
            AND COALESCE(ka.is_test_entry, false) = false
        ) AS completed_count
      ${baseFrom}
      ${whereClause}
    `;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, [...params, parsedLimit, parsedOffset]),
      pool.query(countQuery, params)
    ]);

    const normalizeOptionalStatus = (status) => status ? normalizeStatus(status) : null;
    const data = dataResult.rows.map(row => {
      const { digilocker_raw_xml: digilockerRawXml, ...safeRow } = row;
      const xmlMetadata = getBetaXmlMetadata({
        rawXml: digilockerRawXml,
        s3Key: row.aadhaar_xml_s3_key,
        xmlStatus: row.xml_status
      });
      const cvlkraStatus = classifyBetaCvlkraStatus(row, normalizeOptionalStatus);
      const recentModifyStatus = hasRecentModifyUnderProcessStatus(row) ? 'UNDER PROCESS - Modify KYC' : null;
      const recentModifyDate = extractRecentModifyStatusDate(row);

      return {
      ...safeRow,
      xml_status: xmlMetadata.label,
      xml: xmlMetadata,
      flow_type: mapBetaFlowType(row),
      cvlkra_status: cvlkraStatus,
      cdsl_push_status: normalizeOptionalStatus(row.cdsl_push_status),
      nse_push_status: normalizeOptionalStatus(row.nse_push_status),
      bse_status: normalizeOptionalStatus(row.bse_status),
      techexcel_push_status: normalizeOptionalStatus(row.techexcel_push_status),
      cvlkra: {
        id: row.cvlkra_id,
        status: cvlkraStatus,
        error: [row.cvlkra_remarks, row.cvlkra_error].filter(Boolean).join(' | ') || null,
        errorCode: row.cvlkra_error_code,
        remarks: row.cvlkra_remarks,
        modificationStatus: row.cvlkra_mod_status || recentModifyStatus,
        modificationStatusDate: row.cvlkra_mod_status_date || recentModifyDate,
        acknowledgmentId: row.cvlkra_acknowledgment_id,
        fields: {
          appOcc: row.app_occ,
          appIncome: row.app_income,
          appCorAddProof: row.app_cor_add_proof,
          appPerAddProof: row.app_per_add_proof,
          appDocProof: row.app_doc_proof,
          appKycMode: row.app_kyc_mode,
          aadhaarXmlS3Key: row.aadhaar_xml_s3_key
        }
      },
      cdsl: {
        id: row.cdsl_id,
        status: normalizeOptionalStatus(row.cdsl_push_status),
        boId: row.bo_id,
        error: row.cdsl_msg_desc
      },
      nse: {
        id: row.nse_id,
        status: normalizeOptionalStatus(row.nse_push_status),
        error: row.nse_msg_desc
      },
      bse: {
        id: row.bse_id,
        status: normalizeOptionalStatus(row.bse_status),
        clientCode: row.bse_client_code
      },
      techexcel: {
        clientId: row.techexcel_client_id,
        status: normalizeOptionalStatus(row.techexcel_push_status)
      }
      };
    });

    return res.status(200).json({
      success: true,
      data,
      summary: {
        total: parseInt(countResult.rows[0]?.total, 10) || 0,
        kra_flow_count: parseInt(countResult.rows[0]?.kra_flow_count, 10) || 0,
        digilocker_flow_count: parseInt(countResult.rows[0]?.digilocker_flow_count, 10) || 0,
        completed_count: parseInt(countResult.rows[0]?.completed_count, 10) || 0
      },
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        total: parseInt(countResult.rows[0]?.total, 10) || 0
      }
    });
  } catch (error) {
    console.error("Get beta entries error:", error);
    return res.status(500).json({ success: false, message: "Server error while fetching beta entries", error: error.message });
  }
};

const getBetaNominees = async (req, res) => {
  try {
    const applicationId = parseInt(req.params.applicationId, 10);
    if (!applicationId) {
      return res.status(400).json({ success: false, message: "Valid applicationId is required." });
    }

    const [nomineeResult, summaryResult] = await Promise.all([
      pool.query(`
        SELECT
          id,
          application_id,
          nominee_name,
          dob,
          mobile,
          email,
          relation,
          gender,
          nominee_proof_type,
          aadhaar,
          pan,
          nominee_address,
          same_address,
          allocation_percentage,
          created_at,
          updated_at
        FROM public.nominee_details
        WHERE application_id = $1
        ORDER BY created_at ASC NULLS LAST, id ASC
      `, [applicationId]),
      pool.query(`
        SELECT
          COUNT(*)::int AS nominee_count,
          COALESCE(SUM(allocation_percentage), 0)::numeric AS total_allocation
        FROM public.nominee_details
        WHERE application_id = $1
      `, [applicationId])
    ]);

    return res.status(200).json({
      success: true,
      application_id: applicationId,
      data: nomineeResult.rows,
      summary: {
        nominee_count: summaryResult.rows[0]?.nominee_count || 0,
        total_allocation: Number(summaryResult.rows[0]?.total_allocation || 0)
      }
    });
  } catch (error) {
    console.error("Get beta nominees error:", error);
    return res.status(500).json({ success: false, message: "Server error while fetching nominees", error: error.message });
  }
};

const deleteBetaNominee = async (req, res) => {
  try {
    const applicationId = parseInt(req.params.applicationId, 10);
    const nomineeId = parseInt(req.params.nomineeId, 10);
    if (!applicationId || !nomineeId) {
      return res.status(400).json({ success: false, message: "Valid applicationId and nomineeId are required." });
    }

    const deleteResult = await pool.query(`
      DELETE FROM public.nominee_details
      WHERE id = $1
        AND application_id = $2
      RETURNING
        id,
        application_id,
        nominee_name,
        dob,
        relation,
        allocation_percentage
    `, [nomineeId, applicationId]);

    if (!deleteResult.rowCount) {
      return res.status(404).json({ success: false, message: "Nominee row not found for this application." });
    }

    const [remainingResult, summaryResult] = await Promise.all([
      pool.query(`
        SELECT
          id,
          application_id,
          nominee_name,
          dob,
          mobile,
          email,
          relation,
          gender,
          nominee_proof_type,
          aadhaar,
          pan,
          nominee_address,
          same_address,
          allocation_percentage,
          created_at,
          updated_at
        FROM public.nominee_details
        WHERE application_id = $1
        ORDER BY created_at ASC NULLS LAST, id ASC
      `, [applicationId]),
      pool.query(`
        SELECT
          COUNT(*)::int AS nominee_count,
          COALESCE(SUM(allocation_percentage), 0)::numeric AS total_allocation
        FROM public.nominee_details
        WHERE application_id = $1
      `, [applicationId])
    ]);

    return res.status(200).json({
      success: true,
      message: "Nominee deleted. Integration statuses were not changed.",
      application_id: applicationId,
      deleted: deleteResult.rows[0],
      data: remainingResult.rows,
      summary: {
        nominee_count: summaryResult.rows[0]?.nominee_count || 0,
        total_allocation: Number(summaryResult.rows[0]?.total_allocation || 0)
      }
    });
  } catch (error) {
    console.error("Delete beta nominee error:", error);
    return res.status(500).json({ success: false, message: "Server error while deleting nominee", error: error.message });
  }
};

const resetBetaCdslPending = async (req, res) => {
  try {
    const applicationId = parseInt(req.params.applicationId, 10);
    if (!applicationId) {
      return res.status(400).json({ success: false, message: "Valid applicationId is required." });
    }

    const resetResult = await pool.query(`
      UPDATE public.cdsl_data
      SET
        cdsl_push_status = 'PENDING',
        cdsl_acknowledgment_id = NULL,
        zip_file_name = NULL,
        cdsl_msg_code = NULL,
        cdsl_msg_desc = NULL,
        rejection_reason = NULL,
        updated_at = NOW()
      WHERE application_id = $1
      RETURNING
        id,
        application_id,
        bo_id,
        cdsl_push_status,
        cdsl_acknowledgment_id,
        zip_file_name,
        cdsl_msg_code,
        cdsl_msg_desc,
        rejection_reason,
        updated_at
    `, [applicationId]);

    if (!resetResult.rowCount) {
      return res.status(404).json({ success: false, message: "CDSL row not found for this application." });
    }

    return res.status(200).json({
      success: true,
      message: "CDSL reset to Pending. No integrations were called.",
      application_id: applicationId,
      data: resetResult.rows[0]
    });
  } catch (error) {
    console.error("Reset beta CDSL pending error:", error);
    return res.status(500).json({ success: false, message: "Server error while resetting CDSL to Pending", error: error.message });
  }
};

const postJson = (urlString, payload) => {
  const http = require('http');
  const https = require('https');
  const url = new URL(urlString);
  const body = JSON.stringify(payload);
  const client = url.protocol === 'http:' ? http : https;

  return new Promise((resolve, reject) => {
    const request = client.request({
      method: 'POST',
      hostname: url.hostname,
      port: url.port || (url.protocol === 'http:' ? 80 : 443),
      path: `${url.pathname}${url.search}`,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 30000
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let parsed = text;
        try {
          parsed = JSON.parse(text);
        } catch (error) {}
        resolve({ statusCode: response.statusCode, body: parsed });
      });
    });

    request.on('timeout', () => {
      request.destroy(new Error('Push request timed out.'));
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
};

const getBetaPushTarget = (target) => {
  const normalized = String(target || '').trim().toLowerCase();
  const urls = {
    orchestrator: process.env.BETA_ORCHESTRATOR_URL || process.env.ORCHESTRATOR_URL,
    cvlkra: process.env.BETA_CVLKRA_URL || process.env.CVLKRA_CONNECT_URL,
    cvlkra_document: process.env.BETA_CVLKRA_URL || process.env.CVLKRA_CONNECT_URL,
    cvlkra_status: process.env.BETA_CVLKRA_URL || process.env.CVLKRA_CONNECT_URL,
    cdsl: process.env.BETA_CDSL_URL || process.env.CDSL_KYC_URL,
    cdsl_status: process.env.BETA_CDSL_URL || process.env.CDSL_KYC_URL,
    nse: process.env.BETA_NSE_URL || process.env.NSE_CONNECT_URL,
    bse: process.env.BETA_BSE_URL || process.env.BSE_CONNECT_URL,
    techexcel: process.env.BETA_TECHEXCEL_URL || process.env.TECHEXCEL_CONNECT_URL
  };

  return {
    normalized,
    url: urls[normalized]
  };
};

const buildDefaultBetaPushPayload = ({ target, applicationId, pan }) => {
  if (target === 'cvlkra') {
    return {
      mode: 'process',
      applicationIds: [applicationId],
      pans: pan ? [pan] : [],
      limit: 1,
      forceRepush: true,
      allowNameMismatchUpdate: true
    };
  }

  if (target === 'cvlkra_document') {
    return {
      mode: 'documentUploadOnly',
      applicationId,
      reconcileFinalStatus: true,
      allowNameMismatchUpdate: true
    };
  }

  if (target === 'cvlkra_status') {
    return {
      mode: 'kraStatus',
      applicationIds: [applicationId],
      pans: pan ? [pan] : [],
      limit: 1
    };
  }

  if (target === 'cdsl_status') {
    return {
      mode: 'uploadedStatus',
      applicationIds: [applicationId],
      pans: pan ? [pan] : [],
      limit: 1,
      minAgeMinutes: 0,
      forceDownload: true
    };
  }

  if (target === 'orchestrator') {
    return {
      mode: 'process',
      applicationIds: [applicationId],
      limit: 1
    };
  }

  return {
    mode: 'process',
    applicationIds: [applicationId],
    pans: pan ? [pan] : [],
    limit: 1
  };
};

const parseJsonIfString = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return value;
  }
};

const getPushFailureMessage = (payload, fallback) => {
  const body = parseJsonIfString(payload?.body);
  if (body && typeof body === 'object') {
    return body.error || body.message || body.errorMessage || fallback;
  }
  if (typeof body === 'string' && body.trim()) return body.trim();
  return payload?.error || payload?.message || fallback;
};

const inspectPushPayloadForFailure = (payload, depth = 0) => {
  if (depth > 5) return null;
  const parsed = parseJsonIfString(payload);
  if (!parsed || typeof parsed !== 'object') return null;

  if (parsed.functionError) {
    return {
      failedAt: 'lambda_invocation',
      statusCode: parsed.statusCode || null,
      message: parsed.functionError
    };
  }

  const status = Number(parsed.statusCode);
  if (status >= 400) {
    return {
      failedAt: 'lambda_business_response',
      statusCode: status,
      message: getPushFailureMessage(parsed, `Lambda returned status ${status}`)
    };
  }

  const body = parseJsonIfString(parsed.body);
  if (body && typeof body === 'object' && (body.error || body.success === false)) {
    return {
      failedAt: 'lambda_business_body',
      statusCode: status || null,
      message: body.error || body.message || 'Lambda returned an error response'
    };
  }

  return (
    inspectPushPayloadForFailure(parsed.response, depth + 1) ||
    inspectPushPayloadForFailure(parsed.Payload, depth + 1) ||
    inspectPushPayloadForFailure(body, depth + 1)
  );
};

const getBetaPushFailure = (httpResponse, targetResponse) => {
  const httpStatus = Number(httpResponse?.statusCode);
  if (httpStatus >= 400) {
    return {
      failedAt: 'transport',
      statusCode: httpStatus,
      message: getPushFailureMessage(httpResponse, `Push transport returned HTTP ${httpStatus}`)
    };
  }

  const lambdaResponse = targetResponse || httpResponse;
  if (lambdaResponse?.functionError) {
    return {
      failedAt: 'lambda_invocation',
      statusCode: lambdaResponse.statusCode || null,
      message: lambdaResponse.functionError
    };
  }

  return inspectPushPayloadForFailure(lambdaResponse);
};

const BETA_PUSH_BLOCKED_PANS = new Set([
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

const normalizePan = (value) => String(value || '').trim().toUpperCase();

const getBlockedPansFromPushRequest = ({ pan, payload }) => {
  const candidatePans = new Set();
  const addPan = value => {
    const normalized = normalizePan(value);
    if (normalized) candidatePans.add(normalized);
  };

  addPan(pan);
  if (Array.isArray(payload?.pans)) payload.pans.forEach(addPan);

  return [...candidatePans].filter(candidatePan => BETA_PUSH_BLOCKED_PANS.has(candidatePan));
};

const pushBetaEntry = async (req, res) => {
  try {
    const { target, applicationId, pan, payload } = req.body || {};
    const appId = parseInt(applicationId, 10);

    if (!target || !appId) {
      return res.status(400).json({ success: false, message: "target and applicationId are required." });
    }

    const { normalized, url } = getBetaPushTarget(target);
    const allowedTargets = ['orchestrator', 'cvlkra', 'cvlkra_document', 'cvlkra_status', 'cdsl', 'cdsl_status', 'nse', 'bse', 'techexcel'];
    if (!allowedTargets.includes(normalized)) {
      return res.status(400).json({ success: false, message: "Unsupported push target." });
    }

    const blockedPans = normalized === 'cvlkra_status' ? [] : getBlockedPansFromPushRequest({ pan, payload });
    if (blockedPans.length) {
      return res.status(409).json({
        success: false,
        message: "Push blocked from dashboard. KYC team completed KRA manually for these PANs.",
        blockedPans
      });
    }

    const requestedPayload = payload && typeof payload === 'object'
      ? payload
      : buildDefaultBetaPushPayload({ target: normalized, applicationId: appId, pan });
    const finalPayload = normalized === 'cvlkra'
      ? { ...requestedPayload, forceRepush: true, allowNameMismatchUpdate: true }
      : normalized === 'cvlkra_document'
        ? { ...requestedPayload, allowNameMismatchUpdate: true }
        : requestedPayload;

    if (!url) {
      return res.status(501).json({
        success: false,
        message: `Push target ${normalized} is not configured. Set the matching BETA_*_URL environment variable.`,
        target: normalized,
        payload: finalPayload
      });
    }

    const response = await postJson(url, finalPayload);
    const targetResponse = response?.body && typeof response.body === 'object'
      ? response.body
      : response;
    const pushFailure = getBetaPushFailure(response, targetResponse);
    const result = {
      success: !pushFailure,
      target: normalized,
      requestPayload: finalPayload,
      response: targetResponse
    };

    if (pushFailure) {
      return res.status(502).json({
        ...result,
        message: pushFailure.message,
        error: pushFailure.message,
        failure: pushFailure
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Beta push error:", error);
    return res.status(500).json({ success: false, message: "Server error while pushing beta entry", error: error.message });
  }
};

const getRepopulateTablesTarget = () => ({
  functionName:
    process.env.TABLE_REPOPULATE_FUNCTION_NAME ||
    process.env.EXPORT_JOBS_FUNCTION_NAME ||
    process.env.BETA_EXPORT_JOBS_FUNCTION ||
    process.env.BETA_ORCHESTRATOR_FUNCTION ||
    process.env.ORCHESTRATOR_FUNCTION_NAME,
  url:
    process.env.TABLE_REPOPULATE_URL ||
    process.env.EXPORT_JOBS_URL ||
    process.env.BETA_EXPORT_JOBS_URL ||
    process.env.BETA_ORCHESTRATOR_URL ||
    process.env.ORCHESTRATOR_URL
});

const formatRepopulateTablesUrl = (url, applicationId, pan) => {
  if (!url) return url;
  return String(url)
    .replace(/:applicationId\b/g, encodeURIComponent(String(applicationId)))
    .replace(/\{applicationId\}/g, encodeURIComponent(String(applicationId)))
    .replace(/:pan\b/g, encodeURIComponent(String(pan || '')))
    .replace(/\{pan\}/g, encodeURIComponent(String(pan || '')));
};

const buildRepopulateTablesPayload = ({ applicationId, pan, clientCode, requestPayload }) => {
  if (requestPayload && typeof requestPayload === 'object') {
    return requestPayload;
  }

  const mode = process.env.TABLE_REPOPULATE_MODE || process.env.EXPORT_JOBS_MODE || 'process';
  const payload = {
    mode,
    application_id: applicationId,
    applicationId,
    applicationIds: [applicationId],
    limit: 1,
    force: true,
    source: 'kyc-dashboard-client-detail'
  };

  if (pan) payload.pans = [pan];
  if (clientCode && clientCode !== 'N/A') payload.client_code = clientCode;

  return payload;
};

const repopulateApplicationTables = async (req, res) => {
  try {
    const appId = parseInt(req.params.applicationId || req.body?.application_id || req.body?.applicationId, 10);
    if (!appId) {
      return res.status(400).json({ success: false, message: "applicationId is required." });
    }

    const pan = normalizePan(req.body?.pan);
    const clientCode = String(req.body?.client_code || req.body?.clientCode || '').trim();
    const finalPayload = buildRepopulateTablesPayload({
      applicationId: appId,
      pan,
      clientCode,
      requestPayload: req.body?.payload
    });

    const { functionName, url } = getRepopulateTablesTarget();

    if (functionName) {
      const response = await invokeLambda(functionName, finalPayload);
      return res.status(200).json({
        success: !response.functionError && response.statusCode >= 200 && response.statusCode < 300,
        target: "repopulate_tables",
        transport: "lambda",
        requestPayload: finalPayload,
        response
      });
    }

    if (url) {
      const requestBody = String(process.env.TABLE_REPOPULATE_EMPTY_BODY || '').toLowerCase() === 'true' ? {} : finalPayload;
      const response = await postJson(formatRepopulateTablesUrl(url, appId, pan), requestBody);
      return res.status(200).json({
        success: response.statusCode >= 200 && response.statusCode < 300,
        target: "repopulate_tables",
        transport: "http",
        requestPayload: requestBody,
        response
      });
    }

    return res.status(501).json({
      success: false,
      message: "Re-populate tables target is not configured. Set TABLE_REPOPULATE_FUNCTION_NAME or EXPORT_JOBS_FUNCTION_NAME. As HTTP fallback, set TABLE_REPOPULATE_URL or EXPORT_JOBS_URL.",
      requestPayload: finalPayload
    });
  } catch (error) {
    console.error("Re-populate tables error:", error);
    return res.status(500).json({ success: false, message: "Server error while re-populating tables", error: error.message });
  }
};

module.exports = {
  getDashboardSummary,
  getClients,
  getClientByCode,
  getClientById,
  getClientKycStages,
  getIntegrationRecords,
  getPayments,
  editClientField,
  getStageTimestamps,
  getSystemAuditLogs,
  getBetaEntries,
  getBetaNominees,
  deleteBetaNominee,
  resetBetaCdslPending,
  repopulateApplicationTables,
  pushBetaEntry
};
