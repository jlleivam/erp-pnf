## Cambio: puesto como enum

Valores del enum `trabajador_puesto`:
`oficial`, `ayudante`, `operador_maquinaria`, `sobrestante`, `residente`, `auxiliar`, `administrativo`

Etiquetas mostradas en UI:
- oficial → "Oficial"
- ayudante → "Ayudante"
- operador_maquinaria → "Operador de maquinaria"
- sobrestante → "Sobrestante"
- residente → "Residente"
- auxiliar → "Auxiliar"
- administrativo → "Administrativo"

### 1. Migración Supabase
- Crear tipo `public.trabajador_puesto` con los 7 valores.
- `ALTER TABLE public.trabajadores ALTER COLUMN puesto TYPE public.trabajador_puesto USING NULL` (la tabla está vacía, no hay datos a mapear).

### 2. Constantes compartidas
Agregar en `src/components/trabajadores/imss.ts` (o nuevo helper en la misma carpeta) un arreglo `PUESTOS` con `{ value, label }` y un mapa `PUESTO_LABEL` para reutilizar en formulario, filtro y tabla.

### 3. `src/lib/api/trabajadores.functions.ts`
- Definir `puestoEnum = z.enum([...])`.
- Reemplazar las validaciones `puesto: z.string()...` en el schema de creación/actualización y en filtros por `puestoEnum.nullable().optional()` / `puestoEnum.optional()`.
- Tipar `puesto` como ese enum donde aplique.

### 4. `TrabajadorFormDialog.tsx`
- Cambiar tipo `puesto?: TrabajadorPuesto | null`.
- Reemplazar el `<Input>` de puesto por un `<Select>` con las opciones de `PUESTOS`.
- Limpieza del valor al guardar: enviar `f.puesto ?? null` (sin trim).

### 5. `CatalogoTrabajadoresModule.tsx`
- Eliminar `useMemo` que genera `puestos` desde `rows`.
- Poblar el `Select` del filtro con `PUESTOS` fijos (mostrando labels).
- En la celda de la tabla, renderizar `PUESTO_LABEL[r.puesto] ?? "—"`.
- Actualizar tipos: `puesto: TrabajadorPuesto | null`.

No se tocan permisos, RLS ni otras tablas.