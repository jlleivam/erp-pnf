## Problema

En `RequisicionesModule.tsx` (líneas 30 y 122), la vista con botones **Cotizar / Continuar / Ver OCs** se muestra sólo si `roles.includes("administrativo")`. El director no tiene ese rol literal, y aunque `usePermisos.can()` le da bypass, nunca se consulta un permiso — sólo el nombre del rol. Resultado: José Luis (director) cae en la vista de tarjetas de residente sin acceso a cotizar ni ver OCs.

Además falta cubrir las acciones nuevas que pide el usuario dentro de la matriz de permisos: **cotizar** una requisición y **generar OC**.

## Cambios

### 1. `src/lib/permisos/catalogo.ts`
Agregar dos acciones nuevas (default: administrativo):
- `requisiciones.cotizar` — cotizar requisiciones y capturar respuestas de proveedores
- `requisiciones.generar_oc` — generar orden(es) de compra desde la comparativa

Reutilizamos `requisiciones.aprobar` / `requisiciones.rechazar` ya existentes para la revisión de OCs, y agregamos `requisiciones.ver_oc` (default: administrativo + supervisor) para el listado/tabla de OCs.

### 2. `src/components/requisiciones/RequisicionesModule.tsx` (UI)
- Reemplazar `isAdministrativo` por:
  - `puedeCotizar = can("requisiciones.cotizar")`
  - `puedeVerOC = can("requisiciones.ver_oc")`
- La tabla admin de Activas se muestra si `puedeCotizar || puedeVerOC` (director entra por bypass).
- Botones de acción por permiso: **Cotizar / Continuar** requiere `puedeCotizar`; **Ver OCs** requiere `puedeVerOC`.
- Historial: el gate `isAdministrativo` (líneas 317, 331) pasa a `puedeVerOC`.

### 3. `src/components/requisiciones/CotizacionSheet.tsx` + `ComparativaTable.tsx` (UI)
- Botón/acción **Capturar respuesta** y edición de precios de cotización: gate por `requisiciones.cotizar`.
- Botón **Generar OC** en la comparativa: gate por `requisiciones.generar_oc`.
- Mantener los gates ya cableados de `aprobar` / `rechazar` para autorizar/rechazar la OC generada.

### 4. Servidor (enforcement) en `src/lib/api/cotizaciones.functions.ts`
Agregar `requirePermission(...)` a:
- funciones de captura/edición de respuestas de proveedor → `requisiciones.cotizar`
- función que genera la OC desde la comparativa → `requisiciones.generar_oc`

Sin migración: `role_permissions` sólo guarda overrides; los defaults viven en el catálogo.

## Resultado esperado
- Director: ve todo por bypass (tabla admin con Cotizar y Ver OCs).
- Administrativo (por defecto): igual que hoy.
- Cualquier rol al que en Configuración → Permisos se le active el check de `cotizar` o `generar OC` obtiene esas acciones inmediatamente, sin tocar código.
