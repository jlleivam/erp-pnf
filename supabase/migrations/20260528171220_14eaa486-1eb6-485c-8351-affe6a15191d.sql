CREATE TYPE public.trabajador_puesto AS ENUM ('oficial','ayudante','operador_maquinaria','sobrestante','residente','auxiliar','administrativo');

ALTER TABLE public.trabajadores ALTER COLUMN puesto DROP DEFAULT;
ALTER TABLE public.trabajadores ALTER COLUMN puesto TYPE public.trabajador_puesto USING NULL;