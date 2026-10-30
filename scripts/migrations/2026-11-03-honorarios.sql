-- =====================================================================
-- 2026-11-03 · Honorarios del estudio: abonos y cuenta corriente
--
-- honorarios_abonos: abono mensual de cada cliente (uno por empresa).
-- honorarios_movimientos: cargos, cobros y bonificaciones. Los cargos
-- generados por abono llevan origen 'abono' y periodo AAAA-MM, unicos
-- por empresa y periodo (generar dos veces no duplica).
-- Datos sensibles: titular, administradores y contadores; los asistentes no.
-- Requiere 2026-11-01-equipo-estudio.sql. Idempotente.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.honorarios_abonos (
    empresa_id TEXT PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
    estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
    importe NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (importe >= 0),
    concepto TEXT CHECK (concepto IS NULL OR char_length(concepto) <= 200),
    dia_vencimiento SMALLINT NOT NULL DEFAULT 10 CHECK (dia_vencimiento BETWEEN 1 AND 31),
    activo BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.honorarios_movimientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
    empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('cargo', 'cobro', 'bonificacion')),
    fecha DATE NOT NULL,
    vence DATE,
    concepto TEXT NOT NULL CHECK (char_length(concepto) BETWEEN 1 AND 300),
    importe NUMERIC(15,2) NOT NULL CHECK (importe > 0),
    medio TEXT CHECK (medio IS NULL OR medio IN ('transferencia', 'efectivo', 'cheque', 'echeq', 'tarjeta', 'otro')),
    comprobante TEXT CHECK (comprobante IS NULL OR char_length(comprobante) <= 60),
    recibo INTEGER,
    origen TEXT CHECK (origen IS NULL OR origen = 'abono'),
    periodo TEXT CHECK (periodo IS NULL OR periodo ~ '^[0-9]{4}-[0-9]{2}$'),
    creado_por UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT honorarios_abono_unico UNIQUE (empresa_id, origen, periodo),
    CONSTRAINT honorarios_recibo_unico UNIQUE (estudio_id, recibo)
);
CREATE INDEX IF NOT EXISTS honorarios_mov_estudio_idx ON public.honorarios_movimientos (estudio_id, fecha);

ALTER TABLE public.honorarios_abonos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.honorarios_movimientos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.gestiona_honorarios(p_estudio UUID, p_empresa TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT public.es_del_estudio(p_estudio)
       AND public.mi_rol_estudio() IN ('titular', 'administrador', 'contador')
       AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = p_empresa AND e.estudio_id = p_estudio);
$$;
REVOKE EXECUTE ON FUNCTION public.gestiona_honorarios(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gestiona_honorarios(UUID, TEXT) TO authenticated;

DROP POLICY IF EXISTS "Estudio gestiona abonos" ON public.honorarios_abonos;
CREATE POLICY "Estudio gestiona abonos" ON public.honorarios_abonos
    FOR ALL USING (public.gestiona_honorarios(estudio_id, empresa_id))
    WITH CHECK (public.gestiona_honorarios(estudio_id, empresa_id));

DROP POLICY IF EXISTS "Estudio gestiona cuenta corriente" ON public.honorarios_movimientos;
CREATE POLICY "Estudio gestiona cuenta corriente" ON public.honorarios_movimientos
    FOR ALL USING (public.gestiona_honorarios(estudio_id, empresa_id))
    WITH CHECK (public.gestiona_honorarios(estudio_id, empresa_id));
