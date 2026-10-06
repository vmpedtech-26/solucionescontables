-- Endurecimiento de seguridad (auditoria 2026-10-06). Idempotente: se puede
-- correr mas de una vez. Equivale a los cambios hechos en supabase_schema.sql.

-- 1) seguridad_logs: nadie inserta por la API (solo los triggers SECURITY DEFINER)
DROP POLICY IF EXISTS "Triggers can insert security logs" ON public.seguridad_logs;

-- 2) leads: sin lectura publica, con columna cuit y limites de tamano
DROP POLICY IF EXISTS "Anyone can view leads" ON public.leads;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cuit TEXT;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_limites;
ALTER TABLE public.leads ADD CONSTRAINT leads_limites CHECK (char_length(name) <= 120 AND char_length(studio) <= 160 AND char_length(email) <= 254 AND char_length(coalesce(cuit, '')) <= 20);

-- 3) formato de CUIT y limites de tamano (defensa en profundidad)
ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_cuit_formato;
ALTER TABLE public.empresas ADD CONSTRAINT empresas_cuit_formato CHECK (cuit ~ '^[0-9-]{11,13}$');
ALTER TABLE public.transacciones DROP CONSTRAINT IF EXISTS transacciones_cuit_formato;
ALTER TABLE public.transacciones ADD CONSTRAINT transacciones_cuit_formato CHECK (cuit ~ '^[0-9-]{0,13}$');
ALTER TABLE public.retenciones DROP CONSTRAINT IF EXISTS retenciones_cuit_formato;
ALTER TABLE public.retenciones ADD CONSTRAINT retenciones_cuit_formato CHECK (cuit ~ '^[0-9-]{0,13}$');
ALTER TABLE public.comprobantes_digitales DROP CONSTRAINT IF EXISTS comprobantes_limites;
ALTER TABLE public.comprobantes_digitales ADD CONSTRAINT comprobantes_limites CHECK (char_length(detalle) <= 300 AND char_length(archivo) <= 300 AND char_length(categoria) <= 60 AND char_length(tipo) <= 30 AND char_length(estado) <= 30);

-- 4) search_path fijo en funciones SECURITY DEFINER
ALTER FUNCTION public.validar_cuit_afip(TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_cuit_validation() SET search_path = public, pg_temp;
ALTER FUNCTION public.trigger_prevent_cross_tenant_update() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_cliente_of_empresa(TEXT) SET search_path = public, pg_temp;

-- 5) permisos de ejecucion: fuera de la API REST publica
REVOKE EXECUTE ON FUNCTION public.validar_cuit_afip(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_cuit_validation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_prevent_cross_tenant_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_cliente_of_empresa(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_cliente_of_empresa(TEXT) TO authenticated;

-- 6) politicas del cliente final: solo authenticated y sin autoaprobacion
DROP POLICY IF EXISTS "Cliente final ve su propia empresa" ON public.empresas;
CREATE POLICY "Cliente final ve su propia empresa" ON public.empresas FOR SELECT TO authenticated
    USING (public.is_cliente_of_empresa(empresas.id));
DROP POLICY IF EXISTS "Cliente final ve sus propios comprobantes" ON public.comprobantes_digitales;
CREATE POLICY "Cliente final ve sus propios comprobantes" ON public.comprobantes_digitales FOR SELECT TO authenticated
    USING (public.is_cliente_of_empresa(comprobantes_digitales.empresa_id));
DROP POLICY IF EXISTS "Cliente final sube sus propios comprobantes" ON public.comprobantes_digitales;
CREATE POLICY "Cliente final sube sus propios comprobantes" ON public.comprobantes_digitales FOR INSERT TO authenticated
    WITH CHECK (public.is_cliente_of_empresa(comprobantes_digitales.empresa_id) AND estado = 'Recibido');
