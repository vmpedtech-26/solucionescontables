-- =====================================================================
-- 2026-10-30 · Invitaciones seguras (auditoria de seguridad)
--
-- 1. CRITICO: la politica de invitaciones_clientes solo exigia
--    estudio_id = auth.uid(); cualquier cuenta podia crear una invitacion
--    para una empresa ajena y, al canjearla, entrar al portal de esa
--    empresa (comprobantes, archivos y, si estaba habilitado, facturar con
--    el certificado del otro estudio). Ahora la empresa debe ser del estudio.
-- 2. El canje de la invitacion es atomico (no se puede usar dos veces en
--    paralelo), vence a los 14 dias y verifica que la empresa siga siendo
--    del estudio que invito.
-- 3. La fila de "estudios" solo la crea el trigger de alta: un usuario ya
--    no puede insertarse a si mismo como estudio.
-- 4. Limpieza: invitaciones y accesos que no coinciden con el dueño real.
--
-- Idempotente: se puede correr mas de una vez.
-- =====================================================================

-- 1. Politica de invitaciones atada a empresas propias
DROP POLICY IF EXISTS "Estudio gestiona invitaciones de sus propias empresas" ON public.invitaciones_clientes;
CREATE POLICY "Estudio gestiona invitaciones de sus propias empresas"
    ON public.invitaciones_clientes FOR ALL
    USING (
        estudio_id = auth.uid()
        AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = empresa_id AND e.estudio_id = auth.uid())
    )
    WITH CHECK (
        estudio_id = auth.uid()
        AND EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = empresa_id AND e.estudio_id = auth.uid())
    );

-- 2. Vencimiento y canje atomico
ALTER TABLE public.invitaciones_clientes
    ADD COLUMN IF NOT EXISTS expira_en TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '14 days') NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    invite RECORD;
BEGIN
    -- Alta de cliente final (PyME) vía código de invitación: vincula el
    -- usuario a la empresa de la invitación, NO crea un estudio.
    IF new.raw_user_meta_data ? 'invite_code' THEN
        -- Marca y lee en un solo paso: dos altas simultaneas con el mismo
        -- codigo no pueden canjearlo las dos.
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

    -- Alta de estudio contable (flujo existente, sin cambios de comportamiento)
    INSERT INTO public.estudios (id, razon_social, email, arca_model_type, arca_cert_name, arca_cert_uploaded)
    VALUES (
        new.id,
        coalesce(new.raw_user_meta_data->>'studio_name', 'Estudio Contable Comahue'),
        new.email,
        'hybrid',
        'estudio_comahue_arca.crt',
        false
    );

    -- Registrar log de auditoría del alta
    INSERT INTO public.seguridad_logs (estudio_id, evento, tabla, registro_id, detalles)
    VALUES (
        new.id,
        'ESTUDIO_REGISTRADO',
        'estudios',
        new.id::TEXT,
        jsonb_build_object('email', new.email)
    );

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 3. "estudios": leer y editar el propio perfil, sin auto-alta
DROP POLICY IF EXISTS "Estudios can manage their own profile" ON public.estudios;
DROP POLICY IF EXISTS "Estudios ven su propio perfil" ON public.estudios;
DROP POLICY IF EXISTS "Estudios editan su propio perfil" ON public.estudios;
CREATE POLICY "Estudios ven su propio perfil"
    ON public.estudios FOR SELECT
    USING (auth.uid() = id);
CREATE POLICY "Estudios editan su propio perfil"
    ON public.estudios FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 4. Limpieza de filas que no coinciden con el dueño real de la empresa
DELETE FROM public.invitaciones_clientes i
WHERE NOT EXISTS (SELECT 1 FROM public.empresas e WHERE e.id = i.empresa_id AND e.estudio_id = i.estudio_id);

-- Accesos de clientes creados con una invitacion ajena: se listan para
-- revision (no se borran solos). Deberia devolver 0 filas.
SELECT c.id, c.email, c.empresa_id, l.estudio_id AS estudio_que_invito, e.estudio_id AS dueno_real
FROM public.clientes_finales c
JOIN public.empresas e ON e.id = c.empresa_id
LEFT JOIN public.seguridad_logs l
       ON l.evento = 'CLIENTE_REGISTRADO' AND l.registro_id = c.id::TEXT
WHERE l.estudio_id IS DISTINCT FROM e.estudio_id;

-- 5. Color de empresa: solo hexadecimal (se usa dentro de style="..." en el
--    portal del cliente; un valor libre permitia inyectar HTML).
--    NOT VALID: no revisa filas viejas, si las nuevas y las editadas.
ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS empresas_color_hex;
ALTER TABLE public.empresas ADD CONSTRAINT empresas_color_hex
    CHECK (color IS NULL OR color ~* '^#[0-9a-f]{3}([0-9a-f]{3})?$') NOT VALID;
