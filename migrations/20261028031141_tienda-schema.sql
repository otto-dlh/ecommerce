-- Esquema de Tienda Segura para el adaptador InsForge (PostgreSQL 15).
--
-- Modelo de acceso: SOLO la API del servidor (API key = project_admin, BYPASSRLS) lee y escribe.
-- Toda tabla tiene RLS activado SIN politicas y se revocan los permisos de anon/authenticated:
-- la clave anon es publica (la usa el navegador para el realtime) y no debe servir para datos.
-- Las reglas de negocio viven en la aplicacion; aqui solo hay integridad y atomicidad.

-- ---------------------------------------------------------------------------
-- 0. Limpieza de la prueba tecnica F0
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS spike_subscribe ON realtime.channels;
DELETE FROM realtime.channels WHERE pattern IN ('spike-public', 'spike:%');
DROP FUNCTION IF EXISTS public.spike_channel_allowed(text);
DROP FUNCTION IF EXISTS public.spike_publish(text, text, jsonb);
DROP FUNCTION IF EXISTS public.spike_echo(text);
DROP TABLE IF EXISTS public.spike_channels;
DROP TABLE IF EXISTS public.spike_probe;

-- ---------------------------------------------------------------------------
-- 1. Cerrado por defecto: objetos futuros creados por project_admin nacen sin acceso publico
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 2. Identidad y acceso
-- ---------------------------------------------------------------------------
CREATE TABLE public.app_users (
  id                   uuid PRIMARY KEY,
  email                text NOT NULL CHECK (email = lower(email) AND char_length(email) BETWEEN 5 AND 254),
  name                 text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  role                 text NOT NULL CHECK (role IN ('admin', 'operador', 'auditor', 'cliente')),
  active               boolean NOT NULL DEFAULT true,
  password_hash        text NOT NULL CHECK (password_hash LIKE 'scrypt$%'),
  mfa_enabled          boolean NOT NULL DEFAULT false,
  mfa_secret           text,          -- cifrado AES-256-GCM por la aplicacion
  mfa_pending_secret   text,          -- cifrado AES-256-GCM por la aplicacion
  mfa_last_counter     bigint,
  must_change_password boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  last_login_at        timestamptz
);
CREATE UNIQUE INDEX app_users_email_key ON public.app_users (email);
CREATE INDEX app_users_role_active_idx ON public.app_users (role) WHERE active;

CREATE TABLE public.sessions (
  key_hash   text PRIMARY KEY CHECK (key_hash ~ '^[0-9a-f]{64}$'),   -- SHA-256 del token; el token nunca se guarda
  user_id    uuid NOT NULL REFERENCES public.app_users (id) ON DELETE CASCADE,
  role       text NOT NULL,
  csrf       text NOT NULL,
  rt_channel text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL,
  last_seen  timestamptz NOT NULL,
  ip_masked  text,
  user_agent text NOT NULL DEFAULT ''
);
CREATE INDEX sessions_user_idx ON public.sessions (user_id);
CREATE INDEX sessions_role_idx ON public.sessions (role);

CREATE TABLE public.mfa_challenges (
  token_hash text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES public.app_users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  attempts   integer NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);

CREATE TABLE public.rate_limits (
  bucket   text NOT NULL,
  key      text NOT NULL,       -- hash de la identidad (IP, correo...)
  count    integer NOT NULL CHECK (count >= 0),
  reset_at timestamptz NOT NULL,
  label    text,                -- dato enmascarado solo para el panel
  PRIMARY KEY (bucket, key)
);
CREATE INDEX rate_limits_reset_idx ON public.rate_limits (reset_at);

-- Fila unica; los CHECK repiten los rangos seguros del dominio (defensa en profundidad)
CREATE TABLE public.access_policy (
  id                   smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  session_idle_minutes integer NOT NULL DEFAULT 30 CHECK (session_idle_minutes BETWEEN 5 AND 120),
  session_max_hours    integer NOT NULL DEFAULT 8 CHECK (session_max_hours BETWEEN 1 AND 24),
  max_failed_logins    integer NOT NULL DEFAULT 5 CHECK (max_failed_logins BETWEEN 3 AND 10),
  lockout_minutes      integer NOT NULL DEFAULT 15 CHECK (lockout_minutes BETWEEN 5 AND 1440),
  require_staff_mfa    boolean NOT NULL DEFAULT false,
  updated_at           timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.access_policy (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Catalogo
-- ---------------------------------------------------------------------------
CREATE TABLE public.categories (
  id          text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(id) BETWEEN 2 AND 40),
  name        text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 40),
  description text NOT NULL DEFAULT '',
  active      boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 999)
);

