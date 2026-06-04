## Contexto

La migración de base de datos ya se ejecutó (tabla `unidades_negocio`, columnas nuevas en `companies`, `unidad_negocio_id` en `obras`, bucket `company-logos`). Falta construir las **server functions** y la **UI de las 5 pestañas**. Por eso sigues viendo la pantalla vieja con 3 pestañas placeholder.

## Cambios

### 1. Server functions (nuevas)

- `src/lib/company.functions.ts`
  - `getCompanyConfig()` — devuelve todos los campos de la empresa del usuario
  - `updateCompanyFacturacion(data)` — solo Director, valida con Zod (tipo_persona, RFC, CURP, régimen, dirección, IMSS, INFONAVIT)
  - `updateCompanyConfig(data)` — solo Director (moneda, zona horaria)
  - `uploadCompanyLogo(file)` / `deleteCompanyLogo()` — solo Director, bucket `company-logos`

- `src/lib/unidades-negocio.functions.ts`
  - `listUnidadesNegocio()` — todos los miembros
  - `crearUnidadNegocio(nombre)` — solo Director
  - `editarUnidadNegocio(id, nombre)` — solo Director
  - `eliminarUnidadNegocio(id)` — solo Director, error si hay obras vinculadas

### 2. Reescribir `src/routes/_authenticated/app.configuracion.tsx` con 5 pestañas

1. **Datos de facturación** → `<FacturacionTab />`
   - Tipo de persona (moral/física), Razón social / Nombre completo, RFC, CURP (solo física), Régimen fiscal (reutilizar constantes de clientes), dirección fiscal completa, IMSS, INFONAVIT
2. **Configuración** → `<ConfiguracionTab />`
   - Moneda, zona horaria, gestión inline de Unidades de negocio (lista + crear/editar/eliminar)
3. **Identidad** → `<IdentidadTab />`
   - Uploader de logo (PNG/JPG/SVG), preview con signed URL, botón eliminar
4. **Equipo** → `<EquipoModule />` (sin cambios)
5. **Documentación** → `<ModulePlaceholder title="Próximamente" />`

Componentes nuevos en `src/components/configuracion/`:
- `FacturacionTab.tsx`
- `ConfiguracionTab.tsx`
- `IdentidadTab.tsx`
- `UnidadesNegocioManager.tsx` (usado dentro de ConfiguracionTab)

### 3. Formulario de obra

- Reemplazar el selector fijo de `tipo_obra` por `<Select>` poblado con `listUnidadesNegocio` (useQuery).
- Si no hay unidades: mostrar alerta con link a `/app/configuracion` (solo navegable si Director).

### 4. Vistas

- Dashboard, listado de obras y wizard: mostrar `unidad_negocio.nombre` en lugar de `tipo_obra`.

### 5. Acceso

- Configuración: ya restringida a Director (route guard existente).
- Mutaciones backend validan `is_director_of(company_id)` en el handler.
- Lectura de unidades de negocio: cualquier miembro de la empresa.

## Detalles técnicos

- Régimen fiscal: extraer constantes existentes de clientes a `src/lib/regimenes-fiscales.ts` para reutilizar.
- Logo: signed URL (1h) para preview; path `{company_id}/logo.{ext}`.
- Toda mutación invalida `['company']` o `['unidades-negocio']` en React Query.
- Tipos regenerados automáticamente tras la migración ya aprobada — los handlers usan `supabase.from('companies' | 'unidades_negocio' | 'obras')` directamente.