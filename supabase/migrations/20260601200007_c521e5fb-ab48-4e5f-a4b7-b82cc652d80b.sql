ALTER TABLE public.cotizacion_paquetes
  ADD CONSTRAINT cotizacion_paquetes_requisicion_id_fkey FOREIGN KEY (requisicion_id) REFERENCES public.requisiciones(id) ON DELETE CASCADE,
  ADD CONSTRAINT cotizacion_paquetes_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT cotizacion_paquetes_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.terceros(id) ON DELETE RESTRICT;

ALTER TABLE public.ordenes_compra
  ADD CONSTRAINT ordenes_compra_requisicion_id_fkey FOREIGN KEY (requisicion_id) REFERENCES public.requisiciones(id) ON DELETE CASCADE,
  ADD CONSTRAINT ordenes_compra_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT ordenes_compra_obra_id_fkey FOREIGN KEY (obra_id) REFERENCES public.obras(id) ON DELETE RESTRICT,
  ADD CONSTRAINT ordenes_compra_proveedor_id_fkey FOREIGN KEY (proveedor_id) REFERENCES public.terceros(id) ON DELETE RESTRICT,
  ADD CONSTRAINT ordenes_compra_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT ordenes_compra_autorizada_por_fkey FOREIGN KEY (autorizada_por) REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT ordenes_compra_rechazada_por_fkey FOREIGN KEY (rechazada_por) REFERENCES auth.users(id) ON DELETE SET NULL;
