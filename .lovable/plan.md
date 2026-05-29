
# Solicitudes de cotización (RFQ) antes de las OCs

Hoy el administrativo arma paquetes y genera OCs directo. Vamos a intercalar un paso de **Solicitud de Cotización (SC)**: el admin elige proveedores, marca qué insumos pedirle a cada uno, descarga el PDF para enviárselo por su cuenta, captura los precios cuando responden y compara antes de armar los paquetes/OCs.

## 1. Base de datos (migración nueva)

Nuevas tablas (todas con `company_id` + RLS por company y políticas director/administrativo):

**`cotizacion_solicitudes`**
- `id`, `requisicion_id`, `company_id`, `proveedor_id → terceros(id)`, `folio text` (`SC-YYYY-NNN`, único por company), `estatus enum` (`borrador | enviada | recibida | descartada`), `enviada_at`, `recibida_at`, `notas text`, `creado_por`, `created_at`
- Función `siguiente_folio_sc(_company_id)` análoga a la de OCs.

**`cotizacion_solicitud_insumos`**
- `id`, `solicitud_id → cotizacion_solicitudes(id) ON DELETE CASCADE`, `insumo_id`, `cantidad numeric`, `precio_unitario numeric NULL` (se llena al capturar respuesta), `disponible boolean DEFAULT true` (proveedor podría no tenerlo), `nota text`, `subtotal GENERATED ALWAYS AS (cantidad * coalesce(precio_unitario,0)) STORED`, `created_at`

Tablas existentes que NO se tocan: `cotizacion_paquetes`, `cotizacion_paquete_insumos`, `ordenes_compra`. El flujo de paquetes/OCs sigue igual; lo único nuevo es que ahora se alimenta de las cotizaciones recibidas.

GRANTs estándar a `authenticated` y `service_role`.

## 2. Server functions (`src/lib/api/solicitudes-cotizacion.functions.ts`, nuevo)

Todas con `requireSupabaseAuth` + check director/administrativo:

- `getSolicitudesRequisicion({ requisicionId })` → lista de SCs con proveedor, insumos, totales.
- `crearSolicitud({ requisicionId, proveedorId, insumos: [{ insumo_id, cantidad }] })` → crea SC en `borrador` con folio nuevo.
- `actualizarSolicitud({ solicitudId, proveedorId?, insumos?, notas? })` → edita mientras esté en `borrador`.
- `eliminarSolicitud({ solicitudId })` → solo si `borrador` o `descartada`.
- `marcarEnviada({ solicitudId })` → pasa a `enviada`, set `enviada_at`. (Es el botón después de descargar el PDF.)
- `capturarRespuesta({ solicitudId, items: [{ insumo_id, precio_unitario, disponible, nota? }] })` → pasa a `recibida`, set `recibida_at`, llena precios.
- `descartarSolicitud({ solicitudId })` → marca `descartada` (no entra en comparativa).
- `getComparativa({ requisicionId })` → server fn que devuelve por insumo: `{ insumo, cantidad_requerida, ofertas: [{ solicitud_id, proveedor, precio, disponible, subtotal }] }`. Solo considera SCs `recibida`.

Validación: un mismo insumo SÍ puede aparecer en varias SCs (esa es la idea — comparar precios). La regla de "un insumo no puede estar en más de un paquete" sigue aplicando solo en `cotizacion_paquetes`.

## 3. UI

### 3.1. Nueva pestaña en `CotizacionSheet.tsx`

Pasa de 2 a 3 pestañas:
1. **Solicitudes de cotización** (nuevo, default cuando estatus = `enviada`/`en_cotizacion`)
2. **Comparativa** (nuevo)
3. **Paquetes** (lo que hoy se llama "Cotizar")
4. **Órdenes de compra** (igual)

### 3.2. Tab "Solicitudes de cotización"

- Lista de cards de SCs con folio, proveedor, badge de estatus, total estimado (si ya hay precios), botón **Descargar PDF**, **Capturar respuesta**, **Editar**, **Descartar**.
- Botón **+ Nueva solicitud** abre un sub-form:
  - Select de proveedor (terceros categoría `proveedor`/`ambos`).
  - Tabla con TODOS los insumos de la requisición; checkbox para incluir + cantidad (prellenada con la cantidad de la requisición, editable a la baja).
  - Notas opcionales.
  - Botón **Guardar borrador** o **Guardar y descargar PDF**.
