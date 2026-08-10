require('dotenv').config({ path: './Backend/.env' });
const pool = require('./Backend/config/db');
pool.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'kyc_stage_audit_logs';`)
  .then(res => { console.table(res.rows); return pool.query(`SELECT * FROM public.kyc_stage_audit_logs LIMIT 1;`); })
  .then(res => { console.log("Sample Data:", res.rows); pool.end(); })
  .catch(err => { console.error(err); pool.end(); });
