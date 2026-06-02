ALTER TABLE public.obra_subcontrato_presupuestos
  ADD CONSTRAINT obra_subcontrato_presupuestos_subcontrato_id_fkey
  FOREIGN KEY (subcontrato_id) REFERENCES public.obra_subcontratos(id) ON DELETE CASCADE;

ALTER TABLE public.obra_subcontrato_renglones
  ADD CONSTRAINT obra_subcontrato_renglones_presupuesto_fkey
  FOREIGN KEY (presupuesto_subcontrato_id) REFERENCES public.obra_subcontrato_presupuestos(id) ON DELETE CASCADE;

ALTER TABLE public.obra_subcontrato_estimaciones
  ADD CONSTRAINT obra_subcontrato_estimaciones_subcontrato_id_fkey
  FOREIGN KEY (subcontrato_id) REFERENCES public.obra_subcontratos(id) ON DELETE CASCADE;

ALTER TABLE public.obra_subcontrato_estimacion_renglones
  ADD CONSTRAINT obra_subcontrato_estimacion_renglones_estimacion_fkey
  FOREIGN KEY (estimacion_id) REFERENCES public.obra_subcontrato_estimaciones(id) ON DELETE CASCADE;

ALTER TABLE public.obra_subcontratos
  ADD CONSTRAINT obra_subcontratos_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES public.obras(id) ON DELETE CASCADE,
  ADD CONSTRAINT obra_subcontratos_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT obra_subcontratos_contratista_id_fkey FOREIGN KEY (contratista_id) REFERENCES public.terceros(id) ON DELETE RESTRICT;

NOTIFY pgrst, 'reload schema';