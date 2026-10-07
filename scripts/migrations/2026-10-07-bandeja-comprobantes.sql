-- Bandeja de comprobantes de clientes: datos estructurados + archivos en Storage privado.
-- Idempotente.

ALTER TABLE public.comprobantes_digitales
    ADD COLUMN IF NOT EXISTS proveedor TEXT,
    ADD COLUMN IF NOT EXISTS cuit TEXT,
    ADD COLUMN IF NOT EXISTS tipo_comprobante TEXT,
    ADD COLUMN IF NOT EXISTS numero TEXT,
    ADD COLUMN IF NOT EXISTS nota_estudio TEXT;

ALTER TABLE public.comprobantes_digitales DROP CONSTRAINT IF EXISTS comprobantes_nuevos_campos_chk;
ALTER TABLE public.comprobantes_digitales ADD CONSTRAINT comprobantes_nuevos_campos_chk CHECK (
    char_length(coalesce(proveedor, '')) <= 160
    AND coalesce(cuit, '') ~ '^[0-9-]{0,13}$'
    AND char_length(coalesce(tipo_comprobante, '')) <= 40
    AND char_length(coalesce(numero, '')) <= 20
    AND char_length(coalesce(nota_estudio, '')) <= 300
);

-- Bucket privado: 5 MB, solo imagenes y PDF
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('comprobantes', 'comprobantes', false, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- El primer segmento de la ruta es el id de la empresa: <empresa_id>/<archivo>
DROP POLICY IF EXISTS "comprobantes: cliente sube a su empresa" ON storage.objects;
CREATE POLICY "comprobantes: cliente sube a su empresa" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'comprobantes' AND public.is_cliente_of_empresa((storage.foldername(name))[1]));

DROP POLICY IF EXISTS "comprobantes: cliente lee su empresa" ON storage.objects;
CREATE POLICY "comprobantes: cliente lee su empresa" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'comprobantes' AND public.is_cliente_of_empresa((storage.foldername(name))[1]));

DROP POLICY IF EXISTS "comprobantes: estudio gestiona sus empresas" ON storage.objects;
CREATE POLICY "comprobantes: estudio gestiona sus empresas" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'comprobantes' AND EXISTS (
        SELECT 1 FROM public.empresas e
        WHERE e.id = (storage.foldername(name))[1] AND e.estudio_id = auth.uid()))
    WITH CHECK (bucket_id = 'comprobantes' AND EXISTS (
        SELECT 1 FROM public.empresas e
        WHERE e.id = (storage.foldername(name))[1] AND e.estudio_id = auth.uid()));
