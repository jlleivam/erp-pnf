-- Relajar RLS de obras / obra_team / obra_comisiones a "misma empresa".
-- El enforcement fino por acción vive ahora en la capa de aplicación (requirePermission).

DROP POLICY IF EXISTS "Director manages obras" ON public.obras;
CREATE POLICY "Company members manage obras"
  ON public.obras
  FOR ALL
  TO authenticated
  USING (company_id = public.current_company_id())
  WITH CHECK (company_id = public.current_company_id());

DROP POLICY IF EXISTS "Director manages obra_team" ON public.obra_team;
CREATE POLICY "Company members manage obra_team"
  ON public.obra_team
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_team.obra_id AND o.company_id = public.current_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_team.obra_id AND o.company_id = public.current_company_id()));

DROP POLICY IF EXISTS "Director manages comisiones" ON public.obra_comisiones;
CREATE POLICY "Company members manage comisiones"
  ON public.obra_comisiones
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_comisiones.obra_id AND o.company_id = public.current_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_comisiones.obra_id AND o.company_id = public.current_company_id()));