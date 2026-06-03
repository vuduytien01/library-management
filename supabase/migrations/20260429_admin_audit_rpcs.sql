-- ============================================================
-- BIBLIOTECH SECURITY AUDIT RPCs
-- Adds diagnostic functions for administrative security dashboard
-- ============================================================

-- 1. Check Row-Level Security (RLS) status for all public tables
CREATE OR REPLACE FUNCTION public.check_rls_status()
RETURNS TABLE (relname TEXT, is_rls_enabled BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.relname::TEXT, 
        c.relrowsecurity AS is_rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
      AND c.relkind = 'r' -- only tables
      AND c.relname NOT IN ('schema_migrations', 'request_logs'); -- exclude system tables
END;
$$;

-- 2. Check for overly permissive policies (e.g., using 'true' as USING clause)
CREATE OR REPLACE FUNCTION public.check_permissive_policies()
RETURNS TABLE (tablename TEXT, policyname TEXT, cmd TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname::TEXT || '.' || tablename::TEXT as tablename,
        policyname::TEXT,
        cmd::TEXT
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
          qual ILIKE '%true%' OR 
          with_check ILIKE '%true%' OR
          (qual IS NULL AND with_check IS NULL)
      )
      AND policyname NOT ILIKE '%admin%' -- Ignore admin policies which are naturally permissive for admins
      AND policyname NOT ILIKE '%service%';
END;
$$;

-- 3. Check for sensitive tables with public access (no auth check in policy)
CREATE OR REPLACE FUNCTION public.check_public_access()
RETURNS TABLE (tablename TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        p.tablename::TEXT
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND NOT (
          p.qual ILIKE '%auth.uid()%' OR 
          p.qual ILIKE '%auth.role()%' OR
          p.with_check ILIKE '%auth.uid()%' OR
          p.with_check ILIKE '%auth.role()%'
      );
END;
$$;

-- Grant access to authenticated users (Dashboard needs this)
GRANT EXECUTE ON FUNCTION public.check_rls_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_permissive_policies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_public_access() TO authenticated;
