## Catálogo de Clientes — Plan de implementación

### 1. Migración de base de datos

Extender `public.clientes` con los campos faltantes (todos nullable salvo los existentes):

```
regimen_fiscal text, direccion_fiscal text,
telefono text, correo text,
contacto_nombre text, contacto_telefono text,
curp text,
condiciones_pago integer, limite_credito numeric,
banco text, clabe text, beneficiario text,
constancia_fiscal_url text, constancia_fiscal_vencimiento date,
opinion_sat_url text, opinion_sat_vencimiento date
```

Mantener `datos_contacto jsonb` por compatibilidad pero dejar de usarlo (los nuevos campos viven como columnas).

Agregar a `public.obras`:

```
monto_contratado numeric
```

Crear bucket privado de Storage `clientes-docs` con políticas RLS:
- SELECT/INSERT/UPDATE/DELETE permitido a usuarios `authenticated` cuyo `company_id` coincida con la primera carpeta del path (`<company_id>/<cliente_id>/<archivo>`).

Reemplazar la policy `Director manages clientes` por una nueva `Director y Administrativo gestionan clientes` que también incluya el rol `administrativo` (verificar que el enum `app_role` lo contenga; si no, agregarlo en la misma migración).

### 2. Server functions (`src/lib/api/clientes.functions.ts`)

Reemplazar el archivo. Schema Zod cubre todos los campos nuevos, valida RFC formato (12 moral / 13 física), CURP solo si `fisica`, contacto solo si `moral`.

- `listClientes({ search?, tipo_persona? })` — devuelve filas con campos clave + las dos fechas de vencimiento crudas (el cliente calcula el estado).
- `getCliente({ id })` — devuelve cliente completo + array `obras` (id, nombre, tipo_obra, numero_contrato, fecha_inicio, monto_contratado) y `monto_total_contratado` agregado.
- `crearCliente(datos)` — valida RFC único por `company_id` antes de insertar.
- `actualizarCliente({ id, ...datos })` — valida RFC único excluyendo el propio id.
- `eliminarCliente({ id })` — cuenta obras con `cliente_id = id`; si > 0, lanza error claro ("No se puede eliminar: tiene N obra(s) vinculada(s)").
- `subirDocumentoCliente({ id, tipo: 'constancia'|'opinion', path, vencimiento })` — actualiza url + fecha de vencimiento.

Todas usan `requireSupabaseAuth`; las mutaciones verifican rol (Director o Administrativo) leyendo `user_roles`.

### 3. UI — Vista principal (`src/routes/_authenticated/app.clientes.tsx`)

Reemplazar el archivo. Mismo estilo del Catálogo de Insumos (header con título + botón "Nuevo cliente", toolbar con buscador y filtro, tabla en `Card`).

- Toolbar: `Input` de búsqueda (nombre / RFC, debounce), `Select` filtro tipo de persona (Todos / Moral / Física).
- Tabla con columnas: Razón social, RFC, Tipo (badge), Teléfono, Correo, Alertas, Acciones.
- Columna Alertas: badge rojo "Vencido" si cualquier documento está vencido; amarillo "Por vencer" si vence en ≤30 días; gris "—" si está al día. Tooltip indica qué documento.
- Click en fila abre la ficha (sub-route `app.clientes.$clienteId.tsx` que renderiza un `Sheet` lateral grande encima de la lista, para deep-linking).
- Botón "Nuevo cliente" abre `ClienteFormDialog` (sólo Director / Administrativo).

### 4. UI — Ficha de cliente (componente `ClienteDetalle`)

4 `Tabs` (shadcn) montadas dentro de un `Sheet` lateral ancho:

- **Datos generales:** todos los campos fiscales/contacto. Campos condicionales según `tipo_persona`. Modo lectura + botón "Editar" que conmuta a formulario inline.
- **Comercial:** condiciones de pago, límite de crédito (formateado MXN), datos bancarios.
- **Documentos:** dos bloques (Constancia, Opinión SAT). Cada uno: estado actual (badge rojo/amarillo/verde), link al archivo si existe, fecha de vencimiento, botón upload (input file → `supabase.storage.from('clientes-docs').upload(...)` → server fn `subirDocumentoCliente`).
- **Obras:** tabla simple con obras vinculadas. Card resumen "Monto total contratado" (sumando `monto_contratado` de obras) formateado en MXN. Saldo pendiente "—" con tooltip "Disponible cuando el módulo de cobranza esté activo".

### 5. Formulario `ClienteFormDialog`

Dialog grande con secciones colapsables (no tabs, para crear todo de una vez):
- Identificación: tipo persona, razón social/nombre, RFC, CURP (si física), régimen fiscal.
- Contacto: dirección fiscal, teléfono, correo, contacto principal (si moral).
- Comercial: condiciones de pago, límite de crédito, banco/CLABE/beneficiario.

Validaciones: razón social requerida, RFC formato correcto y único, CLABE 18 dígitos si se provee. Los documentos se suben **después** de crear, desde la ficha.

### 6. Quick-create desde formulario de obra

El `ClienteSelector` en `app.obras.nueva.tsx` ya existe pero usa el formato viejo. Ajustarlo para enviar los campos mínimos del nuevo schema (`tipo_persona`, `razon_social`, `rfc`); el resto se completa luego desde la ficha.

Además, agregar input para `monto_contratado` en el formulario de creación de obra (ya que la columna ahora existe).

### 7. Acceso

`isDirector(roles) || hasRole(roles, 'administrativo')` habilita botones de crear/editar/eliminar y uploads. Lectura abierta a todos los miembros de la empresa.

### Detalles técnicos

- Helper `formatMXN(n)` en `src/lib/format.ts` (crear si no existe).
- Cálculo de alertas en el cliente a partir de las dos fechas crudas.
- Tipo `Cliente` extendido vive en `src/lib/api/clientes.functions.ts` y se importa en la UI.

### Archivos a crear/editar

- `supabase/migrations/<timestamp>_extend_clientes_y_obras.sql` (nueva)
- `src/lib/api/clientes.functions.ts` (reescribir)
- `src/lib/api/obras.functions.ts` (incluir `monto_contratado` en select/insert/update)
- `src/lib/format.ts` (nuevo)
- `src/routes/_authenticated/app.clientes.tsx` (reescribir como lista)
- `src/routes/_authenticated/app.clientes.$clienteId.tsx` (nuevo, ficha en Sheet)
- `src/components/clientes/ClienteFormDialog.tsx` (nuevo)
- `src/components/clientes/ClienteDetalle.tsx` (nuevo, 4 tabs)
- `src/components/clientes/DocumentoUploader.tsx` (nuevo)
- `src/routes/_authenticated/app.obras.nueva.tsx` (ajuste menor + campo monto)
