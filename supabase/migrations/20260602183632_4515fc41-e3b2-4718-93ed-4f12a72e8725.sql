-- Add missing foreign keys to destajo tables so PostgREST can resolve embeds.

ALTER TABLE public.obra_destajos
  ADD CONSTRAINT obra_destajos_obra_id_fkey
    FOREIGN KEY (obra_id) REFERENCES public.obras(id) ON DELETE CASCADE,
  ADD CONSTRAINT obra_destajos_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT obra_destajos_destajista_id_fkey
    FOREIGN KEY (destajista_id) REFERENCES public.trabajadores(id) ON DELETE RESTRICT,
  ADD CONSTRAINT obra_destajos_creado_por_fkey
    FOREIGN KEY (creado_por) REFERENCES auth.users(id);

ALTER TABLE public.obra_destajo_presupuestos
  ADD CONSTRAINT obra_destajo_presupuestos_destajo_id_fkey
    FOREIGN KEY (destajo_id) REFERENCES public.obra_destajos(id) ON DELETE CASCADE,
  ADD CONSTRAINT obra_destajo_presupuestos_creado_por_fkey
    FOREIGN KEY (creado_por) REFERENCES auth.users(id),
  ADD CONSTRAINT obra_destajo_presupuestos_enviado_por_fkey
    FOREIGN KEY (enviado_por) REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT obra_destajo_presupuestos_autorizado_por_fkey
    FOREIGN KEY (autorizado_por) REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD CONSTRAINT obra_destajo_presupuestos_rechazado_por_fkey
    FOREIGN KEY (rechazado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.obra_destajo_renglones
  ADD CONSTRAINT obra_destajo_renglones_presupuesto_destajo_id_fkey
    FOREIGN KEY (presupuesto_destajo_id) REFERENCES public.obra_destajo_presupuestos(id) ON DELETE CASCADE;

ALTER TABLE public.obra_destajo_trabajadores
  ADD CONSTRAINT obra_destajo_trabajadores_destajo_id_fkey
    FOREIGN KEY (destajo_id) REFERENCES public.obra_destajos(id) ON DELETE CASCADE,
  ADD CONSTRAINT obra_destajo_trabajadores_trabajador_id_fkey
    FOREIGN KEY (trabajador_id) REFERENCES public.trabajadores(id) ON DELETE RESTRICT,
  ADD CONSTRAINT obra_destajo_trabajadores_asignado_por_fkey
    FOREIGN KEY (asignado_por) REFERENCES auth.users(id),
  ADD CONSTRAINT obra_destajo_trabajadores_desasignado_por_fkey
    FOREIGN KEY (desasignado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.obra_destajo_estimaciones
  ADD CONSTRAINT obra_destajo_estimaciones_destajo_id_fkey
    FOREIGN KEY (destajo_id) REFERENCES public.obra_destajos(id) ON DELETE CASCADE,
  ADD CONSTRAINT obra_destajo_estimaciones_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT obra_destajo_estimaciones_creado_por_fkey
    FOREIGN KEY (creado_por) REFERENCES auth.users(id),
  ADD CONSTRAINT obra_destajo_estimaciones_cerrada_por_fkey
    FOREIGN KEY (cerrada_por) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.obra_destajo_estimacion_renglones
  ADD CONSTRAINT obra_destajo_estimacion_renglones_estimacion_id_fkey
    FOREIGN KEY (estimacion_id) REFERENCES public.obra_destajo_estimaciones(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';