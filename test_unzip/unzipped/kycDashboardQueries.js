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
    tech."Client_id" as client_code,
    ka.created_at as application_date,
    ka.updated_at as last_updated,
    cd.email,
    cd.mobile_number,
    tech."Client_Name" as client_name,
    tech."PAN_NO" as pan_number,
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
  LEFT JOIN public.personal_details pd ON pd.application_id = ka.id
  LEFT JOIN public.nse_data nse ON nse.application_id = ka.id
  LEFT JOIN public.bse_data bse ON bse.application_id = ka.id
  LEFT JOIN public.cvlkra_data cvl ON cvl.application_id = ka.id
  LEFT JOIN public.cdsl_data cdsl ON cdsl.application_id = ka.id
  LEFT JOIN public.techexcel tech ON tech."EMAIL_ID" = cd.email
`;

const getClientIntegrationDetailsQuery = `
  SELECT row_to_json(payload) as data
  FROM (
    SELECT
      tech."Client_id" as client_code,
      tech."Client_Name" as client_name,
      cd.email,
      cd.mobile_number,
      tech."PAN_NO" as pan_number,
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
          WHERE "EMAIL_ID" = cd.email LIMIT 1
        ) as tech_row
      ) as techexcel
    FROM public.kyc_applications ka
    LEFT JOIN public.contact_details cd ON cd.application_id = ka.id
    LEFT JOIN public.personal_details pd ON pd.application_id = ka.id
    LEFT JOIN public.techexcel tech ON tech."EMAIL_ID" = cd.email
    WHERE tech."Client_id" = $1
  ) as payload;
`;

module.exports = {
  getDashboardSummaryQuery,
  getClientsListBaseQuery,
  getClientIntegrationDetailsQuery
};
