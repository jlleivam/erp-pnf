# Plan: Vista Administrativa de Requisiciones (Cotización + OCs)

Extender `/app/admin/requisiciones` para que el Administrativo arme paquetes por proveedor, cotice insumos y genere Órdenes de Compra que el Supervisor autorizará después.

## 1. Migración de base de datos

Nuevos enums:
- `oc_estatus`: `borrador | pendiente_autorizacion | autorizada | rechazada | pagada`

Extender enum `requisicion_estatus` (si no existen ya): `en_cotizacion`, `pendiente_autorizacion`, `oc_generada`.

Nuevas tablas (todas con `company_id` + RLS por `company_id` y políticas usando `is_director_of` / `has_role(..., 'administrativo')` / `'supervisor'` solo lectura para OCs):

**`cotizacion_paquetes`**
- `id`, `requisicion_id`, `company_id`, `proveedor_id → terceros(id)`, `numero int`, `created_at`
- Unique(`requisicion_id`, `numero`)

**`cotizacion_paquete_insumos`**
- `id`, `paquete_id → cotizacion_paquetes(id) ON DELETE CASCADE`, `insumo_id`, `cantidad numeric`, `precio_unitario numeric`, `subtotal numeric GENERATED ALWAYS AS (cantidad * precio_unitario) STORED`, `created_at`

**`ordenes_compra`**
- `id`, `paquete_id`, `requisicion_id`, `company_id`, `obra_id`, `proveedor_id`, `folio text` (único por empresa, formato `OC-YYYY-NNN`), `estatus oc_estatus DEFAULT 'borrador'`, `total numeric`, `creado_por`, `enviada_at`, `autorizada_at`, `autorizada_por`, `rechazada_at`, `rechazada_por`, `notas_supervisor text`, `created_at`
- Unique(`company_id`, `folio`)

Función `siguiente_folio_oc(_company_id)` análoga a `siguiente_folio_requisicion`.

GRANTs explícitos: `SELECT, INSERT, UPDATE, DELETE` a `authenticated`, `ALL` a `service_role` (sin `anon`).

RLS:
- `cotizacion_paquetes` y `cotizacion_paquete_insumos`: SELECT por `company_id = current_company_id()`; INSERT/UPDATE/DELETE para director o administrativo de la company.
- `ordenes_compra`: SELECT por company; INSERT/UPDATE para director o administrativo; supervisor solo SELECT (manejado por la política de company); transiciones de estatus se validarán en server fns.

Regla única (validación en server fn, no en DB): un mismo `insumo_id` no puede aparecer en >1 paquete dentro de la misma requisición mientras existan paquetes activos.

## 2. Server functions (`src/lib/api/cotizaciones.functions.ts`)

Todas con `requireSupabaseAuth` y validación Zod. Permiten ejecutar solo a director/administrativo (revisión de rol vía `user_roles`).

- `getCotizacionRequisicion({ requisicionId })` → paquetes (con insumos + proveedor) + OCs + insumos de la requisición con flag "ya en paquete".
- `guardarPaquete({ requisicionId, paqueteId?, proveedorId, insumos: [{ insumo_id, cantidad, precio_unitario }] })` → upsert paquete + reemplazo de items; valida no-duplicado de insumo entre paquetes; asigna `numero` consecutivo si es nuevo. Tras guardar, actualiza estatus de requisición a `en_cotizacion` si aplica.
- `eliminarPaquete({ paqueteId })` → borra paquete (cascade items) si no tiene OC asociada distinta de `borrador`.
- `generarOC({ paqueteId })` → crea OC en `borrador` con folio vía `siguiente_folio_oc`, total = SUM(subtotal). Valida: paquete con proveedor + ≥1 insumo con precio>0.
- `enviarOCASupervisor({ ocId })` → cambia `borrador → pendiente_autorizacion`, set `enviada_at`. Recalcula estatus de requisición.
- `listOCsRequisicion({ requisicionId })` → OCs con proveedor, insumos, totales, estatus.
- `actualizarEstatusRequisicion(requisicionId)` helper interno con la regla:
  - ≥1 paquete y ninguna OC → `en_cotizacion`
  - ≥1 OC `pendiente_autorizacion` → `pendiente_autorizacion`
  - todas las OCs `autorizada`/`pagada` y al menos una autorizada → `oc_generada`
  - todas las OCs `pagada` → `completada`

