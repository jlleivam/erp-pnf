-- Allow residente of obra to create/update adenda presupuestos (orden de cambio)
CREATE POLICY "Residente can create adendas"
ON public.obra_presupuestos
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = public.current_company_id()
  AND public.is_residente_de_obra(obra_id)
);

CREATE POLICY "Residente can update own draft adendas"
ON public.obra_presupuestos
FOR UPDATE
TO authenticated
USING (
  company_id = public.current_company_id()
  AND public.is_residente_de_obra(obra_id)
)
WITH CHECK (
  company_id = public.current_company_id()
  AND public.is_residente_de_obra(obra_id)
);

-- Supervisor can update (to authorize/reject)
CREATE POLICY "Supervisor can update presupuestos"
ON public.obra_presupuestos
FOR UPDATE
TO authenticated
USING (
  company_id = public.current_company_id()
  AND public.is_supervisor_de_obra(obra_id)
)
WITH CHECK (
  company_id = public.current_company_id()
  AND public.is_supervisor_de_obra(obra_id)
);

-- Also allow renglones management for residente/supervisor
CREATE POLICY "Residente manages renglones in own obra"
ON public.obra_presupuesto_renglones
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.obra_presupuestos p
    WHERE p.id = presupuesto_id
      AND p.company_id = public.current_company_id()
      AND public.is_residente_de_obra(p.obra_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.obra_presupuestos p
    WHERE p.id = presupuesto_id
      AND p.company_id = public.current_company_id()
      AND public.is_residente_de_obra(p.obra_id)
  )
);