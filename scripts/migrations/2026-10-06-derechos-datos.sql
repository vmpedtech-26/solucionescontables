-- Derechos del titular de datos (Ley 25.326): exportar y eliminar la propia cuenta.
-- Idempotente. Se ejecuta con el rol del usuario autenticado (RLS limita el alcance).

-- Exporta todo lo que el usuario puede ver (RLS) en un unico JSON.
CREATE OR REPLACE FUNCTION public.export_my_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    uid uuid := auth.uid();
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'No autenticado';
    END IF;
    RETURN jsonb_build_object(
        'exportado_en', now(),
        'usuario_id', uid,
        'estudio', (SELECT to_jsonb(e) - 'arca_cert_name' FROM public.estudios e WHERE e.id = uid),
        'vinculo_cliente', (SELECT to_jsonb(c) FROM public.clientes_finales c WHERE c.id = uid),
        'empresas', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.empresas x), '[]'::jsonb),
        'transacciones', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.transacciones x), '[]'::jsonb),
        'comprobantes_digitales', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.comprobantes_digitales x), '[]'::jsonb),
        'retenciones', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.retenciones x), '[]'::jsonb),
        'liquidaciones_sueldos', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.liquidaciones_sueldos x), '[]'::jsonb),
        'activos_uso', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.activos_uso x), '[]'::jsonb),
        'ajustes_inflacion', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.ajustes_inflacion x), '[]'::jsonb),
        'jurisdicciones_iibb', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.jurisdicciones_iibb x), '[]'::jsonb),
        'invitaciones_clientes', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.invitaciones_clientes x), '[]'::jsonb),
        'registro_actividad', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM public.seguridad_logs x), '[]'::jsonb)
    );
END;
$$;

-- Elimina la cuenta del usuario autenticado. Las FK ON DELETE CASCADE borran
-- estudio -> empresas -> todos sus registros, o el vinculo de un cliente final.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    uid uuid := auth.uid();
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'No autenticado';
    END IF;
    DELETE FROM public.seguridad_logs WHERE estudio_id = uid;
    DELETE FROM auth.users WHERE id = uid;
    INSERT INTO public.seguridad_logs (estudio_id, evento, tabla, registro_id, detalles)
    VALUES (NULL, 'CUENTA_ELIMINADA', 'auth.users', NULL, '{}'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.export_my_data() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- Limpieza de leads de prueba generados durante QA
DELETE FROM public.leads WHERE email = 'qa@x.co' OR name LIKE 'QA%';
