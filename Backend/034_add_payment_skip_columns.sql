-- Add audit trail columns for Payment Skipping feature
ALTER TABLE public.payments_details 
ADD COLUMN IF NOT EXISTS skipped_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS skipped_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS skip_reason TEXT;
