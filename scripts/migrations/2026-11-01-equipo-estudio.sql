-- =====================================================================
-- 2026-11-01 · Equipo del estudio (varios usuarios por estudio)
--
-- Roles:
--   titular        la cuenta que creo el estudio (fila en public.estudios)
--   administrador  todo, incluido equipo, certificado de ARCA y borrado de empresas
--   contador       todas las empresas del estudio; no gestiona equipo ni certificado
--   asistente      solo las empresas que tenga asignadas
--
-- Todas las politicas pasan de "estudio_id = auth.uid()" a funciones que
-- resuelven el estudio del usuario. Requiere las migraciones 2026-10-14,
-- 2026-10-30 y 2026-10-31 aplicadas antes. Idempotente.
-- =====================================================================

-- 1. Tablas
CREATE TABLE IF NOT EXISTS public.estudio_miembros (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, -- un usuario, un estudio
    estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
    email TEXT,
    nombre TEXT,
    rol TEXT NOT NULL CHECK (rol IN ('administrador', 'contador', 'asistente')),
    activo BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS estudio_miembros_estudio_idx ON public.estudio_miembros (estudio_id);

CREATE TABLE IF NOT EXISTS public.empresa_asignaciones (
    empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    PRIMARY KEY (empresa_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.invitaciones_equipo (
    codigo TEXT PRIMARY KEY,
    estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
    email TEXT,
    rol TEXT NOT NULL CHECK (rol IN ('administrador', 'contador', 'asistente')),
    usado BOOLEAN DEFAULT false NOT NULL,
    usado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    expira_en TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '14 days') NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.estudio_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitaciones_equipo ENABLE ROW LEVEL SECURITY;

-- 2. Funciones de permiso (SECURITY DEFINER: leen sin RLS, sin recursion)
CREATE OR REPLACE FUNCTION public.mi_estudio_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT COALESCE(
        (SELECT id FROM public.estudios WHERE id = auth.uid()),
        (SELECT estudio_id FROM public.estudio_miembros WHERE user_id = auth.uid() AND activo)
    );
$$;

CREATE OR REPLACE FUNCTION public.mi_rol_estudio()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT CASE
        WHEN EXISTS (SELECT 1 FROM public.estudios WHERE id = auth.uid()) THEN 'titular'
        ELSE (SELECT rol FROM public.estudio_miembros WHERE user_id = auth.uid() AND activo)
    END;
$$;

CREATE OR REPLACE FUNCTION public.es_del_estudio(p_estudio UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT p_estudio IS NOT NULL AND p_estudio = public.mi_estudio_id();
$$;

CREATE OR REPLACE FUNCTION public.es_admin_estudio(p_estudio UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT public.es_del_estudio(p_estudio) AND public.mi_rol_estudio() IN ('titular', 'administrador');
$$;

CREATE OR REPLACE FUNCTION public.puede_ver_empresa(p_empresa TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.empresas e
        WHERE e.id = p_empresa
          AND e.estudio_id = public.mi_estudio_id()
          AND (public.mi_rol_estudio() IN ('titular', 'administrador', 'contador')
               OR EXISTS (SELECT 1 FROM public.empresa_asignaciones a WHERE a.empresa_id = e.id AND a.user_id = auth.uid()))
    );
$$;

REVOKE EXECUTE ON FUNCTION public.mi_estudio_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mi_rol_estudio() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.es_del_estudio(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.es_admin_estudio(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.puede_ver_empresa(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mi_estudio_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mi_rol_estudio() TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_del_estudio(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_admin_estudio(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.puede_ver_empresa(TEXT) TO authenticated;

-- 3. Politicas reescritas
-- Registro de actividad: titular y administradores
DROP POLICY IF EXISTS "Users can view their own security logs" ON public.seguridad_logs;
DROP POLICY IF EXISTS "Equipo admin ve el registro de actividad" ON public.seguridad_logs;
CREATE POLICY "Equipo admin ve el registro de actividad" ON public.seguridad_logs
    FOR SELECT USING (public.es_admin_estudio(estudio_id));

-- Perfil del estudio
DROP POLICY IF EXISTS "Estudios ven su propio perfil" ON public.estudios;
DROP POLICY IF EXISTS "Estudios editan su propio perfil" ON public.estudios;
DROP POLICY IF EXISTS "Estudios can manage their own profile" ON public.estudios;
CREATE POLICY "Estudios ven su propio perfil" ON public.estudios
    FOR SELECT USING (public.es_del_estudio(id));
CREATE POLICY "Estudios editan su propio perfil" ON public.estudios
    FOR UPDATE USING (public.es_admin_estudio(id)) WITH CHECK (public.es_admin_estudio(id));

-- Empresas
DROP POLICY IF EXISTS "Estudios can manage their own companies" ON public.empresas;
DROP POLICY IF EXISTS "Equipo ve empresas" ON public.empresas;
DROP POLICY IF EXISTS "Equipo crea empresas" ON public.empresas;
DROP POLICY IF EXISTS "Equipo edita empresas" ON public.empresas;
DROP POLICY IF EXISTS "Admin borra empresas" ON public.empresas;
CREATE POLICY "Equipo ve empresas" ON public.empresas
    FOR SELECT USING (public.puede_ver_empresa(id));
CREATE POLICY "Equipo crea empresas" ON public.empresas
    FOR INSERT WITH CHECK (public.es_del_estudio(estudio_id) AND public.mi_rol_estudio() <> 'asistente');
CREATE POLICY "Equipo edita empresas" ON public.empresas
    FOR UPDATE USING (public.puede_ver_empresa(id)) WITH CHECK (public.es_del_estudio(estudio_id));
CREATE POLICY "Admin borra empresas" ON public.empresas
    FOR DELETE USING (public.es_admin_estudio(estudio_id));

-- Tablas hijas de empresa
DO $$
DECLARE t TEXT; viejo TEXT;
BEGIN
    FOR t, viejo IN SELECT * FROM (VALUES
        ('transacciones', 'Estudios can manage transactions of their companies'),
        ('comprobantes_digitales', 'Estudios can manage tickets of their companies'),
        ('retenciones', 'Estudios can manage retenciones of their companies'),
        ('liquidaciones_sueldos', 'Estudios can manage liquidaciones of their companies'),
        ('activos_uso', 'Estudios can manage activos_uso of their companies'),
        ('ajustes_inflacion', 'Estudios can manage ajustes_inflacion of their companies'),
        ('jurisdicciones_iibb', 'Estudios can manage jurisdicciones of their companies')
    ) AS v(t, viejo) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', viejo, t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Equipo gestiona ' || t, t);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (public.puede_ver_empresa(empresa_id)) WITH CHECK (public.puede_ver_empresa(empresa_id))',
                       'Equipo gestiona ' || t, t);
    END LOOP;
END $$;

-- Clientes del portal
DROP POLICY IF EXISTS "Estudio ve los clientes de sus propias empresas" ON public.clientes_finales;
DROP POLICY IF EXISTS "Estudio quita acceso a clientes de sus empresas" ON public.clientes_finales;
CREATE POLICY "Estudio ve los clientes de sus propias empresas" ON public.clientes_finales
    FOR SELECT USING (public.puede_ver_empresa(empresa_id));
CREATE POLICY "Estudio quita acceso a clientes de sus empresas" ON public.clientes_finales
    FOR DELETE TO authenticated USING (public.puede_ver_empresa(empresa_id));

-- Invitaciones de clientes: el estudio_id es siempre el del estudio (no el del usuario)
DROP POLICY IF EXISTS "Estudio gestiona invitaciones de sus propias empresas" ON public.invitaciones_clientes;
CREATE POLICY "Estudio gestiona invitaciones de sus propias empresas" ON public.invitaciones_clientes
    FOR ALL
    USING (public.es_del_estudio(estudio_id) AND public.puede_ver_empresa(empresa_id))
    WITH CHECK (
        public.es_del_estudio(estudio_id) AND public.puede_ver_empresa(empresa_id)
        AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = empresa_id AND e.estudio_id = invitaciones_clientes.estudio_id)
    );

-- Archivos de comprobantes
DROP POLICY IF EXISTS "comprobantes: estudio gestiona sus empresas" ON storage.objects;
CREATE POLICY "comprobantes: estudio gestiona sus empresas" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'comprobantes' AND public.puede_ver_empresa((storage.foldername(name))[1]))
    WITH CHECK (bucket_id = 'comprobantes' AND public.puede_ver_empresa((storage.foldername(name))[1]));

-- Credenciales de ARCA: todo el equipo ve si estan cargadas (nunca la clave)
DROP POLICY IF EXISTS "Estudio ve sus credenciales ARCA" ON public.arca_credenciales;
CREATE POLICY "Estudio ve sus credenciales ARCA" ON public.arca_credenciales
    FOR SELECT TO authenticated USING (public.es_del_estudio(estudio_id));

-- Tablas del equipo
DROP POLICY IF EXISTS "Equipo ve a sus miembros" ON public.estudio_miembros;
DROP POLICY IF EXISTS "Admin gestiona miembros" ON public.estudio_miembros;
DROP POLICY IF EXISTS "Admin quita miembros" ON public.estudio_miembros;
CREATE POLICY "Equipo ve a sus miembros" ON public.estudio_miembros
    FOR SELECT USING (public.es_del_estudio(estudio_id));
CREATE POLICY "Admin gestiona miembros" ON public.estudio_miembros
    FOR UPDATE USING (public.es_admin_estudio(estudio_id)) WITH CHECK (public.es_admin_estudio(estudio_id));
CREATE POLICY "Admin quita miembros" ON public.estudio_miembros
    FOR DELETE USING (public.es_admin_estudio(estudio_id));

DROP POLICY IF EXISTS "Equipo ve asignaciones" ON public.empresa_asignaciones;
DROP POLICY IF EXISTS "Admin gestiona asignaciones" ON public.empresa_asignaciones;
CREATE POLICY "Equipo ve asignaciones" ON public.empresa_asignaciones
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = empresa_id AND public.es_del_estudio(e.estudio_id)));
CREATE POLICY "Admin gestiona asignaciones" ON public.empresa_asignaciones
    FOR ALL
    USING (EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = empresa_id AND public.es_admin_estudio(e.estudio_id)))
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = empresa_id AND public.es_admin_estudio(e.estudio_id))
        AND EXISTS (SELECT 1 FROM public.empresas e JOIN public.estudio_miembros m ON m.estudio_id = e.estudio_id
                    WHERE e.id = empresa_id AND m.user_id = empresa_asignaciones.user_id)
    );

DROP POLICY IF EXISTS "Admin gestiona invitaciones de equipo" ON public.invitaciones_equipo;
CREATE POLICY "Admin gestiona invitaciones de equipo" ON public.invitaciones_equipo
    FOR ALL USING (public.es_admin_estudio(estudio_id)) WITH CHECK (public.es_admin_estudio(estudio_id));

-- 4. Trigger anti cruce de estudios: considera al equipo
CREATE OR REPLACE FUNCTION public.trigger_prevent_cross_tenant_update()
RETURNS TRIGGER AS $$
BEGIN
    -- auth.uid() NULL = service_role (Edge Functions): ya validado en codigo
    IF auth.uid() IS NOT NULL
       AND NOT public.puede_ver_empresa(NEW.empresa_id)
       AND NOT (TG_TABLE_NAME = 'comprobantes_digitales' AND public.is_cliente_of_empresa(NEW.empresa_id)) THEN
        INSERT INTO public.seguridad_logs (estudio_id, evento, tabla, registro_id, detalles)
        VALUES (public.mi_estudio_id(), 'ALERTA_INTRUSION_TENANT_CRUZADO', TG_TABLE_NAME::TEXT, NEW.id::TEXT,
                jsonb_build_object('empresa_id_solicitada', NEW.empresa_id, 'usuario', auth.uid()));
        RAISE EXCEPTION 'Operación denegada: la empresa no pertenece a tu estudio o no la tenés asignada.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. Alta de usuarios: invitacion de equipo, de cliente o estudio nuevo
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    invite RECORD;
BEGIN
    -- Miembro del equipo de un estudio
    IF new.raw_user_meta_data ? 'team_code' THEN
        UPDATE public.invitaciones_equipo i
        SET usado = true, usado_por = new.id
        WHERE i.codigo = new.raw_user_meta_data->>'team_code'
          AND i.usado = false
          AND i.expira_en > now()
          AND (i.email IS NULL OR lower(i.email) = lower(new.email))
        RETURNING i.estudio_id, i.rol INTO invite;

        IF FOUND THEN
            INSERT INTO public.estudio_miembros (user_id, estudio_id, email, nombre, rol)
            VALUES (new.id, invite.estudio_id, new.email, new.raw_user_meta_data->>'nombre', invite.rol);
            INSERT INTO public.seguridad_logs (estudio_id, evento, tabla, registro_id, detalles)
            VALUES (invite.estudio_id, 'MIEMBRO_AGREGADO', 'estudio_miembros', new.id::TEXT,
                    jsonb_build_object('email', new.email, 'rol', invite.rol));
        END IF;
        RETURN new;
    END IF;

    -- Cliente final (PyME) via codigo de invitacion
    IF new.raw_user_meta_data ? 'invite_code' THEN
        UPDATE public.invitaciones_clientes i
        SET usado = true, usado_por = new.id
        WHERE i.codigo = new.raw_user_meta_data->>'invite_code'
          AND i.usado = false
          AND i.expira_en > now()
          AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = i.empresa_id AND e.estudio_id = i.estudio_id)
        RETURNING i.codigo, i.empresa_id, i.estudio_id INTO invite;

        IF FOUND THEN
            INSERT INTO public.clientes_finales (id, empresa_id, email)
            VALUES (new.id, invite.empresa_id, new.email);
            INSERT INTO public.seguridad_logs (estudio_id, evento, tabla, registro_id, detalles)
            VALUES (invite.estudio_id, 'CLIENTE_REGISTRADO', 'clientes_finales', new.id::TEXT,
                    jsonb_build_object('email', new.email, 'empresa_id', invite.empresa_id));
        END IF;
        RETURN new;
    END IF;

    -- Estudio contable nuevo (el usuario queda como titular)
    INSERT INTO public.estudios (id, razon_social, email, arca_model_type, arca_cert_name, arca_cert_uploaded)
    VALUES (new.id, coalesce(new.raw_user_meta_data->>'studio_name', 'Mi estudio contable'), new.email,
            'hybrid', 'estudio_arca.crt', false);
    INSERT INTO public.seguridad_logs (estudio_id, evento, tabla, registro_id, detalles)
    VALUES (new.id, 'ESTUDIO_REGISTRADO', 'estudios', new.id::TEXT, jsonb_build_object('email', new.email));
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_prevent_cross_tenant_update() FROM PUBLIC, anon, authenticated;
