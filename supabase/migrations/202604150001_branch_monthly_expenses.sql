-- ============================================================
-- Naya System — Branch monthly expenses ledger
-- ============================================================

CREATE TABLE IF NOT EXISTS branch_monthly_expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  month_period TEXT NOT NULL,
  category     TEXT NOT NULL,
  amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  receipt_url  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT branch_monthly_expenses_month_format
    CHECK (month_period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT branch_monthly_expenses_amount_non_negative
    CHECK (amount >= 0),
  CONSTRAINT branch_monthly_expenses_allowed_category
    CHECK (
      category IN (
        'Royalty',
        'US Foods',
        'Lenard Paper',
        'PFG',
        'Keany''s',
        'Warehouse',
        'Gas',
        'Power',
        'Water',
        'Rent',
        'Labor',
        'Bread',
        'Ecolab',
        'Hood Cleaning',
        'Maintenance',
        'Square Fees',
        'TX',
        'Delivery Fee',
        'Marketing'
      )
    ),
  CONSTRAINT branch_monthly_expenses_unique_row
    UNIQUE (branch_id, month_period, category)
);

CREATE INDEX IF NOT EXISTS idx_branch_monthly_expenses_branch_period
  ON branch_monthly_expenses (branch_id, month_period);

CREATE INDEX IF NOT EXISTS idx_branch_monthly_expenses_category
  ON branch_monthly_expenses (branch_id, category, month_period);

CREATE OR REPLACE FUNCTION set_branch_monthly_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_branch_monthly_expenses_updated_at ON branch_monthly_expenses;

CREATE TRIGGER trg_branch_monthly_expenses_updated_at
BEFORE UPDATE ON branch_monthly_expenses
FOR EACH ROW
EXECUTE FUNCTION set_branch_monthly_expenses_updated_at();

ALTER TABLE branch_monthly_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_access_branch_monthly_expenses"
  ON branch_monthly_expenses FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
