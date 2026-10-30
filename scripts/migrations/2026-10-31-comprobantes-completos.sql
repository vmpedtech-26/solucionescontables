-- =====================================================================
-- 2026-10-31 · Comprobantes completos
-- Varias alicuotas por comprobante, importes exentos / no gravados /
-- otros tributos y comprobante asociado (notas de credito y debito).
-- Necesaria ANTES de redesplegar la Edge Function `arca`.
-- Idempotente.
-- =====================================================================
ALTER TABLE public.transacciones ADD COLUMN IF NOT EXISTS alicuotas JSONB;           -- [{ alicuota, neto, iva }]
ALTER TABLE public.transacciones ADD COLUMN IF NOT EXISTS importe_exento NUMERIC(15,2) DEFAULT 0 NOT NULL;
ALTER TABLE public.transacciones ADD COLUMN IF NOT EXISTS importe_no_gravado NUMERIC(15,2) DEFAULT 0 NOT NULL;
ALTER TABLE public.transacciones ADD COLUMN IF NOT EXISTS otros_tributos NUMERIC(15,2) DEFAULT 0 NOT NULL;
ALTER TABLE public.transacciones ADD COLUMN IF NOT EXISTS cbte_asoc TEXT;

ALTER TABLE public.transacciones DROP CONSTRAINT IF EXISTS transacciones_importes_extra_positivos;
ALTER TABLE public.transacciones ADD CONSTRAINT transacciones_importes_extra_positivos
    CHECK (importe_exento >= 0 AND importe_no_gravado >= 0 AND otros_tributos >= 0);

ALTER TABLE public.transacciones DROP CONSTRAINT IF EXISTS transacciones_alicuotas_array;
ALTER TABLE public.transacciones ADD CONSTRAINT transacciones_alicuotas_array
    CHECK (alicuotas IS NULL OR jsonb_typeof(alicuotas) = 'array');
