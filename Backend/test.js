const pool = require('./config/db');
async function run() {
  const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'payments_details'");
  console.log(res.rows);
  
  const res2 = await pool.query("SELECT * FROM payments_details LIMIT 1");
  console.log("SAMPLE:", res2.rows[0]);
  process.exit(0);
}
run();
