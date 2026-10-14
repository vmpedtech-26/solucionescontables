-- Accesos al portal: el estudio puede quitar el acceso de un cliente a sus
-- empresas, y decide por empresa si el cliente puede facturar desde el portal.
-- Idempotente.

ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS cliente_puede_facturar BOOLEAN DEFAULT false NOT NULL;

DROP POLICY IF EXISTS "Estudio quita acceso a clientes de sus empresas" ON public.clientes_finales;
CREATE POLICY "Estudio quita acceso a clientes de sus empresas" ON public.clientes_finales
    FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.empresas e
        WHERE e.id = clientes_finales.empresa_id AND e.estudio_id = auth.uid()
    ));

-- Comprobantes a consumidores identificados con DNI (7 u 8 digitos): son validos
-- en el Libro IVA y aparecen en Mis Comprobantes. Las empresas siguen exigiendo CUIT.
CREATE OR REPLACE FUNCTION public.trigger_cuit_validation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'transacciones'
       AND length(regexp_replace(coalesce(NEW.cuit, ''), '[^0-9]', '', 'g')) BETWEEN 7 AND 8 THEN
        RETURN NEW;
    END IF;
    IF NOT public.validar_cuit_afip(NEW.cuit) THEN
        INSERT INTO public.seguridad_logs (estudio_id, evento, tabla, registro_id, detalles)
        VALUES (
            COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
            'RECHAZO_CUIT_INVALIDO',
            TG_TABLE_NAME::TEXT,
            NEW.id::TEXT,
            jsonb_build_object('cuit_invalido', NEW.cuit, 'razon_social', COALESCE(to_jsonb(NEW)->>'razon_social', 'N/A'))
        );
        RAISE EXCEPTION 'Error impositivo AFIP: La CUIT % ingresada posee un dígito verificador inválido bajo Algoritmo Módulo 11.', NEW.cuit;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
