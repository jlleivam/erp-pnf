# Plan: ERP PNF — Estructura base

Construir el esqueleto navegable del ERP en español, con autenticación, multi-empresa, 5 roles y todos los módulos como placeholders ("Próximamente"). Sin lógica de negocio interna por ahora.

## 1. Backend (Lovable Cloud / Supabase)

Activar Lovable Cloud y crear el esquema.

**Enums**
- `app_role`: `director | residente | auxiliar | administrativo | supervisor`
- `tipo_persona`: `moral | fisica`
- `tipo_obra`: `industrial | comercial | residencial | infraestructura | vivienda_serie | urbanizacion`

**Tablas**
- `companies` — id, tipo_persona, razon_social, rfc, datos_facturacion (jsonb), created_at
- `profiles` — id (= auth.users.id), company_id, nombre_completo, email, created_at
- `user_roles` — id, user_id, company_id, role
- `clientes` — id, company_id, tipo_persona, razon_social, rfc, datos_contacto (jsonb), created_at
- `obras` — id, company_id, nombre, tipo_obra (enum), cliente_id → clientes(id), numero_contrato, ubicacion, fecha_inicio, fecha_terminacion, presupuesto_url, created_by
- `obra_team` — id, obra_id, user_id, role
- `obra_comisiones` — id, obra_id, user_id, porcentaje (numeric), base_calculo (text)
- Storage bucket `presupuestos` para los .xlsx

**Seguridad**
- RLS en todas las tablas, scoping por `company_id`
- Función `has_role(_user_id, _company_id, _role)` SECURITY DEFINER
- Trigger `handle_new_user` para crear profile al signup
- Validación al crear obra: mínimo 1 Residente + 1 Administrativo + 1 Supervisor en `obra_team`
- GRANTs explícitos a `authenticated` / `service_role` en cada tabla

## 2. Autenticación y onboarding

- `/` landing con CTA "Registrar empresa" e "Iniciar sesión"
- `/onboarding` — stepper 2 pasos:
  1. Datos empresa (tipo persona, razón social/nombre, RFC)
  2. Cuenta Director (nombre, email, password) → `signUp` + insert en `companies`, `profiles`, `user_roles` (director)
- `/login` — email + password
- Email confirmation desactivado para dev

## 3. Rutas protegidas por rol

Layout `_authenticated` con guard (sesión + rol desde Zustand). Cada módulo bajo `/app/...` chequea `allowedRoles` y redirige a `/403` si no aplica. Director puede "asumir rol" (toggle en header) para ver la UI de otro perfil.

## 4. Creación de obra (solo Director)

Stepper 3 pasos:
1. Datos generales — incluye selector/creación rápida de Cliente (tabla `clientes`)
2. Presupuesto — upload .xlsx opcional a Storage
3. Equipo — asignación a `obra_team` (valida mínimos) + opcional alta en `obra_comisiones`

## 5. Estructura de rutas

```
/                          Landing
/onboarding                Stepper registro empresa
/login                     Login
/app                       Dashboard corporativo (selector de obra)
/app/configuracion         Tabs: Facturación | Equipo | Otras
/app/clientes              Listado de clientes (placeholder)
/app/obras/nueva           Stepper 3 pasos (solo Director)
/app/obras/:id             Dashboard de obra — REAL (ver §6)

Módulos de obra (mobile-first, placeholders "Próximamente"):
/app/obras/:id/estimaciones
/app/obras/:id/ordenes-cambio
/app/obras/:id/requisiciones
/app/obras/:id/nomina
/app/obras/:id/destajos
/app/obras/:id/subcontratos
/app/obras/:id/rentas
/app/obras/:id/gasolinas
/app/obras/:id/caja-chica
/app/obras/:id/almacen-obra
/app/obras/:id/tareas
/app/obras/:id/catalogos

Módulos administrativos (desktop-first, scope empresa, placeholders):
/app/admin/requisiciones
/app/admin/cuentas-por-pagar
/app/admin/tesoreria
/app/admin/catalogos
/app/admin/almacen-central
/app/admin/gastos-oficina
/app/admin/nomina
/app/admin/destajos
/app/admin/subcontratos
/app/admin/rentas
/app/admin/gasolinas
/app/admin/caja-chica
/app/admin/tareas
```

Matriz de acceso:
- Residente / Auxiliar / Supervisor: módulos `/app/obras/:id/*`
- Auxiliar: misma UI que Residente con badge "Requiere VB Residente"
- Administrativo: módulos `/app/admin/*`
- Director: todo + `/app/obras/nueva` + `/app/configuracion` + `/app/clientes`

## 6. Dashboard de obra `/app/obras/:id` (NO placeholder)

Debe mostrar datos reales ya disponibles en la BD:
- Encabezado: nombre de la obra, badge con `tipo_obra`
- Card "Cliente": razón social / nombre del cliente (join `clientes`)
- Card "Contrato": número de contrato, ubicación
- Card "Fechas": fecha de inicio, fecha de terminación
- Card "Equipo asignado": lista de miembros desde `obra_team` con nombre + rol (join `profiles`)
- Grilla de accesos a los módulos de la obra (tiles navegables filtradas por rol)
- Widgets de métricas (avance, presupuesto ejercido, etc.) → placeholders "Próximamente"

Datos vía `createServerFn` con `requireSupabaseAuth`, leídos con TanStack Query (`ensureQueryData` en loader + `useSuspenseQuery` en componente).

## 7. UI / Diseño

- Tailwind con tokens semánticos en `src/styles.css` (oklch): blancos, grises, azul oscuro primary
- Tipografía Inter, UI tipo SaaS empresarial
- Corporativo: sidebar + topbar (desktop-first)
- Obra: bottom nav móvil + header compacto (mobile-first)
- shadcn/ui; copy en español

## 8. Estado global (Zustand)

- `useAuthStore`: user, profile, currentRole, assumedRole, companyId
- `useObraStore`: obra activa seleccionada

## Detalles técnicos

- TanStack Start + TanStack Router file-based
- Server functions con `requireSupabaseAuth` para onboarding, creación de obra/cliente, lectura del dashboard de obra
- Upload de Excel a Storage; sin parseo todavía
- Componente reutilizable `<ModulePlaceholder title="..." />` para módulos
- Guards: `_authenticated.tsx` + sub-layouts por rol

## Fuera de alcance (iteraciones futuras)

- Lógica interna de cualquier módulo
- Flujos de aprobación VB Residente → Supervisor → Admin
- Parseo del Excel de presupuesto
- Cálculo real de comisiones
- Métricas reales del dashboard de obra
- Reportes, notificaciones, auditoría