- Al hacer clic en **Descargar PDF**: genera localmente un PDF con `jspdf` + `jspdf-autotable` con encabezado de la empresa, datos del proveedor, lista de insumos (nombre, unidad, cantidad), espacio para precio unitario / disponibilidad / fecha de entrega / vigencia, folio SC y firma. Tras descargar, llama `marcarEnviada` para registrar la fecha.
- Botón **Capturar respuesta** abre un modal con la misma tabla pero editable: `precio_unitario`, `disponible`, `nota`. Al guardar → `capturarRespuesta` → SC pasa a `recibida`.

### 3.3. Tab "Comparativa"

- Tabla pivote: filas = insumos de la requisición, columnas = proveedores con SC recibida.
- Cada celda muestra `precio_unitario` (o "—" / "No disponible"). Resalta en verde el menor precio por fila.
- Footer: total estimado por proveedor si se le compraran TODOS los insumos que ofertó.
- Indicador visual de cobertura: "X insumos sin cotización".
- Botón **Pasar a paquetes** que lleva al tab de Paquetes (no automatiza la asignación; el admin sigue armando los paquetes a mano usando esta info como referencia, según lo elegido).

### 3.4. Tab "Paquetes" (refinamiento mínimo)

- Cuando el admin selecciona un proveedor en un paquete, los `precio_unitario` se prellenan automáticamente con lo capturado en su SC recibida (si existe). Sigue siendo editable.
- Pequeño badge "Precio de SC-YYYY-NNN" junto al input cuando viene de una cotización.

### 3.5. Cambios menores en la tabla principal `app.admin.requisiciones.tsx`

- Renombrar acción `enviada → Cotizar` por `enviada → Solicitar cotizaciones`.
- Mismo Sheet, abre en tab "Solicitudes de cotización" por default.
- Nueva columna pequeña: contador `SCs: 2/3 recibidas`.

## 4. Estatus de requisición

Extender el helper `recalcEstatusRequisicion`:
- Si hay ≥1 SC y todas en `borrador`/`enviada` → estatus `en_cotizacion` (ya existe).
- Resto de transiciones siguen igual (en cuanto haya paquetes/OCs avanza por el camino actual).

No se agrega ningún estatus nuevo; el ciclo de vida visible sigue siendo `enviada → en_cotizacion → pendiente_autorizacion → oc_generada → completada`.

## 5. PDF de la solicitud

Generado 100% en el cliente con `jspdf` + `jspdf-autotable` (ya livianos, sin server). Contenido:
- Encabezado: razón social de la company, RFC, dirección fiscal (de `companies`).
- Dirigido a: razón social del proveedor + contacto + correo.
- Folio SC, fecha, obra, folio de requisición.
- Tabla de insumos: # | Descripción | Unidad | Cantidad | **P. Unitario** (en blanco) | **Importe** (en blanco) | **Tiempo entrega** (en blanco).
- Pie: vigencia de la cotización, condiciones de pago, datos de contacto del admin, espacio para firma.

## 6. Permisos

- Director y Administrativo: full CRUD sobre SCs.
- Supervisor/Residente: solo lectura (heredan SELECT por company).
- Residente NO ve nada nuevo en su vista.

## 7. Archivos a tocar

- Migración nueva (2 tablas, función folio, RLS, grants).
- `src/lib/api/solicitudes-cotizacion.functions.ts` (nuevo).
- `src/components/requisiciones/CotizacionSheet.tsx` (extender con 2 tabs + restructurar TabsList).
- `src/components/requisiciones/SolicitudCard.tsx` (nuevo).
- `src/components/requisiciones/CapturarRespuestaDialog.tsx` (nuevo).
- `src/components/requisiciones/ComparativaTable.tsx` (nuevo).
- `src/lib/pdf/solicitud-cotizacion-pdf.ts` (nuevo, usa `jspdf` + `jspdf-autotable`).
- `src/routes/_authenticated/app.admin.requisiciones.tsx` (renombrar label de acción + columna SCs).
- `src/lib/api/cotizaciones.functions.ts` (pequeño cambio: `guardarPaquete` prellena precios desde SC recibida si están en blanco; opcional).
- Dependencias nuevas: `jspdf`, `jspdf-autotable`.

## 8. Validación

1. Login admin → abrir requisición `enviada` → crear 2 SCs (proveedor A y B), elegir distintos subconjuntos de insumos → descargar ambos PDFs.
2. Verificar que la requisición pasa a `en_cotizacion`.
3. Capturar respuesta de cada SC con precios distintos por insumo.
4. Abrir tab Comparativa → verificar resaltado del menor precio y totales.
5. Ir a tab Paquetes → seleccionar proveedor A → ver que los precios se prellenan → generar OC → enviar a supervisor.
6. Confirmar que el residente sigue sin ver nada del módulo administrativo.
