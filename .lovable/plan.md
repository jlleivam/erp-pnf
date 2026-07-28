## Objetivo
Al registrar una recepción de OC, requerir foto de la remisión física como evidencia. Si no hay remisión, se marca "Sin remisión" (con motivo opcional) y no se sube foto.

## Backend

**Storage bucket** (nuevo, privado): `almacen-remisiones`
- Políticas RLS en `storage.objects`:
  - INSERT/SELECT para `authenticated` cuya `company_id` (path prefijo) coincida.
  - Ruta: `{company_id}/{obra_id}/{recepcion_id}/{filename}`.

**Migración** `almacen_recepciones`:
- `sin_remision boolean not null default false`
- `motivo_sin_remision text` (nullable, max 300)
- `evidencia_path text` (nullable) — ruta en el bucket

**`registrarRecepcion`** (`src/lib/api/almacen.functions.ts`):
- Añadir al input: `sinRemision: boolean`, `motivoSinRemision: string|null`, `evidenciaPath: string|null`.
- Reglas:
  - Si `sinRemision === false` → `evidenciaPath` requerido; `folioRemision` sigue opcional (o requerido, ver Pregunta).
  - Si `sinRemision === true` → `evidenciaPath` debe ser null; `folioRemision` se ignora.
- Persistir los nuevos campos en el insert.

## Frontend (`src/components/almacen/RecepcionDialog.tsx`)
- Estado nuevo: `sinRemision`, `motivoSinRemision`, `file`, `uploadedPath`.
- UI en el bloque superior:
  - Checkbox "Sin remisión física".
  - Si NO está marcado: input `<Input type="file" accept="image/*,application/pdf">` (obligatorio, marcado con asterisco rojo) + preview y botón para reemplazar.
  - Si SÍ está marcado: `Textarea` opcional "Motivo (opcional)", oculta folio/archivo.
- Al guardar:
  1. Si hay archivo, subirlo con `supabase.storage.from('almacen-remisiones').upload(path, file)` usando `crypto.randomUUID()` + extensión.
  2. Llamar `registrarRecepcion` con los nuevos campos.
  3. Validar en cliente antes de mutar (mostrar toast si falta evidencia).

## Preguntas
1. Cuando hay remisión física, ¿el **folio de remisión** también debe volverse obligatorio, o sigue opcional (solo la foto es obligatoria)?
2. ¿Aceptar solo imágenes (jpg/png/heic) o también PDF?