const pool = require('./config/db');

async function runSetup() {
  try {
    console.log("Starting DB Setup...");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.system_audit_logs (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255),
          user_name VARCHAR(255),
          user_role VARCHAR(50),
          action_type VARCHAR(50),
          module VARCHAR(100),
          entity_type VARCHAR(100),
          entity_id VARCHAR(255),
          client_code VARCHAR(255),
          field_name VARCHAR(100),
          old_value TEXT,
          new_value TEXT,
          changes_json JSONB,
          description TEXT,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Created system_audit_logs table.");

    try {
      await pool.query(`ALTER TABLE public.kyc_admin_users ADD COLUMN employee_code VARCHAR(100) UNIQUE;`);
      console.log("Added employee_code to kyc_admin_users.");
    } catch (e) { console.log("employee_code already exists or error: " + e.message); }

    try {
      await pool.query(`ALTER TABLE public.kyc_admin_users ADD COLUMN account_status VARCHAR(20) DEFAULT 'Active';`);
      console.log("Added account_status to kyc_admin_users.");
    } catch (e) { console.log("account_status already exists or error: " + e.message); }

    try {
      await pool.query(`ALTER TABLE public.kyc_admin_users ADD COLUMN created_by VARCHAR(255);`);
      console.log("Added created_by to kyc_admin_users.");
    } catch (e) { console.log("created_by already exists or error: " + e.message); }

    console.log("Setup complete!");
  } catch (err) {
    console.error("Setup failed:", err);
  } finally {
    pool.end();
  }
}

runSetup();
