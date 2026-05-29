ALTER TABLE public.requisiciones
  ADD CONSTRAINT requisiciones_obra_id_fkey
    FOREIGN KEY (obra_id) REFERENCES public.obras(id) ON DELETE CASCADE,
  ADD CONSTRAINT requisiciones_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.requisicion_insumos
  ADD CONSTRAINT requisicion_insumos_insumo_id_fkey
    FOREIGN KEY (insumo_id) REFERENCES public.insumos(id) ON DELETE RESTRICT;