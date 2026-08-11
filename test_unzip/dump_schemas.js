const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

async function getSchemas() {
  const tables = [
    'nse_data', 'bse_data', 'cvlkra_data', 'cdsl_data', 'techexcel'
  ];

  for (let table of tables) {
    try {
      const res = await pool.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`,
        [table]
      );
      console.log(`\n--- ${table} ---`);
      res.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));
    } catch (e) {
      console.log(`Error on ${table}: ${e.message}`);
    }
  }
  process.exit(0);
}

getSchemas();
