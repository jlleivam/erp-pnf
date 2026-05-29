# Plan: Módulo de Requisiciones

Implementar el módulo completo de requisiciones de obra, reemplazando el placeholder actual. Diseño mobile-first (PM en obra desde celular), paleta `#0f1e3d`.

## 1. Base de datos (migración Supabase)

**Enums nuevos:**
- `requisicion_estatus`: `borrador | enviada | en_cotizacion | pendiente_autorizacion | oc_generada | completada | rechazada`

**Tabla `requisiciones`:**
- `id uuid pk`, `obra_id uuid`, `company_id uuid`, `folio text` (único por empresa), `creado_por uuid`, `estatus requisicion_estatus default 'enviada'`, `notas text`, `created_at`
- Campos de timeline: `enviada_at`, `cotizacion_at`, `cotizacion_por`, `autorizacion_at`, `autorizacion_por`, `oc_at`, `oc_por`, `completada_at`, `completada_por`, `rechazada_at`, `rechazada_por`
- Índices por `(company_id, obra_id)` y `(company_id, folio)` único

**Tabla `requisicion_insumos`:**
- `id`, `requisicion_id` (cascade), `insumo_id`, `cantidad numeric`, `fecha_requerida date`, `nota text`, `created_at`

**Función `siguiente_folio_requisicion(company_id)`** SECURITY DEFINER: cuenta requisiciones del año actual de la empresa, devuelve `REQ-YYYY-NNN` con padding 3.

**GRANTs:** `authenticated` (CRUD), `service_role` ALL. RLS habilitada.

**RLS:**
- `requisiciones`:
  - SELECT: `company_id = current_company_id()`
  - INSERT: PM/Auxiliar/Director/Administrativo de la empresa con `creado_por = auth.uid()`
  - UPDATE: Director, Administrativo, Supervisor de la obra (cambios de estatus por sus roles, se valida en server fn)
  - DELETE: Director o creador si `estatus = 'enviada'`
- `requisicion_insumos`: mismas reglas vía EXISTS sobre requisicion padre

## 2. Server functions — `src/lib/api/requisiciones.functions.ts`

Todas con `requireSupabaseAuth`:

- `listRequisiciones({ obraId, soloActivas? })` → join a `requisicion_insumos` + `insumos(nombre, unidad)` + `profiles(nombre_completo)` del creador
- `getRequisicion({ id })` → detalle con insumos, datos de creador, y timeline (campos *_at, *_por con nombres resueltos vía profiles)
- `crearRequisicion({ obraId, notas?, insumos: [{ insumo_id, cantidad, fecha_requerida, nota? }] })` → llama RPC `siguiente_folio_requisicion`, inserta requisición con `estatus='enviada'`, `enviada_at=now()`, luego inserta insumos en batch
- `agregarInsumoRequisicion({ requisicionId, insumo_id, cantidad, fecha_requerida, nota? })`
- `cancelarRequisicion({ id })` → valida que el caller sea creador y estatus `'enviada'`, hace DELETE

## 3. UI — `src/components/requisiciones/`

**`RequisicionesModule.tsx`** (componente raíz mobile-first):
- Header: título "Requisiciones", subtítulo con nombre de obra, botón "Nueva requisición" (full-width en mobile)
- Tabs `Activas` / `Historial`
- **Activas**: lista de `Card` apiladas con folio, fecha, "N insumos", solicitante, badge de estatus (colores por mapa), chips con `cantidad unidad — insumo · fecha`. Tap → abre Sheet de detalle.
- **Historial**: tabla compacta con folio, fecha, # insumos, badge estatus, botón ojo.

**`NuevaRequisicionSheet.tsx`** (Sheet lateral, side `right` en desktop, full en mobile):
- Lista dinámica de bloques `InsumoBlock` con: `Select` de insumo autorizado (consume `listInsumos`), unidad readonly auto-llenada, cantidad numérica, fecha requerida (Shadcn DatePicker con `pointer-events-auto`), nota textarea opcional, botón eliminar bloque.
- Botón "Agregar otro insumo".
- Textarea "Notas generales".
- Footer: botón "Enviar requisición" → invoca `crearRequisicion`, toast, cierra Sheet, invalida queries.
- Validación: al menos un insumo, cantidad > 0, fecha requerida obligatoria.

**`RequisicionDetalleSheet.tsx`**:
- Header con folio + badge estatus
- Tabla de insumos: insumo, cantidad, unidad, fecha requerida, nota
- Sección "Notas generales"
- **Timeline** vertical de 5 pasos (Enviada → En cotización → Pendiente autorización → OC generada → Material recibido). Cada paso: ícono check si completado, fecha formateada y responsable; pasos futuros en gris. Estado `rechazada` se muestra como paso final rojo reemplazando los pendientes.
- Si rol es PM/creador y estatus `'enviada'`: botón "Cancelar requisición".

**`constants.ts`**: mapa `ESTATUS_META` con label, color de badge (gris/amarillo/morado/azul/verde/rojo usando clases `bg-*-100 text-*-800`), orden del timeline.

## 4. Routing

- Crear `src/routes/_authenticated/app.obras.$obraId.requisiciones.tsx` con `createFileRoute("/_authenticated/app/obras/$obraId/requisiciones")` → renderiza `<RequisicionesModule obraId={...} />`
- En `app.obras.$obraId.$.tsx`: agregar early return `if (slug === "requisiciones") return <RequisicionesModule obraId={obraId} />;` para que la ruta splat también lo resuelva (o confiar en la ruta específica, que tiene prioridad).

## 5. Accesos

- PM, Auxiliar, Director, Administrativo: pueden ver el botón "Nueva requisición".
- Supervisor: solo lectura — oculta botón nuevo y cancelar.
- Validación server-side ya cubierta por RLS + checks dentro de `cancelarRequisicion`.

## Notas técnicas
- Mobile-first: `Card` y Sheets en full-width en <768px, tabla `Historial` con scroll horizontal.
- Colores de badge mapeados a tokens existentes; primario `#0f1e3d` ya en theme.
- Reusar formato `formatDateMX` de `src/lib/format.ts` si existe; si no, `Intl.DateTimeFormat('es-MX')`.
- `siguiente_folio_requisicion` corre dentro de transacción de `crearRequisicion` para evitar colisiones (usa `SELECT ... FOR UPDATE` sobre conteo, o `INSERT` y re-intento; alternativa: secuencia por empresa via tabla `requisicion_folios`).

¿Procedo con esta implementación?
