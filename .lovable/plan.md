# Subir presupuesto en PDF con extracción por IA

Actualmente el paso 2 de "Nueva obra" solo acepta `.xlsx` y lo guarda en el bucket `presupuestos` sin parsear. Vamos a:

1. Aceptar también `.pdf` (además de `.xlsx`) como archivo adjunto oficial del presupuesto.
2. Extraer partidas del PDF con Lovable AI y prellenar la captura del presupuesto para que el usuario revise/edite antes de guardarlo.

## Alcance funcional

- El paso 2 seguirá siendo opcional. Si el usuario sube un archivo:
  - Se guarda el archivo original (PDF o XLSX) en el bucket `presupuestos` (como hoy).
  - Si es PDF: se dispara la extracción con IA y se muestra vista previa de partidas detectadas (concepto, unidad, cantidad, precio unitario, importe) para confirmar/editar.
  - Si es XLSX: sin cambios (solo se adjunta).
- El PDF original queda vinculado a la obra como referencia (igual que hoy con XLSX).
- Las partidas extraídas se guardan como la versión inicial del presupuesto de la obra usando el flujo existente de `presupuestos.functions.ts` (misma estructura que la captura manual), para que después el usuario pueda editarlas en el módulo Presupuesto.
- Si la extracción falla o queda vacía, se guarda el PDF adjunto igual y se avisa al usuario que capture manualmente.

## Cambios técnicos

**Frontend (`src/routes/_authenticated/app.obras.nueva.tsx`)**
- `<Input type="file" accept=".xlsx,.pdf,...">` para aceptar PDF.
- Al subir un PDF: llamar nueva server function `extraerPresupuestoDesdePdf({ path })` y mostrar un panel colapsable con las partidas detectadas + botón "Usar estas partidas" / "Descartar".
- Estado local `partidasExtraidas` que, si el usuario confirma, se envía en el paso 3 junto con el resto de datos de la obra.

**Backend**
- Nueva `src/lib/api/presupuestos-import.functions.ts` con:
  - `extraerPresupuestoDesdePdf` (`createServerFn` + `requireSupabaseAuth`): genera signed URL del PDF en el bucket `presupuestos`, arma un request multimodal a Lovable AI Gateway (`google/gemini-3.6-flash`) usando `file` content block + prompt con esquema estructurado (JSON schema vía tool calling) para devolver un array de partidas normalizadas `{ concepto, unidad, cantidad, precio_unitario }`.
  - Manejo de errores 429/402 con mensajes claros al usuario.
- Extender `crearObra` (o el paso siguiente del wizard) para aceptar `partidas_iniciales?: Partida[]` y, si viene, insertar la primera versión del presupuesto usando los helpers existentes en `presupuestos.functions.ts`.

**Storage**
- Bucket `presupuestos` ya existe; no requiere cambios. El path sigue `${company_id}/${uuid}-${filename}`.

## Notas

- Solo se toca el flujo de creación de obra y el paso 2 del wizard; el módulo Presupuesto no cambia.
- El PDF nunca se envía a un tercero fuera de Lovable AI Gateway; se pasa por signed URL de Supabase Storage.
- La extracción es best-effort: las partidas quedan editables en el módulo Presupuesto de la obra.
