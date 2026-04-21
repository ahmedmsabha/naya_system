-- ============================================================
-- Naya System — Menu + sample revenue (run after warehouse seed)
-- ============================================================
-- Prerequisites:
--   - At least one row in `branches`
--   - At least one row in `ingredients` (from `seed_warehouse_items.sql` or Warehouse UI)
--
-- Run in Supabase SQL Editor. Safe to re-run: skips recipes that already exist and
-- skips sample sales for the current month if any "Naya Seed — …" sale already exists.
-- ============================================================

DO $$
DECLARE
  branch_uuid UUID;
  ing1 UUID;
  ing2 UUID;
  ing3 UUID;
  ing4 UUID;
  r1 UUID;
  r2 UUID;
  r3 UUID;
  month_start DATE := date_trunc('month', CURRENT_DATE)::date;
  month_end DATE := (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date;
  seed_sales_exist BOOLEAN;
BEGIN
  SELECT id INTO branch_uuid FROM public.branches ORDER BY name LIMIT 1;
  IF branch_uuid IS NULL THEN
    RAISE EXCEPTION 'No branches found. Create a branch first.';
  END IF;

  SELECT id INTO ing1 FROM public.ingredients ORDER BY name LIMIT 1 OFFSET 0;
  SELECT id INTO ing2 FROM public.ingredients ORDER BY name LIMIT 1 OFFSET 1;
  SELECT id INTO ing3 FROM public.ingredients ORDER BY name LIMIT 1 OFFSET 2;
  SELECT id INTO ing4 FROM public.ingredients ORDER BY name LIMIT 1 OFFSET 3;

  IF ing1 IS NULL THEN
    RAISE EXCEPTION 'No ingredients found. Run seed_warehouse_items.sql or add items in Warehouse.';
  END IF;

  IF ing2 IS NULL THEN ing2 := ing1; END IF;
  IF ing3 IS NULL THEN ing3 := ing1; END IF;
  IF ing4 IS NULL THEN ing4 := ing1; END IF;

  -- Recipe 1
  IF NOT EXISTS (SELECT 1 FROM public.recipes WHERE name = 'Naya Seed — Market Bowl') THEN
    INSERT INTO public.recipes (name, selling_price, is_active)
    VALUES ('Naya Seed — Market Bowl', 17.00, true)
    RETURNING id INTO r1;
    INSERT INTO public.recipe_items (recipe_id, ingredient_id, quantity_grams) VALUES
      (r1, ing1, 140.0),
      (r1, ing2, 95.0),
      (r1, ing3, 55.0);
  ELSE
    SELECT id INTO r1 FROM public.recipes WHERE name = 'Naya Seed — Market Bowl' LIMIT 1;
  END IF;

  -- Recipe 2
  IF NOT EXISTS (SELECT 1 FROM public.recipes WHERE name = 'Naya Seed — Grill Plate') THEN
    INSERT INTO public.recipes (name, selling_price, is_active)
    VALUES ('Naya Seed — Grill Plate', 19.50, true)
    RETURNING id INTO r2;
    INSERT INTO public.recipe_items (recipe_id, ingredient_id, quantity_grams) VALUES
      (r2, ing2, 160.0),
      (r2, ing3, 70.0),
      (r2, ing4, 40.0);
  ELSE
    SELECT id INTO r2 FROM public.recipes WHERE name = 'Naya Seed — Grill Plate' LIMIT 1;
  END IF;

  -- Recipe 3
  IF NOT EXISTS (SELECT 1 FROM public.recipes WHERE name = 'Naya Seed — Side & Dip') THEN
    INSERT INTO public.recipes (name, selling_price, is_active)
    VALUES ('Naya Seed — Side & Dip', 8.50, true)
    RETURNING id INTO r3;
    INSERT INTO public.recipe_items (recipe_id, ingredient_id, quantity_grams) VALUES
      (r3, ing1, 80.0),
      (r3, ing4, 60.0);
  ELSE
    SELECT id INTO r3 FROM public.recipes WHERE name = 'Naya Seed — Side & Dip' LIMIT 1;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.sales s
    JOIN public.recipes rr ON rr.id = s.recipe_id
    WHERE s.branch_id = branch_uuid
      AND s.sale_date >= month_start
      AND s.sale_date <= month_end
      AND rr.name LIKE 'Naya Seed — %'
  ) INTO seed_sales_exist;

  IF seed_sales_exist THEN
    RAISE NOTICE 'Menu seed recipes are present; sample sales for this month already exist. Skipping sales.';
    RETURN;
  END IF;

  INSERT INTO public.sales (branch_id, recipe_id, quantity_sold, unit_price, sale_date, source) VALUES
    (branch_uuid, r1, 2, 16.50, month_start + 2, 'delivery'),
    (branch_uuid, r2, 1, 19.50, month_start + 4, 'dine_in'),
    (branch_uuid, r3, 3, 8.50, month_start + 6, 'delivery'),
    (branch_uuid, r1, 4, 17.00, month_start + 9, 'dine_in'),
    (branch_uuid, r2, 2, 19.00, month_start + 11, 'delivery'),
    (branch_uuid, r3, 2, 8.50, month_start + 14, 'dine_in'),
    (branch_uuid, r1, 1, 17.00, month_start + 17, 'delivery'),
    (branch_uuid, r2, 3, 19.50, month_start + 20, 'dine_in'),
    (branch_uuid, r3, 4, 8.00, month_start + 22, 'delivery'),
    (branch_uuid, r1, 2, 16.75, LEAST(month_start + 25, month_end), 'dine_in');

  RAISE NOTICE 'Seeded menu (3 recipes) and 10 sample sales for branch % between % and %.', branch_uuid, month_start, month_end;
END $$;
