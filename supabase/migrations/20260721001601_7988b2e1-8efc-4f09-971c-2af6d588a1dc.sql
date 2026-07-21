
CREATE TABLE public.notificacion_preferencias (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  tipo text NOT NULL,
  habilitado boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, role, tipo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacion_preferencias TO authenticated;
GRANT ALL ON public.notificacion_preferencias TO service_role;

ALTER TABLE public.notificacion_preferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read notif prefs in their company"
  ON public.notificacion_preferencias FOR SELECT
  TO authenticated
  USING (company_id = public.current_company_id());

CREATE POLICY "Director manages notif prefs"
  ON public.notificacion_preferencias FOR ALL
  TO authenticated
  USING (public.is_director_of(company_id))
  WITH CHECK (public.is_director_of(company_id));
