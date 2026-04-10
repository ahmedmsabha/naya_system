-- ============================================================
-- Naya System — Staffing Salary Parts
-- ============================================================

ALTER TABLE branch_staff
  ADD COLUMN IF NOT EXISTS salary_p1 NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salary_p2 NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salary_p3 NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salary_p4 NUMERIC(12,2) NOT NULL DEFAULT 0;

