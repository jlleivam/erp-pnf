ALTER TABLE public.terceros ADD COLUMN disponible_renta boolean NOT NULL DEFAULT false;
CREATE INDEX idx_terceros_disponible_renta ON public.terceros (company_id) WHERE disponible_renta;