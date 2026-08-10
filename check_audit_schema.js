const pool = require('./Backend/config/db');
pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'kyc_stage_audit_logs';`)
  .then(res => { console.table(res.rows); pool.end(); })
  .catch(console.error);
