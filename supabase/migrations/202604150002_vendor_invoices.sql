-- ============================================================
-- Naya System — Vendor invoices module
-- ============================================================

CREATE TABLE IF NOT EXISTS vendor_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  vendor_name TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vendor_invoices_amount_non_negative CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_vendor_invoices_branch_invoice_date
  ON vendor_invoices (branch_id, invoice_date DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_invoices_branch_vendor_month
  ON vendor_invoices (branch_id, vendor_name, invoice_date DESC);

ALTER TABLE vendor_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_access_vendor_invoices" ON vendor_invoices;

CREATE POLICY "authenticated_access_vendor_invoices"
  ON vendor_invoices FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
