const pool = require('./config/db');

async function test() {
  try {
    console.log("Running query...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.admin_users (
          id SERIAL PRIMARY KEY,
          full_name VARCHAR(100) NOT NULL,
          email_id VARCHAR(100) UNIQUE NOT NULL,
          mobile_number VARCHAR(15),
          username VARCHAR(50) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL DEFAULT 'User',
          account_status VARCHAR(20) NOT NULL DEFAULT 'Active',
          assigned_modules JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP WITH TIME ZONE
      );
      
      INSERT INTO public.admin_users (full_name, email_id, mobile_number, username, password_hash, role, assigned_modules)
      SELECT 'Super Admin', 'admin@aionioncapital.com', '0000000000', 'admin', 
             '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGTRsyvwxBgC31Lgq', 
             'Admin', 
             '["Dashboard", "Clients", "NSE", "BSE", "CVL KRA", "CDSL", "TechExcel", "User Management"]'
      WHERE NOT EXISTS (
          SELECT id FROM public.admin_users WHERE username = 'admin'
      );
    `);
    console.log("Query success");
  } catch (err) {
    console.error("Query failed:", err);
  } finally {
    pool.end();
  }
}
test();
