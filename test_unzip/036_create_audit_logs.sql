-- Create System Audit Logs Table
CREATE TABLE public.system_audit_logs (
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
