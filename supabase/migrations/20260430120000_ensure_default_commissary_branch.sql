-- Supply orders and fulfillment require at least one branch with type = 'commissary'.
-- If none exists (common in new environments), create a default row.

INSERT INTO public.branches (name, location, type, status)
SELECT
  'Commissary (Central Kitchen)',
  NULL,
  'commissary',
  'active'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.branches b
  WHERE b.type = 'commissary'
);
