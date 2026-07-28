CREATE POLICY "Members read role permissions of their company"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (company_id = public.current_company_id());