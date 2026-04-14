-- Enforce one weekly invoice per branch (Mon-Sun window).
-- Also cleanup any historical duplicates before adding unique index.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY branch_id, billing_period_start, billing_period_end
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM warehouse_invoices
),
dupes AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM warehouse_invoice_items
WHERE invoice_id IN (SELECT id FROM dupes);

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY branch_id, billing_period_start, billing_period_end
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM warehouse_invoices
)
DELETE FROM warehouse_invoices
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouse_invoices_branch_week_unique
  ON warehouse_invoices (branch_id, billing_period_start, billing_period_end);
