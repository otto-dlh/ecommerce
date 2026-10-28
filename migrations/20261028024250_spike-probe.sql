-- F0 · Prueba técnica (temporal): valida los supuestos de la arquitectura antes de construir el esquema.
--   1. La API key (project_admin) lee/escribe tablas cerradas y llama RPC.
--   2. La clave anon NO puede leer, escribir ni llamar RPC.
--   3. realtime.publish llega a un socket anónimo.
--   4. La RLS de realtime.channels niega canales privados inválidos y nadie publica desde el cliente.
-- Una migración posterior elimina estos objetos `spike_*`.

CREATE TABLE public.spike_probe (
  id   integer PRIMARY KEY,
  note text NOT NULL
);
ALTER TABLE public.spike_probe ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.spike_probe FROM anon, authenticated;
INSERT INTO public.spike_probe (id, note) VALUES (1, 'solo visible para el servidor');

-- Canales privados válidos (en el esquema final serán los rt_channel de las sesiones activas)
CREATE TABLE public.spike_channels (
  channel_id text PRIMARY KEY
);
ALTER TABLE public.spike_channels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.spike_channels FROM anon, authenticated;
INSERT INTO public.spike_channels (channel_id) VALUES ('canal-valido-0001');

CREATE FUNCTION public.spike_echo(p_text text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$ SELECT 'eco:' || p_text $$;
REVOKE EXECUTE ON FUNCTION public.spike_echo(text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.spike_publish(p_channel text, p_event text, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  PERFORM realtime.publish(p_channel, p_event, p_payload);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.spike_publish(text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- Helper de la política: anon necesita EXECUTE porque la política se evalúa con su rol
CREATE FUNCTION public.spike_channel_allowed(p_channel text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT p_channel = 'spike-public'
      OR EXISTS (SELECT 1 FROM public.spike_channels c WHERE 'spike:' || c.channel_id = p_channel);
$$;
REVOKE EXECUTE ON FUNCTION public.spike_channel_allowed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spike_channel_allowed(text) TO anon, authenticated;

INSERT INTO realtime.channels (pattern, description, enabled)
VALUES ('spike-public', 'F0: canal público de prueba', true),
       ('spike:%', 'F0: canales privados de prueba', true)
ON CONFLICT (pattern) DO UPDATE SET description = EXCLUDED.description, enabled = EXCLUDED.enabled;

ALTER TABLE realtime.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY spike_subscribe ON realtime.channels
  FOR SELECT TO anon, authenticated
  USING (public.spike_channel_allowed(realtime.channel_name()));

-- Sin política de INSERT: ningún cliente puede publicar mensajes
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
