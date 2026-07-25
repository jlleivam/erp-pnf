
-- Permitir al creador editar/borrar su propio borrador de requisición
CREATE POLICY "Creador edita su borrador"
  ON public.requisiciones
  FOR UPDATE
  USING (creado_por = auth.uid() AND estatus = 'borrador'::requisicion_estatus)
  WITH CHECK (creado_por = auth.uid());

CREATE POLICY "Creador borra su borrador"
  ON public.requisiciones
  FOR DELETE
  USING (creado_por = auth.uid() AND estatus = 'borrador'::requisicion_estatus);
