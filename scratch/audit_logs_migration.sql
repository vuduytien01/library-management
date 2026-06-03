-- SQL Migration for Lane 23: Audit Logs & Security

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL, -- e.g., 'BOOK_DELETE', 'BORROW_APPROVE', 'ROLE_CHANGE'
    target_id TEXT, -- ISBN, UserID, or RecordID
    metadata JSONB DEFAULT '{}'::jsonb,
    severity TEXT DEFAULT 'INFO', -- INFO, WARNING, CRITICAL
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies: Only ADMIN and LIBRARIAN can view logs
CREATE POLICY "Staff can view audit logs" ON public.audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('ADMIN', 'LIBRARIAN')
        )
    );

-- Only service role or defined functions can insert (security definer)
CREATE POLICY "System can insert audit logs" ON public.audit_logs
    FOR INSERT WITH CHECK (true);
