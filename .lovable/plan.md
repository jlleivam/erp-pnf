# Configuración de empresa (5 pestañas) + Unidades de negocio

## 1. Base de datos (una sola migración)

**Tabla `unidades_negocio`**
- `id uuid pk`, `company_id uuid not null ref companies(id) on delete cascade`, `nombre text not null`, `created_at`, `updated_at`
- Unique `(company_id, lower(nombre))`
- GRANTs: `authenticated` (SELECT/INSERT/UPDATE/DELETE), `service_role` (ALL)
- RLS:
  - SELECT: `company_id = current_company_id()`
  - INSERT/UPDATE/DELETE: `company_id = current_company_id() AND is_director_of(company_id)`
- Trigger `updated_at`

**Tabla `companies` — extender con columnas para Datos de facturación + Configuración**
- `nombre_completo text`, `curp text`, `regimen_fiscal text`
- `calle text, numero text, colonia text, municipio text, estado text, cp text`
- `telefono text, correo text`
- `imss_registro_patronal text`, `infonavit text`
- `moneda text not null default 'MXN'`
- `zona_horaria text not null default 'America/Mexico_City'`
- `logo_url text`
- RLS update: solo Director de la empresa (ya existe `is_director_of`). Confirmar/añadir policy UPDATE.

**Tabla `obras` — migrar `tipo_obra` → `unidad_negocio_id`**
- Añadir `unidad_negocio_id uuid references unidades_negocio(id) on delete restrict`
- Para cada `company_id` con obras existentes: crear unidades de negocio a partir de los valores distintos del enum `tipo_obra` actual y rellenar `unidad_negocio_id` (mapeo: nombre = etiqueta legible del enum).
- Hacer `unidad_negocio_id NOT NULL` después del backfill.
- Dropear columna `tipo_obra`. Dropear el enum `tipo_obra` si ya no se usa en otras tablas (verificar primero).
- Índice en `(company_id, unidad_negocio_id)`.

**Storage**
- Crear bucket `company-logos` (privado). Policies: lectura por miembros de la empresa, escritura/borrado por Director. Path: `{company_id}/logo.{ext}`.

## 2. Server functions

**`src/lib/api/unidades-negocio.functions.ts` (nuevo)**
- `listUnidadesNegocio()` — lista por empresa actual.
- `crearUnidadNegocio({ nombre })` — Director, valida no duplicado.
- `editarUnidadNegocio({ id, nombre })` — Director.
- `eliminarUnidadNegocio({ id })` — Director; rechaza con mensaje claro si existen obras vinculadas (`select count from obras where unidad_negocio_id = id`).

**`src/lib/api/company.functions.ts` (nuevo)**
- `getCompanyConfig()` — devuelve todos los campos de facturación + configuración + logo.
- `updateCompanyFacturacion(payload)` — Director. Zod schema (tipo_persona, razón social/nombre completo, RFC, CURP, régimen fiscal, dirección, contacto, IMSS, INFONAVIT).
- `updateCompanyConfig({ moneda, zona_horaria })` — Director.
- `uploadCompanyLogo({ fileBase64, mime })` — Director, sube a `company-logos/{company_id}/logo.ext`, actualiza `companies.logo_url`.
- `deleteCompanyLogo()` — Director.

**`src/lib/api/obras.functions.ts` (modificar)**
- Reemplazar todas las referencias a `tipo_obra` por `unidad_negocio_id`.
- `crearObra` schema: `unidad_negocio_id: z.string().uuid()` (en vez del enum). Validar pertenencia a la empresa.
- `listObras` / `getObraDashboard`: incluir `unidad_negocio:unidades_negocio(id, nombre)` en lugar de `tipo_obra`.

## 3. UI — `/app/configuracion` (reemplazar tabs)

`src/routes/_authenticated/app.configuracion.tsx` con 5 `TabsTrigger`:

1. **Datos de facturación** → nuevo `CompanyFacturacionTab.tsx`
   - Form completo con campos listados, régimen fiscal usa las constantes ya existentes (`REGIMENES_MORAL` / `REGIMENES_FISICA` — extraerlas a `src/lib/regimenes-fiscales.ts` para compartir con clientes).
   - CURP visible solo si `tipo_persona === 'fisica'`.
   - Botón "Guardar cambios" → `updateCompanyFacturacion`.

2. **Configuración** → nuevo `CompanyConfiguracionTab.tsx`
   - Selects Moneda (MXN default, dejar el select abierto a futuro con MXN/USD/EUR) y Zona horaria (default `America/Mexico_City`).
   - Sección Unidades de negocio: lista con editar/eliminar inline; input + botón Agregar; al eliminar muestra error del server si tiene obras vinculadas.

3. **Identidad** → nuevo `CompanyIdentidadTab.tsx`
   - Uploader (PNG/JPG/SVG, máx ~2MB), vista previa de `logo_url`, botón eliminar, nota sobre PDFs.

4. **Equipo** → `EquipoModule` actual sin cambios.

5. **Documentación** → `ModulePlaceholder` con texto "Próximamente".

Guard de Director ya existe en el route file — se mantiene.

## 4. Formulario de nueva obra y vistas

**`src/routes/_authenticated/app.obras.nueva.tsx`**
- Sustituir el select fijo de `tipo_obra` por un select dinámico cargado con `listUnidadesNegocio` (vía `useQuery`).
- Si la lista está vacía: mostrar alerta con texto "Configura tus unidades de negocio en Configuración de empresa" y `<Link to="/app/configuracion">` (solo navegable si Director; si no, mensaje pidiendo contactar al Director).
- Quitar import del enum `tipo_obra`.

**`src/routes/_authenticated/app.obras.$obraId.index.tsx`** y **`src/routes/_authenticated/app.index.tsx`**
- Mostrar `obra.unidad_negocio?.nombre` donde antes se mostraba `obra.tipo_obra`.

**`src/lib/api/clientes.functions.ts`** (única referencia restante a `tipo_obra` probablemente para filtros): revisar y eliminar/ajustar.

## 5. Acceso

- Configuración (`/app/configuracion`): ya restringido a Director — sin cambios.
- Backend: todas las mutaciones de unidades de negocio, facturación, identidad y configuración validan `is_director_of(company_id)` en RLS y/o en el handler con `requireSupabaseAuth`.
- Lectura de unidades de negocio: cualquier miembro de la empresa (necesario para mostrar el nombre en obras y en el wizard).

## Orden de ejecución

1. Migración SQL (incluye backfill de unidades + drop de `tipo_obra` + bucket).
2. Server functions nuevas y modificadas (`unidades-negocio`, `company`, `obras`).
3. Extraer constantes de regímenes fiscales a archivo compartido.
4. UI: refactor de `app.configuracion.tsx` + 3 nuevos tab components.
5. UI: actualizar wizard de obra y vistas que mostraban `tipo_obra`.
6. Verificar build y navegar por las pestañas.

## Notas técnicas

- El logo se renderizará posteriormente en los PDFs (fuera del scope de este cambio; solo se guarda).
- No se modifica la pestaña Equipo.
- No se introducen nuevas dependencias.
