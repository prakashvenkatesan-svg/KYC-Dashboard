CREATE TABLE IF NOT EXISTS public.user_table_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.kyc_admin_users(id) ON DELETE CASCADE,
    page_code VARCHAR(100) NOT NULL,
    visible_columns JSONB NOT NULL,
    column_order JSONB NOT NULL,
    sort_by VARCHAR(100),
    sort_order VARCHAR(10),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, page_code)
);
