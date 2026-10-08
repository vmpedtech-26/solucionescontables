-- Conexion con ARCA: certificados por estudio, claves privadas en Vault y tickets WSAA.
-- La clave privada nunca es legible desde el navegador: solo la Edge Function
-- "arca" (service_role) la lee a traves de funciones con EXECUTE restringido.
-- Idempotente.

CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;

CREATE TABLE IF NOT EXISTS public.arca_credenciales (
    estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
    ambiente TEXT NOT NULL CHECK (ambiente IN ('homologacion', 'produccion')),
    cuit TEXT NOT NULL CHECK (cuit ~ '^[0-9]{11}$'),
    alias TEXT NOT NULL CHECK (char_length(alias) <= 60),
    csr TEXT CHECK (char_length(coalesce(csr, '')) <= 4000),
    certificado TEXT CHECK (char_length(coalesce(certificado, '')) <= 8000),
    cert_desde TIMESTAMP WITH TIME ZONE,
    cert_hasta TIMESTAMP WITH TIME ZONE,
    cert_emisor TEXT,
    clave_secret_id UUID,
    actualizado TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (estudio_id, ambiente)
);
ALTER TABLE public.arca_credenciales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Estudio ve sus credenciales ARCA" ON public.arca_credenciales;
CREATE POLICY "Estudio ve sus credenciales ARCA" ON public.arca_credenciales
    FOR SELECT TO authenticated USING (estudio_id = auth.uid());
-- Sin politicas de escritura: solo escribe la Edge Function con service_role.

-- Tickets de acceso (token/sign) de WSAA: validos 12 hs. Solo service_role.
CREATE TABLE IF NOT EXISTS public.arca_tickets (
    estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
    ambiente TEXT NOT NULL,
    servicio TEXT NOT NULL,
    token TEXT NOT NULL,
    sign TEXT NOT NULL,
    expira TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (estudio_id, ambiente, servicio)
);
ALTER TABLE public.arca_tickets ENABLE ROW LEVEL SECURITY;

-- CAE de las facturas emitidas desde el sistema
ALTER TABLE public.transacciones ADD COLUMN IF NOT EXISTS cae TEXT;
ALTER TABLE public.transacciones ADD COLUMN IF NOT EXISTS cae_vto DATE;

-- Vault: guardar / leer / borrar la clave privada
CREATE OR REPLACE FUNCTION public.arca_guardar_clave(p_estudio UUID, p_ambiente TEXT, p_pem TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_old UUID; v_id UUID;
BEGIN
    SELECT clave_secret_id INTO v_old FROM public.arca_credenciales
     WHERE estudio_id = p_estudio AND ambiente = p_ambiente;
    IF v_old IS NOT NULL THEN DELETE FROM vault.secrets WHERE id = v_old; END IF;
    v_id := vault.create_secret(p_pem, 'arca_' || p_estudio::text || '_' || p_ambiente || '_' || floor(extract(epoch FROM clock_timestamp()) * 1000)::text,
                                'Clave privada ARCA');
    RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.arca_leer_clave(p_secret UUID)
RETURNS TEXT LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = p_secret;
$$;

-- Al borrar credenciales (o el estudio, por cascada) se borra la clave del Vault
CREATE OR REPLACE FUNCTION public.arca_borrar_clave_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF OLD.clave_secret_id IS NOT NULL THEN DELETE FROM vault.secrets WHERE id = OLD.clave_secret_id; END IF;
    RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS on_arca_credenciales_delete ON public.arca_credenciales;
CREATE TRIGGER on_arca_credenciales_delete AFTER DELETE ON public.arca_credenciales
    FOR EACH ROW EXECUTE FUNCTION public.arca_borrar_clave_trigger();

REVOKE EXECUTE ON FUNCTION public.arca_guardar_clave(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.arca_leer_clave(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.arca_borrar_clave_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.arca_guardar_clave(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.arca_leer_clave(UUID) TO service_role;

-- Datos del emisor para imprimir comprobantes
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS domicilio TEXT;
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS iibb TEXT;
ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_domicilio_iibb_chk;
ALTER TABLE public.empresas ADD CONSTRAINT empresas_domicilio_iibb_chk
    CHECK (char_length(coalesce(domicilio, '')) <= 200 AND char_length(coalesce(iibb, '')) <= 30);
