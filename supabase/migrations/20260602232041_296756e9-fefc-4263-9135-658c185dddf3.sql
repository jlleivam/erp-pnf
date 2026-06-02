CREATE POLICY "Director inserts insumos"
ON public.insumos
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = public.current_company_id()
  AND public.is_director_of(company_id)
);