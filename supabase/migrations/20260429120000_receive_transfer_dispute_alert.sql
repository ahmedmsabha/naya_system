-- On disputed receive, create an alert for the destination branch.

CREATE OR REPLACE FUNCTION public.receive_transfer (
  p_transfer_id uuid,
  p_to_branch_id uuid,
  p_lines jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  t_status text;
  t_to uuid;
  v_count int;
  v_disputed boolean;
  v_obj jsonb;
  v_ti_id uuid;
  v_qty numeric;
  r_item record;
  v_inv_id uuid;
  v_on_hand numeric;
  v_ing_id uuid;
  v_json_lines int;
  v_distinct_ids int;
  v_sent_total numeric;
  v_recv_total numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'invalid_lines';
  END IF;

  SELECT t.status, t.to_branch_id
  INTO t_status, t_to
  FROM public.transfers t
  WHERE t.id = p_transfer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'transfer_not_found';
  END IF;

  IF t_to IS DISTINCT FROM p_to_branch_id THEN
    RAISE EXCEPTION 'branch_mismatch';
  END IF;

  IF t_status = 'received' THEN
    RAISE EXCEPTION 'already_received';
  END IF;

  IF t_status IS DISTINCT FROM 'in_transit' THEN
    RAISE EXCEPTION 'not_in_transit';
  END IF;

  SELECT count(*)::int
  INTO v_count
  FROM public.transfer_items ti
  WHERE ti.transfer_id = p_transfer_id;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'no_line_items';
  END IF;

  v_json_lines := jsonb_array_length(p_lines);
  IF v_count IS DISTINCT FROM v_json_lines THEN
    RAISE EXCEPTION 'line_count_mismatch';
  END IF;

  SELECT
    coalesce((
        SELECT count(DISTINCT (j.el->>'transfer_item_id'))
        FROM (SELECT jsonb_array_elements(p_lines) AS el) j
      ), 0)::int
  INTO v_distinct_ids;

  IF v_distinct_ids IS DISTINCT FROM v_count THEN
    RAISE EXCEPTION 'duplicate_line_item';
  END IF;

  FOR v_obj IN
    SELECT jsonb_array_elements(p_lines)
  LOOP
    v_ti_id := (v_obj->>'transfer_item_id')::uuid;
    v_qty := (v_obj->>'quantity_received')::numeric;
    IF v_ti_id IS NULL OR v_qty IS NULL OR v_qty < 0 THEN
      RAISE EXCEPTION 'invalid_line';
    END IF;
    IF NOT exists (
        SELECT 1
        FROM public.transfer_items s
        WHERE s.id = v_ti_id
          AND s.transfer_id = p_transfer_id
      )
    THEN
      RAISE EXCEPTION 'unknown_line_item';
    END IF;
  END LOOP;

  FOR v_obj IN
    SELECT jsonb_array_elements(p_lines)
  LOOP
    v_ti_id := (v_obj->>'transfer_item_id')::uuid;
    v_qty := (v_obj->>'quantity_received')::numeric;
    UPDATE public.transfer_items
    SET quantity_received = v_qty
    WHERE id = v_ti_id
      AND transfer_id = p_transfer_id;
  END LOOP;

  SELECT exists (
      SELECT 1
      FROM public.transfer_items x
      WHERE x.transfer_id = p_transfer_id
        AND (x.quantity_received IS DISTINCT FROM x.quantity_sent)
    )
  INTO v_disputed;

  UPDATE public.transfers
  SET
    status = CASE WHEN v_disputed THEN 'disputed' ELSE 'received' END,
    received_at = now(),
    received_by = auth.uid()
  WHERE id = p_transfer_id;

  IF v_disputed THEN
    SELECT
      coalesce(sum(quantity_sent), 0),
      coalesce(sum(quantity_received), 0)
    INTO v_sent_total, v_recv_total
    FROM public.transfer_items
    WHERE transfer_id = p_transfer_id;

    INSERT INTO public.alerts (branch_id, type, severity, title, message, is_read, triggered_at)
    VALUES (
      p_to_branch_id,
      'transfer_dispute',
      'warning',
      'Transfer discrepancy',
      'Discrepancy detected in Transfer #' || p_transfer_id::text
        || '. Sent: ' || v_sent_total::text || ', Received: ' || v_recv_total::text,
      false,
      now()
    );
  END IF;

  FOR r_item IN
    SELECT id, ingredient_id, quantity_received
    FROM public.transfer_items
    WHERE transfer_id = p_transfer_id
  LOOP
    v_ing_id := r_item.ingredient_id;
    v_qty := r_item.quantity_received;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;
    SELECT i.id, i.quantity_on_hand
    INTO v_inv_id, v_on_hand
    FROM public.inventory i
    WHERE i.branch_id = p_to_branch_id
      AND i.ingredient_id = v_ing_id
    ORDER BY i.id
    FOR UPDATE
    LIMIT 1;

    IF v_inv_id IS NULL THEN
      INSERT INTO public.inventory (
        branch_id,
        ingredient_id,
        quantity_on_hand,
        counted_at,
        counted_by
      ) VALUES (
        p_to_branch_id,
        v_ing_id,
        v_qty,
        CURRENT_DATE,
        auth.uid()
      );
    ELSE
      UPDATE public.inventory
      SET
        quantity_on_hand = v_on_hand + v_qty,
        counted_at = CURRENT_DATE,
        counted_by = auth.uid()
      WHERE id = v_inv_id;
    END IF;
  END LOOP;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.receive_transfer (uuid, uuid, jsonb) TO authenticated;
