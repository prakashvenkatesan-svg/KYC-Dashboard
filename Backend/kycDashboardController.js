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
const { generateGenericPresignedUrl } = require("./s3Service");

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
  const { applicationId } = req.params;
  const { stage_key, field_key, new_value } = req.body;

  if (!applicationId || !stage_key || !field_key) {
    return res.status(400).json({ success: false, message: "applicationId, stage_key, and field_key are required" });
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

    return res.status(200).json({
      success: true,
      data: lifecycleData
    });
  } catch (error) {
    console.error("Get stage timestamps error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
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
  getStageTimestamps
};
