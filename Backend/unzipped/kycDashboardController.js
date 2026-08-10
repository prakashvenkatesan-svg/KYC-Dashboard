const pool = require("./config/db");
const {
  getDashboardSummaryQuery,
  getClientsListBaseQuery,
  getClientIntegrationDetailsQuery
} = require("./kycDashboardQueries"); // assuming it's in the same folder

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
    const {
      q = "",
      integration = "",
      status = "",
      limit = "20",
      offset = "0"
    } = req.query;

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

    const conditions = [];
    const params = [];

    if (q.trim()) {
      params.push(`%${q.trim()}%`);
      const idx = params.length;
      conditions.push(`
        (
          tech."Client_id" ILIKE $${idx}
          OR tech."PAN_NO" ILIKE $${idx}
          OR cd.email ILIKE $${idx}
          OR cd.mobile_number ILIKE $${idx}
          OR tech."Client_Name" ILIKE $${idx}
        )
      `);
    }

    if (integration || status) {
      if (integration) {
        // Dynamic filtering based on integration name
        const validIntegrations = {
          'nse': 'nse.nse_push_status',
          'bse': 'bse.bse_status',
          'cvlkra': 'cvl.sync_status',
          'cdsl': 'cdsl.cdsl_push_status',
          'techexcel': 'tech.techexcel_push_status'
        };

        const column = validIntegrations[integration.toLowerCase()];
        if (column && status) {
          // Status mapping to cover multiple variations
          const s = status.toUpperCase();
          let statusList = [];
          if (s === 'SUCCESS') statusList = ['Success', 'SUCCESS', 'S'];
          else if (s === 'PENDING') statusList = ['Pending', 'PENDING', 'P'];
          else if (s === 'REJECTED') statusList = ['Rejected', 'REJECTED', 'R', 'Failed', 'FAILED', 'F'];
          else if (s === 'FAILED') statusList = ['Failed', 'FAILED', 'F', 'Rejected', 'REJECTED', 'R'];
          else if (s === 'UPLOADED') statusList = ['Uploaded', 'UPLOADED', 'U'];
          
          if (statusList.length > 0) {
            const placeholders = statusList.map((st) => {
              params.push(st);
              return `$${params.length}`;
            });
            conditions.push(`${column} IN (${placeholders.join(',')})`);
          }
        } else if (column) {
            // Just filter by integration existing/not null
            conditions.push(`${column} IS NOT NULL`);
        }
      } else if (status) {
         // Filter by status across ANY integration
          const s = status.toUpperCase();
          let statusList = [];
          if (s === 'SUCCESS') statusList = ['Success', 'SUCCESS', 'S'];
          else if (s === 'PENDING') statusList = ['Pending', 'PENDING', 'P'];
          else if (s === 'REJECTED') statusList = ['Rejected', 'REJECTED', 'R', 'Failed', 'FAILED', 'F'];
          else if (s === 'FAILED') statusList = ['Failed', 'FAILED', 'F', 'Rejected', 'REJECTED', 'R'];
          else if (s === 'UPLOADED') statusList = ['Uploaded', 'UPLOADED', 'U'];
          
          if (statusList.length > 0) {
            const placeholders = statusList.map((st) => {
              params.push(st);
              return `$${params.length}`;
            });
            const pList = placeholders.join(',');
            conditions.push(`(
              nse.nse_push_status IN (${pList})
              OR bse.bse_status IN (${pList})
              OR cvl.sync_status IN (${pList})
              OR cdsl.cdsl_push_status IN (${pList})
              OR tech.techexcel_push_status IN (${pList})
            )`);
          }
      }
    }

    let query = getClientsListBaseQuery;

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    params.push(parsedLimit, parsedOffset);
    query += ` ORDER BY ka.updated_at DESC NULLS LAST LIMIT $${params.length - 1} OFFSET $${params.length}`;

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

    // To get total count for pagination, run the same query without LIMIT/OFFSET
    let countQuery = `SELECT COUNT(*) FROM public.kyc_applications ka 
                      LEFT JOIN public.contact_details cd ON cd.application_id = ka.id
                      LEFT JOIN public.personal_details pd ON pd.application_id = ka.id
                      LEFT JOIN public.nse_data nse ON nse.application_id = ka.id
                      LEFT JOIN public.bse_data bse ON bse.application_id = ka.id
                      LEFT JOIN public.cvlkra_data cvl ON cvl.application_id = ka.id
                      LEFT JOIN public.cdsl_data cdsl ON cdsl.application_id = ka.id
                      LEFT JOIN public.techexcel tech ON tech."EMAIL_ID" = cd.email`;
    
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

const getIntegrationRecords = async (req, res) => {
    // We can just reuse getClients and pass the integration filter
    req.query.integration = req.params.integrationName;
    return getClients(req, res);
};

module.exports = {
  getDashboardSummary,
  getClients,
  getClientByCode,
  getIntegrationRecords
};
