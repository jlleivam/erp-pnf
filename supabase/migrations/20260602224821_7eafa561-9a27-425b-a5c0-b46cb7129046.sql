
ALTER TABLE public.insumo_categorias ADD COLUMN prefijo TEXT;

DO $$
DECLARE
  r RECORD;
  base TEXT;
  candidate TEXT;
  suffix INT;
BEGIN
  FOR r IN SELECT id, company_id, nombre FROM public.insumo_categorias ORDER BY created_at LOOP
    base := substring(upper(regexp_replace(r.nombre, '[^A-Za-z0-9]', '', 'g')) FROM 1 FOR 3);
    IF base IS NULL OR length(base) < 3 THEN
      base := rpad(coalesce(base, ''), 3, 'X');
    END IF;
    candidate := base;
    suffix := 1;
    WHILE EXISTS (
      SELECT 1 FROM public.insumo_categorias
      WHERE company_id = r.company_id AND prefijo = candidate AND id <> r.id
    ) LOOP
      suffix := suffix + 1;
      IF suffix <= 9 THEN
        candidate := substring(base FROM 1 FOR 2) || suffix::text;
      ELSE
        candidate := substring(base FROM 1 FOR 1) || lpad(suffix::text, 2, '0');
      END IF;
    END LOOP;
    UPDATE public.insumo_categorias SET prefijo = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.insumo_categorias
  ALTER COLUMN prefijo SET NOT NULL,
  ADD CONSTRAINT insumo_categorias_prefijo_format CHECK (prefijo ~ '^[A-Z0-9]{3}$'),
  ADD CONSTRAINT insumo_categorias_prefijo_unique UNIQUE (company_id, prefijo);

ALTER TABLE public.insumos ADD COLUMN codigo TEXT;

CREATE OR REPLACE FUNCTION public.siguiente_codigo_insumo(_company_id uuid, _categoria_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pref TEXT;
  next_n INT;
BEGIN
  IF _categoria_id IS NULL THEN
    pref := 'GEN';
  ELSE
    SELECT prefijo INTO pref FROM public.insumo_categorias
      WHERE id = _categoria_id AND company_id = _company_id;
    IF pref IS NULL THEN pref := 'GEN'; END IF;
  END IF;

  SELECT COALESCE(MAX(
    NULLIF(substring(codigo FROM '^' || pref || '-(\d+)$'), '')::int
  ), 0) + 1
    INTO next_n
    FROM public.insumos
    WHERE company_id = _company_id
      AND codigo LIKE pref || '-%';

  RETURN pref || '-' || lpad(next_n::text, 4, '0');
END;
$$;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id, company_id, categoria_id FROM public.insumos
           WHERE codigo IS NULL ORDER BY created_at LOOP
    UPDATE public.insumos
      SET codigo = public.siguiente_codigo_insumo(r.company_id, r.categoria_id)
      WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.insumos
  ADD CONSTRAINT insumos_codigo_unique UNIQUE (company_id, codigo);

CREATE INDEX IF NOT EXISTS insumos_codigo_idx ON public.insumos (company_id, codigo);

CREATE OR REPLACE FUNCTION public.set_insumo_codigo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := public.siguiente_codigo_insumo(NEW.company_id, NEW.categoria_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER insumos_set_codigo
  BEFORE INSERT ON public.insumos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_insumo_codigo();
