const getDashboardSummaryQuery = `
  WITH nse_counts AS (
    SELECT 
      'NSE' as integration,
      COUNT(*) as total,
      COUNT(NULLIF(nse_push_status = 'Success' OR nse_push_status = 'SUCCESS' OR nse_push_status = 'S', FALSE)) as success,
      COUNT(NULLIF(nse_push_status = 'Pending' OR nse_push_status = 'PENDING' OR nse_push_status = 'P', FALSE)) as pending,
      COUNT(NULLIF(nse_push_status = 'Rejected' OR nse_push_status = 'REJECTED' OR nse_push_status = 'R' OR nse_push_status = 'Failed' OR nse_push_status = 'FAILED' OR nse_push_status = 'F', FALSE)) as rejected
    FROM public.nse_data
  ),
  bse_counts AS (
    SELECT 
      'BSE' as integration,
      COUNT(*) as total,
      COUNT(NULLIF(bse_status = 'Success' OR bse_status = 'SUCCESS' OR bse_status = 'S', FALSE)) as success,
      COUNT(NULLIF(bse_status = 'Pending' OR bse_status = 'PENDING' OR bse_status = 'P', FALSE)) as pending,
      COUNT(NULLIF(bse_status = 'Rejected' OR bse_status = 'REJECTED' OR bse_status = 'R' OR bse_status = 'Failed' OR bse_status = 'FAILED' OR bse_status = 'F', FALSE)) as rejected
    FROM public.bse_data
  ),
  cvlkra_counts AS (
    SELECT 
      'CVL KRA' as integration,
      COUNT(*) as total,
      COUNT(NULLIF(sync_status = 'Success' OR sync_status = 'SUCCESS' OR sync_status = 'S', FALSE)) as success,
      COUNT(NULLIF(sync_status = 'Pending' OR sync_status = 'PENDING' OR sync_status = 'P', FALSE)) as pending,
      COUNT(NULLIF(sync_status = 'Rejected' OR sync_status = 'REJECTED' OR sync_status = 'R' OR sync_status = 'Failed' OR sync_status = 'FAILED' OR sync_status = 'F', FALSE)) as rejected
    FROM public.cvlkra_data
  ),
  cdsl_counts AS (
    SELECT 
      'CDSL' as integration,
      COUNT(*) as total,
      COUNT(NULLIF(cdsl_push_status = 'Success' OR cdsl_push_status = 'SUCCESS' OR cdsl_push_status = 'S', FALSE)) as success,
      COUNT(NULLIF(cdsl_push_status = 'Pending' OR cdsl_push_status = 'PENDING' OR cdsl_push_status = 'P', FALSE)) as pending,
      COUNT(NULLIF(cdsl_push_status = 'Rejected' OR cdsl_push_status = 'REJECTED' OR cdsl_push_status = 'R' OR cdsl_push_status = 'Failed' OR cdsl_push_status = 'FAILED' OR cdsl_push_status = 'F', FALSE)) as rejected
    FROM public.cdsl_data
  ),
  techexcel_counts AS (
    SELECT 
      'TechExcel' as integration,
      COUNT(*) as total,
      COUNT(NULLIF(techexcel_push_status = 'Success' OR techexcel_push_status = 'SUCCESS' OR techexcel_push_status = 'S', FALSE)) as success,
      COUNT(NULLIF(techexcel_push_status = 'Pending' OR techexcel_push_status = 'PENDING' OR techexcel_push_status = 'P', FALSE)) as pending,
      COUNT(NULLIF(techexcel_push_status = 'Rejected' OR techexcel_push_status = 'REJECTED' OR techexcel_push_status = 'R' OR techexcel_push_status = 'Failed' OR techexcel_push_status = 'FAILED' OR techexcel_push_status = 'F', FALSE)) as rejected
    FROM public.techexcel
  )
  SELECT * FROM nse_counts
  UNION ALL
  SELECT * FROM bse_counts
  UNION ALL
  SELECT * FROM cvlkra_counts
  UNION ALL
  SELECT * FROM cdsl_counts
  UNION ALL
  SELECT * FROM techexcel_counts;
`;

