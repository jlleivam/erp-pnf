
ALTER TABLE public.obra_destajo_anticipos ADD COLUMN IF NOT EXISTS folio text;

CREATE UNIQUE INDEX IF NOT EXISTS obra_destajo_anticipos_company_folio_uniq
  ON public.obra_destajo_anticipos (company_id, folio)
  WHERE folio IS NOT NULL;

CREATE OR REPLACE FUNCTION public.siguiente_folio_anticipo_destajo(_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  yr int := EXTRACT(YEAR FROM now())::int;
  next_n int;
BEGIN
  SELECT COALESCE(MAX(
    NULLIF(substring(folio FROM '^AD-' || yr::text || '-(\d+)$'), '')::int
  ), 0) + 1
    INTO next_n
    FROM public.obra_destajo_anticipos
    WHERE company_id = _company_id
      AND folio LIKE 'AD-' || yr::text || '-%';
  RETURN 'AD-' || yr::text || '-' || lpad(next_n::text, 4, '0');
END;
$function$;
