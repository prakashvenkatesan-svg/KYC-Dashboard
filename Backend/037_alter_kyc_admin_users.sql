-- Add multiple admin login features to kyc_admin_users
ALTER TABLE public.kyc_admin_users 
ADD COLUMN IF NOT EXISTS employee_code VARCHAR(100) UNIQUE,
ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'Active',
ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);
