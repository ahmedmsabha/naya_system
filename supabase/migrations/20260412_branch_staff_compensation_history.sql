-- ============================================================
-- Naya System — Staff compensation history (monthly snapshots)
-- ============================================================

CREATE TABLE IF NOT EXISTS branch_staff_compensation_history (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id           UUID NOT NULL REFERENCES branch_staff(id) ON DELETE CASCADE,
  branch_id          UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  recorded_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_month    DATE NOT NULL,
  full_name          TEXT NOT NULL,
  email              TEXT,
  phone              TEXT,
  employee_code      TEXT,
  adp_status         TEXT NOT NULL DEFAULT 'not_connected',
  salary_period      TEXT NOT NULL DEFAULT 'monthly',
  base_salary        NUMERIC(12,2) NOT NULL DEFAULT 0,
  salary_p1          NUMERIC(12,2) NOT NULL DEFAULT 0,
  salary_p2          NUMERIC(12,2) NOT NULL DEFAULT 0,
  salary_p3          NUMERIC(12,2) NOT NULL DEFAULT 0,
  salary_p4          NUMERIC(12,2) NOT NULL DEFAULT 0,
  performance_rating NUMERIC(3,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_staff_comp_hist_staff_month
  ON branch_staff_compensation_history (staff_id, effective_month DESC);

CREATE INDEX IF NOT EXISTS idx_staff_comp_hist_branch_month
  ON branch_staff_compensation_history (branch_id, effective_month DESC);

ALTER TABLE branch_staff_compensation_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_access_staff_comp_history"
  ON branch_staff_compensation_history FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
