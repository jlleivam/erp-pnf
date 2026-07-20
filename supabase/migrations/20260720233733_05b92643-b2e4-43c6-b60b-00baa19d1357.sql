CREATE TABLE public.role_permissions (
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  action_key TEXT NOT NULL,
  allowed BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  PRIMARY KEY (company_id, role, action_key),
  CONSTRAINT role_permissions_no_director CHECK (role <> 'director')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Directors read role permissions of their company"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (public.is_director_of(company_id));

CREATE POLICY "Directors insert role permissions"
  ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (public.is_director_of(company_id));

CREATE POLICY "Directors update role permissions"
  ON public.role_permissions FOR UPDATE TO authenticated
  USING (public.is_director_of(company_id))
  WITH CHECK (public.is_director_of(company_id));

CREATE POLICY "Directors delete role permissions"
  ON public.role_permissions FOR DELETE TO authenticated
  USING (public.is_director_of(company_id));