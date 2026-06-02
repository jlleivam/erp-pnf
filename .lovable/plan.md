## Objetivo

Crear el módulo **Subcontratos** dentro de cada obra, replicando el flujo del módulo de destajos (presupuesto base + órdenes de cambio + estimaciones semanales con autorización del supervisor), con dos diferencias:

1. El subcontrato se asigna a un **tercero** (categoría `contratista` o `ambos`) en lugar de a un trabajador.
2. **No hay pestaña Trabajadores** — el contratista responde por sus propias altas ante el IMSS.

## Base de datos (nueva migración)

Espejo de las tablas de destajos, prefijo `obra_subcontrato_`:

- `obra_subcontratos` — `obra_id`, `company_id`, `contratista_id` (FK a `terceros`), `numero`, `nombre`, `descripcion`, `estatus` (enum existente `destajo_doc_estatus`), `monto_total`, `creado_por`, timestamps.
- `obra_subcontrato_presupuestos` — igual a `obra_destajo_presupuestos` (tipo `base | adenda`, mismo flujo `borrador → enviado → autorizado | rechazado`).
- `obra_subcontrato_renglones` — igual a `obra_destajo_renglones`.
- `obra_subcontrato_estimaciones` — igual a `obra_destajo_estimaciones`.
- `obra_subcontrato_estimacion_renglones` — igual a `obra_destajo_estimacion_renglones`.

Para cada tabla en la misma migración: `GRANT SELECT/INSERT/UPDATE/DELETE … TO authenticated`, `GRANT ALL … TO service_role`, `ENABLE ROW LEVEL SECURITY` y políticas equivalentes a las de destajos (director / supervisor / miembro de obra leen y gestionan; sólo `borrador` editable en renglones y estimaciones). Reutilizamos los enums `destajo_doc_estatus`, `destajo_estimacion_estatus` y `presupuesto_movimiento` que ya existen.

No se crea tabla de trabajadores asignados (no aplica).

## Backend

Nuevo archivo `src/lib/api/subcontratos.functions.ts`, copia 1-a-1 de `destajos.functions.ts`:

- `listSubcontratos`, `getSubcontrato` — devuelven `contratista_nombre` (de `terceros.razon_social`) en lugar de `destajista_nombre`; sin bloque de `obra_destajo_trabajadores`.
- `crearSubcontrato` — valida que `contratistaId` exista en `terceros` con `categoria in ('contratista','ambos')`. Crea el subcontrato + presupuesto base en borrador. Sin lógica de asignación de trabajadores.
- `eliminarSubcontrato` — mismas reglas que `eliminarDestajo` (sin estimaciones cerradas y base aún en `borrador`).
- Presupuesto base + OCs (`guardarRenglonesSubcontrato`, `crearOrdenCambio…`, `guardarRenglonesOC…`, `getVigente…`, `enviar/autorizar/rechazar/reabrirPresupuestoSubcontrato`).
- Estimaciones semanales (`listEstimacionesSubcontrato`, `crearEstimacion…`, `guardarRenglones…`, `cerrar/reabrirEstimacion…`).

## Frontend

Nueva carpeta `src/components/subcontratos/`, espejo de `destajos/`:

- `SubcontratosModule.tsx` — tabla con columnas #, Subcontrato, **Contratista**, Estatus (basado en `estatus_base`), Contratado, Pagado, Acciones; mismas tarjetas de KPI (Contratado vigente, Pagado acumulado, Subcontratos activos); botón Eliminar visible sólo cuando `director && estatus_base === "borrador" && pagado_acumulado === 0`.
- `NuevoSubcontratoDialog.tsx` — selector de **Contratista** alimentado por `listTerceros` filtrado a `categoria ∈ {contratista, ambos}`.
- `SubcontratoDetalleSheet.tsx` — copia del de destajos pero **sin pestaña Trabajadores**; sólo dos tabs: **Presupuesto** y **Estimaciones**. Encabezado muestra "Contratista: {razón social}".
- `CapturaSubcontratoSheet.tsx`, `CapturaOrdenCambioSubcontratoSheet.tsx`, `CapturaEstimacionSubcontratoSheet.tsx`, `EstimacionesSubcontratoTab.tsx` — copias directas de las versiones de destajos apuntando a los endpoints nuevos.

## Routing y navegación

- En `src/routes/_authenticated/app.obras.$obraId.$.tsx` añadir el caso `if (slug === "subcontratos") return <SubcontratosModule obraId={obraId} />;` (el slug y el label ya existen en `LABELS`).
- `src/lib/modules.ts` ya tiene el módulo admin de subcontratos como placeholder; lo dejamos igual por ahora (módulo a nivel obra es lo solicitado).

## Resultado

El residente abre **Subcontratos** dentro de una obra, crea un subcontrato eligiendo un contratista del catálogo de terceros, captura el presupuesto base, lo envía al supervisor para autorización, registra órdenes de cambio y estimaciones semanales — exactamente igual que destajos, pero sin gestión de trabajadores.
