ALTER TABLE public.companies ADD COLUMN numero_exterior text, ADD COLUMN numero_interior text;
UPDATE public.companies SET numero_exterior = numero WHERE numero IS NOT NULL;
ALTER TABLE public.companies DROP COLUMN numero;