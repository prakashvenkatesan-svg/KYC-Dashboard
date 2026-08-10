const pool = require('./Backend/config/db');
pool.query(`
SELECT 
    tc.constraint_name, tc.table_name, kcu.column_name, 
    tc.constraint_type
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
WHERE tc.table_name = 'payments_details';
`)
  .then(res => { console.table(res.rows); pool.end(); })
  .catch(console.error);
