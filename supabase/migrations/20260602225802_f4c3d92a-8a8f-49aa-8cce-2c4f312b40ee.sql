ALTER TABLE public.insumos ADD COLUMN disponible_renta boolean NOT NULL DEFAULT false;
CREATE INDEX idx_insumos_disponible_renta ON public.insumos(company_id) WHERE disponible_renta = true;
ALTER TABLE public.obra_rentas ADD COLUMN insumo_id uuid REFERENCES public.insumos(id);
CREATE INDEX idx_obra_rentas_insumo_id ON public.obra_rentas(insumo_id);