Placeholder (sin endpoint todavía): "Registrar pago" en UI no llama server fn (botón disabled con tooltip "Próximamente").

## 3. UI — extender `src/routes/_authenticated/app.admin.requisiciones.tsx`

Tabla existente:
- Nueva columna **Fecha más próxima** (mín de `items.fecha_requerida`) con badge rojo "Urgente" si ≤3 días.
- Columna acción dinámica según `estatus`:
  - `enviada` → botón **Cotizar**
  - `en_cotizacion` → **Continuar**
  - `pendiente_autorizacion`/`oc_generada`/`completada` → **Ver OCs**
- Abre un `Sheet` ancho con 2 pestañas (`Tabs`).

Nuevo componente `src/components/requisiciones/CotizacionSheet.tsx`:

**Tab "Cotizar"**:
- Header instructivo.
- Lista de paquetes (`PaqueteCard`):
  - Título "Paquete N", select proveedor (terceros con `categoria in ('proveedor','ambos')`).
  - Tabla de insumos: select de insumos disponibles (no usados en otros paquetes), cantidad readonly, precio_unitario input numérico, subtotal.
  - Botones: **Agregar insumo al paquete**, **Eliminar paquete**.
  - Total paquete.
  - **Generar OC** (habilitado solo si: proveedor + ≥1 insumo con precio > 0 + paquete guardado).
- Botón global **Agregar paquete con otro proveedor**.
- Footer: total requisición + contador `X de Y insumos cubiertos`.

**Tab "Órdenes de compra"**:
- Lista de OCs (`OCCard`) con folio, proveedor, items+montos, total, badge de estatus, fecha envío.
- Acciones según estatus:
  - `borrador`: **Editar** (regresa a tab Cotizar con paquete) + **Enviar a supervisor**.
  - `pendiente_autorizacion`: solo lectura + "Enviada al supervisor · {fecha}".
  - `autorizada`: badge verde + botón **Registrar pago** (disabled).
  - `rechazada`: badge rojo + `notas_supervisor` + **Revisar y reenviar** (vuelve a borrador via server fn — incluida en `enviarOCASupervisor` flujo o nueva `reabrirOC`).

Gating: si rol efectivo no es director/administrativo, mostrar mensaje "Sin permisos" (ya existe el patrón).

UI: paleta azul oscuro `#0f1e3d` como primario en este módulo (ajuste local de tokens o variant de botón si no rompe el theme global). Desktop-first.

## 4. Permisos / acceso

- Server fns rechazan a quien no sea director o administrativo (excepto reads que ya filtran por company).
- Supervisor: las OCs ya son SELECT-able por company; su vista de autorización se hará en otro paso.

## 5. Validación final

1. Login como administrativo → abrir admin requisiciones → Cotizar req. enviada → armar 2 paquetes con distintos proveedores → generar OCs → enviar a supervisor.
2. Verificar estatus de requisición transiciona `enviada → en_cotizacion → pendiente_autorizacion`.
3. Verificar que un insumo no puede repetirse entre paquetes.
4. Verificar columna fecha próxima + badge urgente.
5. Login como residente: no ve `/app/admin/requisiciones` (gating ya existente sigue intacto).

## Archivos a tocar

- Migración nueva (tablas, enums, función folio, RLS, grants).
- `src/lib/api/cotizaciones.functions.ts` (nuevo).
- `src/routes/_authenticated/app.admin.requisiciones.tsx` (extender tabla + columnas + sheet).
- `src/components/requisiciones/CotizacionSheet.tsx` (nuevo) + subcomponentes `PaqueteCard.tsx`, `OCCard.tsx`.
- `src/components/requisiciones/constants.ts` (labels/colores de estatus OC).

No se modifican: rutas existentes de obra, otros módulos, ni `src/stores/auth.ts`.