CREATE TABLE public.products (
  id          text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(id) BETWEEN 2 AND 40),
  name        text NOT NULL,
  description text NOT NULL,
  price       integer NOT NULL CHECK (price > 0),                 -- centavos
  category_id text NOT NULL REFERENCES public.categories (id),
  emoji       text NOT NULL,
  color       text NOT NULL CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  image       text,
  image_key   text,
  stock       integer NOT NULL CHECK (stock >= 0),                -- nunca negativo
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON public.products (category_id);

CREATE TABLE public.coupons (
  code          text PRIMARY KEY CHECK (code ~ '^[A-Z0-9_-]{3,30}$'),
  label         text NOT NULL,
  type          text NOT NULL CHECK (type IN ('percent', 'fixed', 'shipping')),
  value         integer NOT NULL DEFAULT 0 CHECK (value >= 0),
  min_subtotal  integer NOT NULL DEFAULT 0 CHECK (min_subtotal >= 0),
  once_per_user boolean NOT NULL DEFAULT false,
  active        boolean NOT NULL DEFAULT true,
  max_uses      integer CHECK (max_uses IS NULL OR max_uses > 0),
  uses          integer NOT NULL DEFAULT 0 CHECK (uses >= 0),
  starts_at     timestamptz,
  ends_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at)
);

