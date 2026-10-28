-- Las funciones lanzan CODIGOS ASCII estables en lugar de mensajes para el usuario.
-- Motivo: el gateway de InsForge responde 500 generico si el mensaje de error trae caracteres
-- no ASCII (p. ej. acentos), y ademas la base de datos no debe redactar textos de la interfaz.
-- El adaptador traduce cada codigo a un error del dominio (domain/errors.mjs → integrityErrors).
--   message = codigo (out_of_stock, price_changed, ...)   detail = identificador ASCII afectado

CREATE OR REPLACE FUNCTION public.audit_log_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_append_only' USING ERRCODE = 'P0403';
END;
$$;

CREATE OR REPLACE FUNCTION public.adjust_stock(p_product_id text, p_delta integer)
RETURNS TABLE (stock_before integer, stock_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_before integer;
BEGIN
  SELECT p.stock INTO v_before FROM public.products p WHERE p.id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  IF v_before + p_delta < 0 THEN
    RAISE EXCEPTION 'negative_stock' USING ERRCODE = 'P0409', DETAIL = p_product_id;
  END IF;
  UPDATE public.products SET stock = stock + p_delta, updated_at = now() WHERE id = p_product_id;
  RETURN QUERY SELECT v_before, v_before + p_delta;
END;
$$;

CREATE OR REPLACE FUNCTION public.place_order(p_order jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_line    jsonb;
  v_product public.products;
  v_qty     integer;
BEGIN
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_order -> 'items') ORDER BY value ->> 'productId' LOOP
    v_qty := (v_line ->> 'qty')::integer;
    SELECT * INTO v_product FROM public.products WHERE id = v_line ->> 'productId' FOR UPDATE;
    IF NOT FOUND OR NOT v_product.active THEN
      RAISE EXCEPTION 'product_unavailable' USING ERRCODE = 'P0409', DETAIL = v_line ->> 'productId';
    END IF;
    IF v_product.price <> (v_line ->> 'unitPrice')::integer THEN
      RAISE EXCEPTION 'price_changed' USING ERRCODE = 'P0409', DETAIL = v_product.id;
    END IF;
    IF v_product.stock < v_qty THEN
      RAISE EXCEPTION 'out_of_stock' USING ERRCODE = 'P0409', DETAIL = v_product.id;
    END IF;
    UPDATE public.products SET stock = stock - v_qty, updated_at = now() WHERE id = v_product.id;
  END LOOP;

  INSERT INTO public.orders (id, user_id, subtotal, discount, shipping, total, coupon_code,
    address_name, address_line1, address_city, address_phone, status, created_at, expires_at)
  VALUES (
    p_order ->> 'id', (p_order ->> 'userId')::uuid,
    (p_order ->> 'subtotal')::integer, (p_order ->> 'discount')::integer, (p_order ->> 'shipping')::integer, (p_order ->> 'total')::integer,
    p_order ->> 'coupon',
    p_order #>> '{address,name}', p_order #>> '{address,line1}', p_order #>> '{address,city}', p_order #>> '{address,phone}',
    p_order ->> 'status', (p_order ->> 'createdAt')::timestamptz, (p_order ->> 'expiresAt')::timestamptz
  );

  INSERT INTO public.order_items (order_id, line_no, product_id, name, unit_price, qty, line_total)
  SELECT p_order ->> 'id', t.n, t.value ->> 'productId', t.value ->> 'name',
         (t.value ->> 'unitPrice')::integer, (t.value ->> 'qty')::integer, (t.value ->> 'lineTotal')::integer
  FROM jsonb_array_elements(p_order -> 'items') WITH ORDINALITY AS t (value, n);

  INSERT INTO public.order_history (order_id, seq, status, at, by)
  SELECT p_order ->> 'id', t.n, t.value ->> 'status', (t.value ->> 'at')::timestamptz, t.value ->> 'by'
  FROM jsonb_array_elements(p_order -> 'history') WITH ORDINALITY AS t (value, n);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'order_exists' USING ERRCODE = 'P0409', DETAIL = p_order ->> 'id';
END;
$$;

CREATE OR REPLACE FUNCTION public.set_order_status(p_id text, p_from text[], p_to text, p_by text, p_patch jsonb DEFAULT '{}'::jsonb, p_release_stock boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_previous text;
BEGIN
  SELECT status INTO v_previous FROM public.orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0404', DETAIL = p_id;
  END IF;
  IF NOT (v_previous = ANY (p_from)) THEN
    RAISE EXCEPTION 'transition_not_allowed' USING ERRCODE = 'P0409', DETAIL = v_previous || '>' || p_to;
  END IF;

  UPDATE public.orders SET
    status           = p_to,
    payment_ref      = CASE WHEN p_patch ? 'payment' THEN p_patch #>> '{payment,ref}' ELSE payment_ref END,
    payment_last4    = CASE WHEN p_patch ? 'payment' THEN p_patch #>> '{payment,last4}' ELSE payment_last4 END,
    payment_brand    = CASE WHEN p_patch ? 'payment' THEN p_patch #>> '{payment,brand}' ELSE payment_brand END,
    payment_event_id = CASE WHEN p_patch ? 'payment' THEN p_patch #>> '{payment,eventId}' ELSE payment_event_id END,
    expires_at       = CASE WHEN p_patch ? 'expiresAt' THEN (p_patch ->> 'expiresAt')::timestamptz ELSE expires_at END
  WHERE id = p_id;

  INSERT INTO public.order_history (order_id, seq, status, at, by)
  SELECT p_id, COALESCE(MAX(seq), 0) + 1, p_to, now(), p_by FROM public.order_history WHERE order_id = p_id;

  IF p_release_stock THEN
    UPDATE public.products p SET stock = p.stock + i.qty, updated_at = now()
    FROM public.order_items i
    WHERE i.order_id = p_id AND p.id = i.product_id;
  END IF;
  RETURN v_previous;
END;
$$;

-- CREATE OR REPLACE conserva los privilegios; se reafirma la revocacion por claridad
REVOKE EXECUTE ON FUNCTION public.adjust_stock(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.place_order(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_order_status(text, text[], text, text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_log_append_only() FROM PUBLIC, anon, authenticated;
