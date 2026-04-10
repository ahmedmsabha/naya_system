-- ============================================================
-- Naya System — Staffing Module Tables
-- ============================================================

-- ── 1. Branch Staff (Employees) ──────────────────────────────
CREATE TABLE IF NOT EXISTS branch_staff (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id          UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  full_name         TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  employee_code     TEXT, -- optional internal ID (e.g., 12028)
  adp_status        TEXT NOT NULL DEFAULT 'not_connected', -- 'connected' | 'not_connected'
  adp_employee_id   TEXT,
  base_salary       NUMERIC(12,2) NOT NULL DEFAULT 0,
  salary_currency   TEXT NOT NULL DEFAULT 'USD',
  salary_period     TEXT NOT NULL DEFAULT 'monthly', -- 'hourly' | 'weekly' | 'biweekly' | 'monthly'
  performance_rating NUMERIC(3,2) NOT NULL DEFAULT 0, -- e.g. 4.60
  status            TEXT NOT NULL DEFAULT 'active', -- 'active' | 'inactive'
  hired_at          DATE DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branch_staff_branch_status
  ON branch_staff (branch_id, status);

-- ── 2. Payroll Sync Log (placeholder for ADP integration) ─────
CREATE TABLE IF NOT EXISTS branch_payroll_syncs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL DEFAULT 'adp',
  status      TEXT NOT NULL DEFAULT 'success', -- 'success' | 'failed'
  message     TEXT,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_syncs_branch_time
  ON branch_payroll_syncs (branch_id, synced_at DESC);

-- ── 3. Enable RLS ────────────────────────────────────────────
ALTER TABLE branch_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_payroll_syncs ENABLE ROW LEVEL SECURITY;

-- ── 4. RLS Policies (tighten later) ───────────────────────────
CREATE POLICY "authenticated_access_branch_staff"
  ON branch_staff FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "authenticated_access_payroll_syncs"
  ON branch_payroll_syncs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