const getClientsListBaseQuery = `
  SELECT
    ka.id as application_id,
    COALESCE(cc.client_code, ka.client_code) as client_code,
    ka.created_at as application_date,
    ka.updated_at as last_updated,
    ka.current_step as current_stage,
    ka.kyc_status,
    cd.email,
    cd.mobile_number,
    COALESCE(iv.full_name, digi.name, cvl.app_name, tech."Client_Name") as client_name,
    COALESCE(iv.pan_number, cvl.app_pan_no, tech."PAN_NO") as pan_number,
    nse.nse_push_status,
    nse.rejection_reason as nse_rejection_reason,
    bse.bse_status as bse_push_status,
    bse.rejection_reason as bse_rejection_reason,
    cvl.sync_status as cvlkra_sync_status,
    cvl.rejection_reason as cvlkra_rejection_reason,
    cdsl.cdsl_push_status,
    cdsl.rejection_reason as cdsl_rejection_reason,
    tech.techexcel_push_status,
    tech.rejection_reason as techexcel_rejection_reason
  FROM public.kyc_applications ka
  LEFT JOIN public.contact_details cd ON cd.application_id = ka.id
  LEFT JOIN public.client_codes cc ON cc.email = cd.email
  LEFT JOIN public.identity_verifications iv ON iv.application_id = ka.id
  LEFT JOIN public.digilocker_details digi ON digi.application_id = ka.id::text
  LEFT JOIN public.nse_data nse ON nse.application_id = ka.id
  LEFT JOIN public.bse_data bse ON bse.application_id = ka.id
  LEFT JOIN public.cvlkra_data cvl ON cvl.application_id = ka.id
  LEFT JOIN public.cdsl_data cdsl ON cdsl.application_id = ka.id
  LEFT JOIN public.techexcel tech ON tech."Client_id" = ka.client_code
`;


const getClientIntegrationDetailsQuery = `
  SELECT row_to_json(payload) as data
  FROM (
    SELECT
      ka.id as application_id,
      ka.current_step as current_stage,
      ka.kyc_status,
      COALESCE(cc.client_code, ka.client_code) as client_code,
      COALESCE(iv.full_name, digi.name, cvl.app_name, tech."Client_Name") as client_name,
      cd.email,
      cd.mobile_number,
      COALESCE(iv.pan_number, cvl.app_pan_no, tech."PAN_NO") as pan_number,
      (
        SELECT row_to_json(nse_row)
        FROM (
          SELECT 
            nse_push_status as status,
            rejection_reason,
            created_at as request_date_time,
            updated_at as response_date_time,
            NULL as retry_count,
            NULL as last_api_response
          FROM public.nse_data
          WHERE application_id = ka.id LIMIT 1
        ) as nse_row
      ) as nse,
      (
        SELECT row_to_json(bse_row)
        FROM (
          SELECT 
            bse_status as status,
            rejection_reason,
            created_at as request_date_time,
            updated_at as response_date_time,
            NULL as retry_count,
            NULL as last_api_response
          FROM public.bse_data
          WHERE application_id = ka.id LIMIT 1
        ) as bse_row
      ) as bse,
      (
        SELECT row_to_json(cvl_row)
        FROM (
          SELECT 
            sync_status as status,
            rejection_reason,
            created_at as request_date_time,
            updated_at as response_date_time,
            NULL as retry_count,
            NULL as last_api_response
          FROM public.cvlkra_data
          WHERE application_id = ka.id LIMIT 1
        ) as cvl_row
      ) as cvlkra,
      (
        SELECT row_to_json(cdsl_row)
        FROM (
          SELECT 
            cdsl_push_status as status,
            rejection_reason,
            created_at as request_date_time,
            updated_at as response_date_time,
            NULL as retry_count,
            NULL as last_api_response
          FROM public.cdsl_data
          WHERE application_id = ka.id LIMIT 1
        ) as cdsl_row
      ) as cdsl,
      (
        SELECT row_to_json(tech_row)
        FROM (
          SELECT 
            techexcel_push_status as status,
            rejection_reason,
            created_at as request_date_time,
            updated_at as response_date_time,
            NULL as retry_count,
            NULL as last_api_response
          FROM public.techexcel
          WHERE "Client_id" = ka.client_code LIMIT 1
        ) as tech_row
      ) as techexcel
    FROM public.kyc_applications ka
    LEFT JOIN public.contact_details cd ON cd.application_id = ka.id
    LEFT JOIN public.client_codes cc ON cc.email = cd.email
    LEFT JOIN public.identity_verifications iv ON iv.application_id = ka.id
    LEFT JOIN public.digilocker_details digi ON digi.application_id = ka.id::text
    LEFT JOIN public.cvlkra_data cvl ON cvl.application_id = ka.id
    LEFT JOIN public.techexcel tech ON tech."Client_id" = ka.client_code
    WHERE COALESCE(cc.client_code, ka.client_code) = $1
  ) as payload;
`;

