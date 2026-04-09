-- ============================================================
-- Naya System — Warehouse Module Tables
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ── 1. Weekly Distribution Log ──────────────────────────────
CREATE TABLE IF NOT EXISTS warehouse_distributions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  ingredient_id   UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  quantity        NUMERIC(10,3) NOT NULL DEFAULT 0,
  distributed_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  -- One row per branch + ingredient + day
  UNIQUE (branch_id, ingredient_id, distributed_at)
);

-- ── 2. Warehouse Invoices ────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouse_invoices (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id            UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  invoice_number       TEXT NOT NULL,
  total_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  billing_period_start DATE NOT NULL,
  billing_period_end   DATE NOT NULL,
  status               TEXT NOT NULL DEFAULT 'active', -- 'active' | 'archived'
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- ── 3. Invoice Line Items ────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouse_invoice_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES warehouse_invoices(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id),
  quantity      NUMERIC(10,3) NOT NULL,
  unit_cost     NUMERIC(10,4) NOT NULL,
  amount        NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED
);

-- ── 4. Enable RLS ────────────────────────────────────────────
ALTER TABLE warehouse_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_invoice_items ENABLE ROW LEVEL SECURITY;

-- ── 5. RLS Policies (super_admin sees all; branch staff sees own) ──
-- For now, allow authenticated users full access (tighten per role later)
CREATE POLICY "authenticated_access_distributions"
  ON warehouse_distributions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_access_invoices"
  ON warehouse_invoices FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_access_invoice_items"
  ON warehouse_invoice_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── 6. Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_dist_branch_date
  ON warehouse_distributions (branch_id, distributed_at);

CREATE INDEX IF NOT EXISTS idx_invoices_branch_status
  ON warehouse_invoices (branch_id, status);

-- ── 7. Ensure ingredients table also has RLS policy if missing ──
-- (ingredients may not have been secured yet)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ingredients' AND policyname = 'authenticated_access_ingredients'
  ) THEN
    ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "authenticated_access_ingredients"
      ON ingredients FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- ── 8. Ensure inventory table has proper RLS ──────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'inventory' AND policyname = 'authenticated_access_inventory'
  ) THEN
    ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "authenticated_access_inventory"
      ON inventory FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
