-- ============================================================
-- Naya System — Staffing snapshot extra fields
-- ============================================================

ALTER TABLE branch_staff_compensation_history
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'crew',
  ADD COLUMN IF NOT EXISTS shift TEXT NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS hours_per_week NUMERIC(6,2) NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS employment_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';
