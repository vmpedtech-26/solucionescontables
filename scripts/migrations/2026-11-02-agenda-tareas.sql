-- =====================================================================
-- 2026-11-02 · Agenda del estudio: vencimientos y tareas
--
-- tareas: trabajo del estudio con responsable, estado y recurrencia.
-- Un vencimiento de ARCA marcado desde la agenda se guarda como tarea con
-- origen 'venc:<obligacion>:<AAAA-MM>' (una por empresa y periodo).
-- empresas.obligaciones: obligaciones elegidas por el estudio; NULL = las
-- que corresponden al perfil fiscal.
-- Requiere 2026-11-01-equipo-estudio.sql. Idempotente.
-- =====================================================================

ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS obligaciones TEXT[];

CREATE TABLE IF NOT EXISTS public.tareas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
    empresa_id TEXT REFERENCES public.empresas(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 200),
    detalle TEXT CHECK (detalle IS NULL OR char_length(detalle) <= 2000),
    vence DATE NOT NULL,
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_curso', 'hecha')),
    asignado_a UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    recurrencia TEXT CHECK (recurrencia IN ('mensual', 'bimestral', 'trimestral', 'semestral', 'anual')),
    origen TEXT CHECK (origen IS NULL OR origen ~ '^venc:[a-z_]+:[0-9]{4}-[0-9]{2}$'),
    creado_por UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
    completada_en TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    CONSTRAINT tareas_origen_unico UNIQUE (empresa_id, origen) -- NULL no choca
);
CREATE INDEX IF NOT EXISTS tareas_estudio_vence_idx ON public.tareas (estudio_id, vence);
ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;

-- Quien puede ver una tarea: el equipo con acceso a la empresa; las tareas
-- generales del estudio, todos menos los asistentes (salvo las suyas).
CREATE OR REPLACE FUNCTION public.puede_ver_tarea(p_estudio UUID, p_empresa TEXT, p_asignado UUID, p_creador UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT public.es_del_estudio(p_estudio) AND (
        CASE WHEN p_empresa IS NOT NULL
             THEN public.puede_ver_empresa(p_empresa)
                  AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = p_empresa AND e.estudio_id = p_estudio)
             ELSE public.mi_rol_estudio() <> 'asistente' OR p_asignado = auth.uid() OR p_creador = auth.uid()
        END);
$$;

-- El responsable tiene que ser del mismo estudio (titular o miembro)
CREATE OR REPLACE FUNCTION public.es_persona_del_estudio(p_estudio UUID, p_user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT p_user IS NULL OR p_user = p_estudio
        OR EXISTS (SELECT 1 FROM public.estudio_miembros m WHERE m.user_id = p_user AND m.estudio_id = p_estudio);
$$;

REVOKE EXECUTE ON FUNCTION public.puede_ver_tarea(UUID, TEXT, UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.es_persona_del_estudio(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.puede_ver_tarea(UUID, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_persona_del_estudio(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "Equipo ve tareas" ON public.tareas;
DROP POLICY IF EXISTS "Equipo crea tareas" ON public.tareas;
DROP POLICY IF EXISTS "Equipo edita tareas" ON public.tareas;
DROP POLICY IF EXISTS "Equipo borra tareas" ON public.tareas;
CREATE POLICY "Equipo ve tareas" ON public.tareas
    FOR SELECT USING (public.puede_ver_tarea(estudio_id, empresa_id, asignado_a, creado_por));
CREATE POLICY "Equipo crea tareas" ON public.tareas
    FOR INSERT WITH CHECK (public.puede_ver_tarea(estudio_id, empresa_id, asignado_a, creado_por)
                           AND public.es_persona_del_estudio(estudio_id, asignado_a));
CREATE POLICY "Equipo edita tareas" ON public.tareas
    FOR UPDATE USING (public.puede_ver_tarea(estudio_id, empresa_id, asignado_a, creado_por))
    WITH CHECK (public.puede_ver_tarea(estudio_id, empresa_id, asignado_a, creado_por)
                AND public.es_persona_del_estudio(estudio_id, asignado_a));
CREATE POLICY "Equipo borra tareas" ON public.tareas
    FOR DELETE USING (public.puede_ver_tarea(estudio_id, empresa_id, asignado_a, creado_por)
                      AND (public.mi_rol_estudio() <> 'asistente' OR creado_por = auth.uid()));
