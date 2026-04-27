-- Ensure every commissary branch has an inventory row per ingredient (common gap when
-- commissary was created after seed_warehouse_items). Initial balance is a demo-friendly amount.
INSERT INTO public.inventory (branch_id, ingredient_id, quantity_on_hand, counted_at)
SELECT c.id, i.id, 1000::numeric, CURRENT_DATE
FROM public.branches c
CROSS JOIN public.ingredients i
WHERE c.type = 'commissary'
  AND NOT EXISTS (
    SELECT 1
    FROM public.inventory x
    WHERE x.branch_id = c.id
      AND x.ingredient_id = i.id
  );

-- Richer insufficient_stock messages (ingredient name + need vs on hand).
CREATE OR REPLACE FUNCTION public.dispatch_transfer (
  p_transfer_id uuid,
  p_commissary_branch_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_from uuid;
  v_status text;
  r record;
  v_sum numeric;
  v_remaining numeric;
  v_inv record;
  v_take numeric;
  v_ing_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT t.from_branch_id, t.status
  INTO v_from, v_status
  FROM public.transfers t
  WHERE t.id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transfer_not_found';
  END IF;

  IF v_from IS DISTINCT FROM p_commissary_branch_id THEN
    RAISE EXCEPTION 'branch_mismatch';
  END IF;

  IF v_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'transfer_not_pending';
  END IF;

  FOR r IN
    SELECT ti.ingredient_id, ti.quantity_sent
    FROM public.transfer_items ti
    WHERE ti.transfer_id = p_transfer_id
  LOOP
    SELECT coalesce(sum(i.quantity_on_hand), 0)
    INTO v_sum
    FROM public.inventory i
    WHERE i.branch_id = v_from
      AND i.ingredient_id = r.ingredient_id;

    SELECT ing.name INTO v_ing_name FROM public.ingredients ing WHERE ing.id = r.ingredient_id;

    IF v_sum < r.quantity_sent THEN
      RAISE EXCEPTION 'insufficient_stock: need % of % (on hand: %).', r.quantity_sent, coalesce(v_ing_name, r.ingredient_id::text), v_sum;
    END IF;
  END LOOP;

  FOR r IN
    SELECT ti.ingredient_id, ti.quantity_sent
    FROM public.transfer_items ti
    WHERE ti.transfer_id = p_transfer_id
  LOOP
    v_remaining := r.quantity_sent;
    SELECT ing.name INTO v_ing_name FROM public.ingredients ing WHERE ing.id = r.ingredient_id;

    FOR v_inv IN
      SELECT i.id, i.quantity_on_hand
      FROM public.inventory i
      WHERE i.branch_id = v_from
        AND i.ingredient_id = r.ingredient_id
      ORDER BY i.id
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      IF v_inv.quantity_on_hand <= 0 THEN
        CONTINUE;
      END IF;
      v_take := least(v_remaining, v_inv.quantity_on_hand);
      UPDATE public.inventory
      SET
        quantity_on_hand = quantity_on_hand - v_take,
        counted_at = CURRENT_DATE
      WHERE id = v_inv.id;
      v_remaining := v_remaining - v_take;
    END LOOP;
    IF v_remaining > 0 THEN
      RAISE EXCEPTION 'insufficient_stock: need % of % (remaining to deduct: %).', r.quantity_sent, coalesce(v_ing_name, r.ingredient_id::text), v_remaining;
    END IF;
  END LOOP;

  UPDATE public.transfers
  SET
    status = 'in_transit',
    dispatched_at = now(),
    dispatched_by = auth.uid(),
    qr_code = p_transfer_id::text
  WHERE id = p_transfer_id;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.dispatch_transfer (uuid, uuid) TO authenticated;