const getClientIntegrationDetailsByIdQuery = `
  SELECT row_to_json(payload) as data
  FROM (
    SELECT
      ka.id as application_id,
      ka.current_step as current_stage,
      ka.kyc_status,
      COALESCE(cc.client_code, ka.client_code) as client_code,
      COALESCE(iv.full_name, digi.name, cvl.app_name, tech."Client_Name") as client_name,
      cd.email,
      cd.mobile_number,
      COALESCE(iv.pan_number, cvl.app_pan_no, tech."PAN_NO") as pan_number,
      (
        SELECT row_to_json(nse_row)
        FROM (
          SELECT 
            nse_push_status as status,
            rejection_reason,
            created_at as request_date_time,
            updated_at as response_date_time,
            NULL as retry_count,
            NULL as last_api_response
          FROM public.nse_data
          WHERE application_id = ka.id LIMIT 1
        ) as nse_row
      ) as nse,
      (
        SELECT row_to_json(bse_row)
        FROM (
          SELECT 
            bse_status as status,
            rejection_reason,
            created_at as request_date_time,
            updated_at as response_date_time,
            NULL as retry_count,
            NULL as last_api_response
          FROM public.bse_data
          WHERE application_id = ka.id LIMIT 1
        ) as bse_row
      ) as bse,
      (
        SELECT row_to_json(cvl_row)
        FROM (
          SELECT 
            sync_status as status,
            rejection_reason,
            created_at as request_date_time,
            updated_at as response_date_time,
            NULL as retry_count,
            NULL as last_api_response
          FROM public.cvlkra_data
          WHERE application_id = ka.id LIMIT 1
        ) as cvl_row
      ) as cvlkra,
      (
        SELECT row_to_json(cdsl_row)
        FROM (
          SELECT 
            cdsl_push_status as status,
            rejection_reason,
            created_at as request_date_time,
            updated_at as response_date_time,
            NULL as retry_count,
            NULL as last_api_response
          FROM public.cdsl_data
          WHERE application_id = ka.id LIMIT 1
        ) as cdsl_row
      ) as cdsl,
      (
        SELECT row_to_json(tech_row)
        FROM (
          SELECT 
            techexcel_push_status as status,
            rejection_reason,
            created_at as request_date_time,
            updated_at as response_date_time,
            NULL as retry_count,
            NULL as last_api_response
          FROM public.techexcel
          WHERE "Client_id" = ka.client_code LIMIT 1
        ) as tech_row
      ) as techexcel
    FROM public.kyc_applications ka
    LEFT JOIN public.contact_details cd ON cd.application_id = ka.id
    LEFT JOIN public.client_codes cc ON cc.email = cd.email
    LEFT JOIN public.identity_verifications iv ON iv.application_id = ka.id
    LEFT JOIN public.digilocker_details digi ON digi.application_id = ka.id::text
    LEFT JOIN public.cvlkra_data cvl ON cvl.application_id = ka.id
    LEFT JOIN public.techexcel tech ON tech."Client_id" = ka.client_code
    WHERE ka.id = $1
  ) as payload;
`;

const getClientKycStagesQuery = `
  SELECT 
    stage_name as "stageName",
    stage_status as status,
    stage_source as source,
    error_message as "errorMessage",
    completed_at as "completedAt",
    last_updated_at as "lastUpdated",
    metadata as details
  FROM public.kyc_stage_status
  WHERE application_id = $1
  ORDER BY stage_order ASC;
`;

