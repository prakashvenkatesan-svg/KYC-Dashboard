-- Add audit trail columns for Payment Bypass feature
ALTER TABLE public.payments_details 
ADD COLUMN IF NOT EXISTS payment_bypass_allowed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payment_bypass_reason TEXT,
ADD COLUMN IF NOT EXISTS payment_bypass_approved_by VARCHAR(100),
ADD COLUMN IF NOT EXISTS payment_bypass_approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS payment_bypass_rm_confirmation TEXT;