CREATE TABLE public.reviews (
  id           uuid PRIMARY KEY,
  product_id   text NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.app_users (id) ON DELETE CASCADE,
  user_name    text NOT NULL,
  rating       smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text         text NOT NULL CHECK (char_length(text) BETWEEN 3 AND 500),
  hidden       boolean NOT NULL DEFAULT false,
  moderated_by uuid REFERENCES public.app_users (id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_product_idx ON public.reviews (product_id, created_at DESC);
CREATE INDEX reviews_hidden_idx ON public.reviews (hidden, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4. Pedidos, direcciones y pagos
-- ---------------------------------------------------------------------------
CREATE TABLE public.orders (
  id               text PRIMARY KEY CHECK (id ~ '^[a-zA-Z0-9_-]{1,64}$'),
  user_id          uuid NOT NULL REFERENCES public.app_users (id),
  subtotal         integer NOT NULL CHECK (subtotal >= 0),
  discount         integer NOT NULL CHECK (discount >= 0),
  shipping         integer NOT NULL CHECK (shipping >= 0),
  total            integer NOT NULL CHECK (total >= 0),
  coupon_code      text,
  address_name     text NOT NULL,
  address_line1    text NOT NULL,
  address_city     text NOT NULL,
  address_phone    text NOT NULL,
  status           text NOT NULL CHECK (status IN ('pendiente_pago', 'pagado', 'preparando', 'enviado', 'entregado', 'cancelado')),
  payment_ref      text,
  payment_last4    text,
  payment_brand    text,
  payment_event_id text,
  created_at       timestamptz NOT NULL,
  expires_at       timestamptz
);
CREATE INDEX orders_user_idx ON public.orders (user_id, created_at DESC);
CREATE INDEX orders_status_idx ON public.orders (status, created_at DESC);
CREATE INDEX orders_pending_expiry_idx ON public.orders (expires_at) WHERE status = 'pendiente_pago';

CREATE TABLE public.order_items (
  order_id   text NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  line_no    smallint NOT NULL,
  product_id text NOT NULL REFERENCES public.products (id),
  name       text NOT NULL,
  unit_price integer NOT NULL CHECK (unit_price > 0),
  qty        integer NOT NULL CHECK (qty BETWEEN 1 AND 10),
  line_total integer NOT NULL,
  PRIMARY KEY (order_id, line_no),
  CHECK (line_total = unit_price * qty)
);
CREATE INDEX order_items_product_idx ON public.order_items (product_id);

CREATE TABLE public.order_history (
  order_id text NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  seq      integer NOT NULL,
  status   text NOT NULL,
  at       timestamptz NOT NULL,
  by       text NOT NULL,
  PRIMARY KEY (order_id, seq)
);

-- Un canje por pedido; "uso unico por cliente" lo valida el dominio al cotizar
CREATE TABLE public.coupon_redemptions (
  code        text NOT NULL REFERENCES public.coupons (code),
  order_id    text NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.app_users (id) ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (code, order_id)
);
CREATE INDEX coupon_redemptions_user_idx ON public.coupon_redemptions (user_id, code);

CREATE TABLE public.addresses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.app_users (id) ON DELETE CASCADE,
  name       text NOT NULL,
  line1      text NOT NULL,
  city       text NOT NULL,
  phone      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX addresses_user_idx ON public.addresses (user_id);

-- Idempotencia de avisos de la pasarela (T09)
CREATE TABLE public.payment_events (
  event_id    text PRIMARY KEY,
  type        text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 5. Bitacora de auditoria: solo insercion (T03)
-- ---------------------------------------------------------------------------
CREATE TABLE public.audit_log (
  id      uuid PRIMARY KEY,
  at      timestamptz NOT NULL,
  action  text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('ok', 'failure', 'denied', 'rejected')),
  actor   jsonb,
  ip      text,
  target  text,
  details jsonb,
  mac     text NOT NULL CHECK (mac ~ '^[0-9a-f]{64}$')   -- HMAC-SHA256 calculado por la aplicacion
);
CREATE INDEX audit_log_at_idx ON public.audit_log (at DESC);

CREATE FUNCTION public.audit_log_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora de auditoría es de solo inserción' USING ERRCODE = 'P0403';
END;
$$;
CREATE TRIGGER audit_log_no_update_delete BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_append_only();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON public.audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION public.audit_log_append_only();

-- ---------------------------------------------------------------------------
-- 6. Cierre de acceso directo: RLS sin politicas + revocacion explicita
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'app_users', 'sessions', 'mfa_challenges', 'rate_limits', 'access_policy', 'categories', 'products',
    'coupons', 'reviews', 'orders', 'order_items', 'order_history', 'coupon_redemptions', 'addresses',
    'payment_events', 'audit_log'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Operaciones atomicas (solo para la API). Errores de dominio:
--    P0404 = no encontrado · P0409 = conflicto · P0403 = prohibido
-- ---------------------------------------------------------------------------

-- Ventana fija de limitacion: cuenta y decide en una sola sentencia (sin carreras)
CREATE FUNCTION public.rate_hit(p_bucket text, p_key text, p_limit integer, p_window_sec integer, p_label text DEFAULT NULL)
RETURNS TABLE (allowed boolean, hits integer, retry_after_sec integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  INSERT INTO public.rate_limits AS rl (bucket, key, count, reset_at, label)
  VALUES (p_bucket, p_key, 1, now() + make_interval(secs => p_window_sec), p_label)
  ON CONFLICT (bucket, key) DO UPDATE SET
    count    = CASE WHEN rl.reset_at <= now() THEN 1 ELSE rl.count + 1 END,
    reset_at = CASE WHEN rl.reset_at <= now() THEN EXCLUDED.reset_at ELSE rl.reset_at END,
    label    = COALESCE(EXCLUDED.label, rl.label)
  RETURNING
    rl.count <= p_limit,
    rl.count,
    CASE WHEN rl.count <= p_limit THEN 0 ELSE GREATEST(1, CEIL(EXTRACT(EPOCH FROM rl.reset_at - now())))::integer END;
$$;

-- Intento de MFA: devuelve el estado previo y suma uno
CREATE FUNCTION public.mfa_consume_attempt(p_token_hash text)
RETURNS TABLE (user_id uuid, expires_at timestamptz, attempts integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  UPDATE public.mfa_challenges c SET attempts = c.attempts + 1
  WHERE c.token_hash = p_token_hash
  RETURNING c.user_id, c.expires_at, c.attempts - 1;
$$;

-- Anti-replay TOTP: el contador solo avanza
CREATE FUNCTION public.advance_mfa_counter(p_user_id uuid, p_counter bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  UPDATE public.app_users SET mfa_last_counter = p_counter
  WHERE id = p_user_id AND p_counter > COALESCE(mfa_last_counter, -1);
  RETURN FOUND;
END;
$$;

-- Ajuste de inventario que nunca deja stock negativo
CREATE FUNCTION public.adjust_stock(p_product_id text, p_delta integer)
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
    RAISE EXCEPTION 'El inventario no puede quedar negativo' USING ERRCODE = 'P0409';
  END IF;
  UPDATE public.products SET stock = stock + p_delta, updated_at = now() WHERE id = p_product_id;
  RETURN QUERY SELECT v_before, v_before + p_delta;
END;
$$;

-- Pedido todo-o-nada (T14): bloquea los productos en orden estable, verifica que sigan activos,
-- con el mismo precio y con stock suficiente; si algo falla se revierte toda la transaccion.
CREATE FUNCTION public.place_order(p_order jsonb)
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
      RAISE EXCEPTION 'Producto no disponible: %', v_line ->> 'name' USING ERRCODE = 'P0409';
    END IF;
    IF v_product.price <> (v_line ->> 'unitPrice')::integer THEN
      RAISE EXCEPTION 'El precio de un producto cambió; revisa tu carrito' USING ERRCODE = 'P0409';
    END IF;
    IF v_product.stock < v_qty THEN
      RAISE EXCEPTION 'Sin existencias suficientes de "%"', v_line ->> 'name' USING ERRCODE = 'P0409';
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
    RAISE EXCEPTION 'El pedido ya existe' USING ERRCODE = 'P0409';
END;
$$;

-- Cambio de estado condicional (compara y cambia); cancelar devuelve el stock
CREATE FUNCTION public.set_order_status(p_id text, p_from text[], p_to text, p_by text, p_patch jsonb DEFAULT '{}'::jsonb, p_release_stock boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_previous text;
BEGIN
  SELECT status INTO v_previous FROM public.orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado' USING ERRCODE = 'P0404';
  END IF;
  IF NOT (v_previous = ANY (p_from)) THEN
    RAISE EXCEPTION 'Transición no permitida: % → %', v_previous, p_to USING ERRCODE = 'P0409';
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

-- Canje idempotente por pedido; suma un uso solo la primera vez
CREATE FUNCTION public.redeem_coupon(p_code text, p_user_id uuid, p_order_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  INSERT INTO public.coupon_redemptions (code, order_id, user_id) VALUES (p_code, p_order_id, p_user_id)
  ON CONFLICT (code, order_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  UPDATE public.coupons SET uses = uses + 1 WHERE code = p_code;
  RETURN true;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Realtime: canal publico "catalog" y un canal privado por sesion "s:<rt_channel>"
-- ---------------------------------------------------------------------------

-- Publicacion desde la API (los eventos son senales; el detalle se pide a la API)
CREATE FUNCTION public.rt_publish_many(p_channels text[], p_event text, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE v_channel text;
BEGIN
  FOREACH v_channel IN ARRAY p_channels LOOP
    PERFORM realtime.publish(v_channel, p_event, p_payload);
  END LOOP;
END;
$$;

-- El canal privado solo es valido mientras su sesion este vigente segun la politica de acceso
CREATE FUNCTION public.rt_session_channel_active(p_channel text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sessions s
    JOIN public.app_users u ON u.id = s.user_id AND u.active AND u.role = s.role
    CROSS JOIN public.access_policy p
    WHERE 's:' || s.rt_channel = p_channel
      AND s.last_seen > now() - make_interval(mins => p.session_idle_minutes)
      AND s.created_at > now() - make_interval(hours => p.session_max_hours)
  );
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.rate_hit(text, text, integer, integer, text)',
    'public.mfa_consume_attempt(text)',
    'public.advance_mfa_counter(uuid, bigint)',
    'public.adjust_stock(text, integer)',
    'public.place_order(jsonb)',
    'public.set_order_status(text, text[], text, text, jsonb, boolean)',
    'public.redeem_coupon(text, uuid, text)',
    'public.rt_publish_many(text[], text, jsonb)',
    'public.audit_log_append_only()'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END;
$$;

-- La politica de suscripcion se evalua con el rol del socket (anon), que necesita ejecutar el helper
REVOKE EXECUTE ON FUNCTION public.rt_session_channel_active(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rt_session_channel_active(text) TO anon, authenticated;

INSERT INTO realtime.channels (pattern, description, enabled)
VALUES ('catalog', 'Cambios públicos del catálogo: precios, stock, categorías y reseñas', true),
       ('s:%', 'Canal privado por sesión: pedidos propios y avisos del panel según el rol', true)
ON CONFLICT (pattern) DO UPDATE SET description = EXCLUDED.description, enabled = EXCLUDED.enabled;

ALTER TABLE realtime.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY tienda_subscribe ON realtime.channels
  FOR SELECT TO anon, authenticated
  USING (
    (pattern = 'catalog' AND realtime.channel_name() = 'catalog')
    OR (pattern = 's:%' AND public.rt_session_channel_active(realtime.channel_name()))
  );

-- Sin politica de INSERT: ningun cliente puede publicar mensajes
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
