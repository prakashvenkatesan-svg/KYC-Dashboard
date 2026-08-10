const { Pool } = require("pg");
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'kyc_db',
  port: process.env.DB_PORT || 5432,
  ssl: false
});

async function runSetup() {
  try {
    console.log("Setting up stage_lifecycle_timestamps...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.stage_lifecycle_timestamps (
          id SERIAL PRIMARY KEY,
          application_id INT,
          stage_name VARCHAR(100),
          entered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          duration_seconds INT
      );
    `);
    
    // Create trigger function
    await pool.query(`
      CREATE OR REPLACE FUNCTION track_stage_lifecycle()
      RETURNS TRIGGER AS $$
      BEGIN
          IF OLD.current_step IS DISTINCT FROM NEW.current_step THEN
              -- Mark old stage as completed
              UPDATE public.stage_lifecycle_timestamps
              SET completed_at = CURRENT_TIMESTAMP,
                  duration_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - entered_at))
              WHERE application_id = NEW.id AND stage_name = OLD.current_step AND completed_at IS NULL;

              -- Insert new stage entry
              INSERT INTO public.stage_lifecycle_timestamps (application_id, stage_name, entered_at)
              VALUES (NEW.id, NEW.current_step, CURRENT_TIMESTAMP);
          END IF;
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Attach trigger
    await pool.query(`
      DROP TRIGGER IF EXISTS stage_lifecycle_trigger ON public.kyc_applications;
      CREATE TRIGGER stage_lifecycle_trigger
      BEFORE UPDATE ON public.kyc_applications
      FOR EACH ROW
      EXECUTE FUNCTION track_stage_lifecycle();
    `);
    
    console.log("Setup complete!");
  } catch (err) {
    console.error("Setup failed:", err);
  } finally {
    pool.end();
  }
}

runSetup();
