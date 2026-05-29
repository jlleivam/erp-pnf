## Objetivo

Incluir en la Solicitud de Cotización (UI + PDF) los siguientes datos que hoy no aparecen o no llegan al proveedor:

1. **Nombre de la obra**
2. **Ubicación de la obra**
3. **Fecha de entrega esperada por insumo** (la que el residente capturó en la requisición — `requisicion_insumos.fecha_requerida`)
4. **Residente de la obra** (miembro de `obra_team` con rol `residente`)

No se requieren cambios de esquema: todos los datos ya existen.

## Cambios

### 1. `src/lib/api/solicitudes-cotizacion.functions.ts` — `getDatosPDF`

Ampliar el `select` y los queries auxiliares:

- En `items:cotizacion_solicitud_insumos` añadir el join hacia `requisicion_insumos` para traer `fecha_requerida` del mismo `insumo_id` dentro de la `requisicion_id` de la SC. Como no hay FK directa, se hará una segunda consulta:
  ```ts
  const { data: reqItems } = await supabase
    .from("requisicion_insumos")
    .select("insumo_id, fecha_requerida")
    .eq("requisicion_id", sc.requisicion_id);
  ```
  Luego mapear `fecha_requerida` a cada `sc.items[i]` por `insumo_id`.
- En la query de `requisiciones` extender a `obra:obras(id, nombre, ubicacion)` (ya está nombre/ubicación; añadir `id`).
- Nueva consulta: residente de la obra
  ```ts
  const { data: residenteRow } = await supabase
    .from("obra_team")
    .select("user_id, profile:profiles(nombre_completo, email)")
    .eq("obra_id", req.obra.id)
    .eq("role", "residente")
    .maybeSingle();
  ```
- Devolver `{ sc (con items enriquecidos), company, requisicion, solicitante, residente }`.

### 2. `src/lib/pdf/solicitud-cotizacion-pdf.ts`

- En la sección **REFERENCIA**: ya muestra Requisición, Obra y Ubicación → confirmar y reformatear como bloque más visible (Obra en negrita, ubicación debajo).
- Añadir línea **Residente de obra:** `${residente?.profile?.nombre_completo ?? "—"}` con su email/teléfono si existe.
- En la tabla de insumos: agregar columna **Fecha requerida** (después de Cantidad, antes de P. Unitario), formateada `dd/mm/yyyy`. Ajustar `head` y `columnStyles` (reducir anchos para que entre en carta).
- Actualizar la interfaz `PDFData` para incluir `residente`.

### 3. `src/components/requisiciones/SolicitudesTab.tsx` (UI)

- Mostrar la fecha requerida por insumo en la vista previa/listado de cada SC (columna o subtítulo bajo cada item) para que el admin la vea antes de descargar el PDF.
- En la cabecera de cada tarjeta de SC mostrar también nombre de residente (informativo).

(Solo lectura — los datos llegan por el mismo `getDatosPDF` / `getSolicitudesRequisicion`; este último se ampliará igual para incluir `fecha_requerida` por item.)

### 4. `getSolicitudesRequisicion`

Igual que en `getDatosPDF`: hacer la consulta complementaria a `requisicion_insumos` y mapear `fecha_requerida` en cada item devuelto, para que la UI lo muestre sin un fetch extra.

## QA

1. Login como administrativo, abrir una requisición con varios insumos con distintas `fecha_requerida`.
2. Crear SC para un proveedor → descargar PDF → verificar:
   - Bloque REFERENCIA con Obra, Ubicación, Residente.
   - Tabla con columna **Fecha requerida** correctamente poblada por insumo.
3. Verificar UI de SolicitudesTab muestra fechas y residente.

## Archivos a tocar

- `src/lib/api/solicitudes-cotizacion.functions.ts` (modificar 2 funciones)
- `src/lib/pdf/solicitud-cotizacion-pdf.ts` (tabla + bloque referencia)
- `src/components/requisiciones/SolicitudesTab.tsx` (mostrar fecha por item + residente)

Sin migración de base de datos.