const getClientKycFullDetailsQuery = `
  SELECT row_to_json(payload) as data
  FROM (
    SELECT 
      (SELECT row_to_json(app) FROM (
        SELECT 
          ka_inner.current_step as current_stage,
          ka_inner.kyc_status,
          COALESCE(cc.client_code, ka_inner.client_code) as client_code,
          COALESCE(iv.full_name, digi.name, cvl.app_name, tech."Client_Name") as full_name, 
          COALESCE(iv.pan_number, cvl.app_pan_no, tech."PAN_NO") as pan_number, 
          cd.email, 
          cd.mobile_number 
        FROM public.kyc_applications ka_inner
        LEFT JOIN public.contact_details cd ON cd.application_id = ka_inner.id
        LEFT JOIN public.client_codes cc ON cc.email = cd.email
        LEFT JOIN public.identity_verifications iv ON iv.application_id = ka_inner.id
        LEFT JOIN public.digilocker_details digi ON digi.application_id = ka_inner.id::text
        LEFT JOIN public.cvlkra_data cvl ON cvl.application_id = ka_inner.id
        LEFT JOIN public.techexcel tech ON tech."Client_id" = ka_inner.client_code
        WHERE ka_inner.id = $1 LIMIT 1
      ) app) as application,
      
      (SELECT row_to_json(stgs) FROM (
        SELECT
          (SELECT row_to_json(os) FROM public.otp_sessions os JOIN public.contact_details cd ON cd.mobile_number = os.mobile_number WHERE cd.application_id = ka.id LIMIT 1) as mobile_verification,
          (SELECT row_to_json(eo) FROM public.email_otp_sessions eo JOIN public.contact_details cd ON cd.email = eo.email WHERE cd.application_id = ka.id LIMIT 1) as email_verification,
          (SELECT row_to_json(iv) FROM public.identity_verifications iv WHERE iv.application_id = ka.id LIMIT 1) as pan_and_dob,
          (SELECT row_to_json(cvl) FROM public.cvlkra_data cvl WHERE cvl.application_id = ka.id LIMIT 1) as kra_details,
          (SELECT row_to_json(bd) FROM public.bank_details bd WHERE bd.application_id = ka.id LIMIT 1) as bank_details,
          (SELECT row_to_json(per) FROM public.personal_details per WHERE per.application_id = ka.id LIMIT 1) as personal_details,
          (SELECT json_agg(row_to_json(nd)) FROM public.nominee_details nd WHERE nd.application_id = ka.id) as nominee_details,
          (SELECT row_to_json(apu) FROM public.applicant_photo_uploads apu WHERE apu.application_id = ka.id LIMIT 1) as live_photo,
          (SELECT row_to_json(su) FROM public.signature_uploads su WHERE su.application_id = ka.id LIMIT 1) as signature_upload,
          (SELECT row_to_json(ka2) FROM public.kyc_applications ka2 WHERE ka2.id = ka.id LIMIT 1) as scheme_details,
          (SELECT row_to_json(pmt) FROM public.payments_details pmt WHERE pmt.application_id = ka.id LIMIT 1) as payment_summary,
          (SELECT row_to_json(doc) FROM public.application_compliance_documents doc WHERE doc.application_id = ka.id LIMIT 1) as esign
        FROM public.kyc_applications ka
        WHERE ka.id = $1 LIMIT 1
      ) stgs) as stages
  ) as payload;
`;

const getClientKycOverallStatusQuery = `
  SELECT 
    overall_status as "overallStatus",
    progress_percentage as "progressPercentage"
  FROM public.kyc_overall_status_vw
  WHERE application_id = $1
  LIMIT 1;
`;

const getPaymentsListBaseQuery = `
  SELECT
    pd.txnid as transaction_id,
    pd.amount,
    pd.created_at as payment_date,
    pd.payment_status,
    cd.mobile_number,
    COALESCE(iv.full_name, digi.name, cvl.app_name, tech."Client_Name") as client_name
  FROM public.payments_details pd
  LEFT JOIN public.kyc_applications ka ON ka.id = pd.application_id
  LEFT JOIN public.contact_details cd ON cd.application_id = pd.application_id
  LEFT JOIN public.identity_verifications iv ON iv.application_id = pd.application_id
  LEFT JOIN public.digilocker_details digi ON digi.application_id = pd.application_id::text
  LEFT JOIN public.cvlkra_data cvl ON cvl.application_id = pd.application_id
  LEFT JOIN public.techexcel tech ON tech."Client_id" = ka.client_code
`;

module.exports = {
  getDashboardSummaryQuery,
  getClientsListBaseQuery,
  getClientIntegrationDetailsQuery,
  getClientIntegrationDetailsByIdQuery,
  getClientKycStagesQuery,
  getClientKycOverallStatusQuery,
  getClientKycFullDetailsQuery,
  getPaymentsListBaseQuery
};
