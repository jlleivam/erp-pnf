ALTER TABLE public.cotizacion_solicitudes
  ADD CONSTRAINT cotizacion_solicitudes_requisicion_id_fkey
    FOREIGN KEY (requisicion_id) REFERENCES public.requisiciones(id) ON DELETE CASCADE,
  ADD CONSTRAINT cotizacion_solicitudes_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT cotizacion_solicitudes_proveedor_id_fkey
    FOREIGN KEY (proveedor_id) REFERENCES public.terceros(id) ON DELETE RESTRICT,
  ADD CONSTRAINT cotizacion_solicitudes_creado_por_fkey
    FOREIGN KEY (creado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.cotizacion_solicitud_insumos
  ADD CONSTRAINT cotizacion_solicitud_insumos_insumo_id_fkey
    FOREIGN KEY (insumo_id) REFERENCES public.insumos(id) ON DELETE RESTRICT;

NOTIFY pgrst, 'reload schema';