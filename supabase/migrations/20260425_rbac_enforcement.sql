-- ============================================================
-- Naya Enterprise — RBAC + Multi-tenancy RLS Enforcement
-- Step 1: Database & RLS Enforcement (Supabase)
-- ============================================================

-- Ensure `users` table has required columns (role + branch_id).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS role TEXT;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS branch_id UUID;

-- ------------------------------------------------------------
-- Helper: drop all existing policies on a table (idempotent)
-- ------------------------------------------------------------
DO $$
DECLARE
  p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('inventory', 'sales', 'branch_monthly_expenses', 'warehouse_invoices')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I;', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- Enforce RLS for core tables
-- RLS logic (as required):
-- USING (
--   (auth.jwt()->'user_metadata'->>'role' = 'super_admin')
--   OR (branch_id = (auth.jwt()->'user_metadata'->>'branch_id')::uuid)
-- )
-- ------------------------------------------------------------

-- inventory
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_rbac_enforced
  ON public.inventory
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt()->'user_metadata'->>'role' = 'super_admin')
    OR (branch_id = (auth.jwt()->'user_metadata'->>'branch_id')::uuid)
  )
  WITH CHECK (
    (auth.jwt()->'user_metadata'->>'role' = 'super_admin')
    OR (branch_id = (auth.jwt()->'user_metadata'->>'branch_id')::uuid)
  );

-- sales
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_rbac_enforced
  ON public.sales
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt()->'user_metadata'->>'role' = 'super_admin')
    OR (branch_id = (auth.jwt()->'user_metadata'->>'branch_id')::uuid)
  )
  WITH CHECK (
    (auth.jwt()->'user_metadata'->>'role' = 'super_admin')
    OR (branch_id = (auth.jwt()->'user_metadata'->>'branch_id')::uuid)
  );

-- branch_monthly_expenses
ALTER TABLE public.branch_monthly_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_monthly_expenses_rbac_enforced
  ON public.branch_monthly_expenses
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt()->'user_metadata'->>'role' = 'super_admin')
    OR (branch_id = (auth.jwt()->'user_metadata'->>'branch_id')::uuid)
  )
  WITH CHECK (
    (auth.jwt()->'user_metadata'->>'role' = 'super_admin')
    OR (branch_id = (auth.jwt()->'user_metadata'->>'branch_id')::uuid)
  );

-- warehouse_invoices
ALTER TABLE public.warehouse_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY warehouse_invoices_rbac_enforced
  ON public.warehouse_invoices
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt()->'user_metadata'->>'role' = 'super_admin')
    OR (branch_id = (auth.jwt()->'user_metadata'->>'branch_id')::uuid)
  )
  WITH CHECK (
    (auth.jwt()->'user_metadata'->>'role' = 'super_admin')
    OR (branch_id = (auth.jwt()->'user_metadata'->>'branch_id')::uuid)
  );

