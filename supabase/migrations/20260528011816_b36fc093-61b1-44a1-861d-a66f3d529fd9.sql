
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('director', 'residente', 'auxiliar', 'administrativo', 'supervisor');
CREATE TYPE public.tipo_persona AS ENUM ('moral', 'fisica');
CREATE TYPE public.tipo_obra AS ENUM ('industrial', 'comercial', 'residencial', 'infraestructura', 'vivienda_serie', 'urbanizacion');

-- ============ COMPANIES ============
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_persona public.tipo_persona NOT NULL,
  razon_social text NOT NULL,
  rfc text NOT NULL,
  datos_facturacion jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  nombre_completo text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _company_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND company_id = _company_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_director_of(_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), _company_id, 'director'::public.app_role);
$$;

-- ============ CLIENTES ============
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo_persona public.tipo_persona NOT NULL,
  razon_social text NOT NULL,
  rfc text NOT NULL,
  datos_contacto jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- ============ OBRAS ============
CREATE TABLE public.obras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  tipo_obra public.tipo_obra NOT NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  numero_contrato text,
  ubicacion text,
  fecha_inicio date,
  fecha_terminacion date,
  presupuesto_url text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras TO authenticated;
GRANT ALL ON public.obras TO service_role;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

-- ============ OBRA TEAM ============
CREATE TABLE public.obra_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (obra_id, user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_team TO authenticated;
GRANT ALL ON public.obra_team TO service_role;
ALTER TABLE public.obra_team ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_member_of_obra(_obra_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.obra_team
    WHERE obra_id = _obra_id AND user_id = auth.uid()
  );
$$;

-- ============ OBRA COMISIONES ============
CREATE TABLE public.obra_comisiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  porcentaje numeric(6,3) NOT NULL DEFAULT 0,
  base_calculo text NOT NULL DEFAULT 'monto_contratado',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_comisiones TO authenticated;
GRANT ALL ON public.obra_comisiones TO service_role;
ALTER TABLE public.obra_comisiones ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- companies
CREATE POLICY "Users see own company" ON public.companies FOR SELECT TO authenticated
  USING (id = public.current_company_id());
CREATE POLICY "Anyone authenticated can insert company (onboarding)" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Director updates own company" ON public.companies FOR UPDATE TO authenticated
  USING (public.is_director_of(id)) WITH CHECK (public.is_director_of(id));

-- profiles
CREATE POLICY "Users see profiles in own company" ON public.profiles FOR SELECT TO authenticated
  USING (company_id = public.current_company_id() OR id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Director updates company profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_director_of(company_id)) WITH CHECK (public.is_director_of(company_id));

-- user_roles
CREATE POLICY "Users see roles in own company" ON public.user_roles FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "User inserts own director role on onboarding" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Director manages roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_director_of(company_id)) WITH CHECK (public.is_director_of(company_id));

-- clientes
CREATE POLICY "Users see clientes in own company" ON public.clientes FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "Director manages clientes" ON public.clientes FOR ALL TO authenticated
  USING (public.is_director_of(company_id)) WITH CHECK (public.is_director_of(company_id));

-- obras
CREATE POLICY "Users see obras in own company" ON public.obras FOR SELECT TO authenticated
  USING (company_id = public.current_company_id());
CREATE POLICY "Director manages obras" ON public.obras FOR ALL TO authenticated
  USING (public.is_director_of(company_id)) WITH CHECK (public.is_director_of(company_id));

-- obra_team
CREATE POLICY "Users see obra_team in own company" ON public.obra_team FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.company_id = public.current_company_id()));
CREATE POLICY "Director manages obra_team" ON public.obra_team FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND public.is_director_of(o.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND public.is_director_of(o.company_id)));

-- obra_comisiones
CREATE POLICY "Users see comisiones in own company" ON public.obra_comisiones FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.company_id = public.current_company_id()));
CREATE POLICY "Director manages comisiones" ON public.obra_comisiones FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND public.is_director_of(o.company_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND public.is_director_of(o.company_id)));

-- ============ TRIGGER: handle_new_user ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombre_completo)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ STORAGE BUCKET: presupuestos ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('presupuestos', 'presupuestos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users in company read presupuestos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'presupuestos');

CREATE POLICY "Directors upload presupuestos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'presupuestos');

CREATE POLICY "Directors update presupuestos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'presupuestos');

CREATE POLICY "Directors delete presupuestos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'presupuestos');
