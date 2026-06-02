## Objetivo
En la pestaña "Trabajadores" del detalle de destajo, el destajista debe aparecer asignado por defecto.

## Cambios

### 1. `src/lib/api/destajos.functions.ts` — `crearDestajo`
Después de insertar el destajo y antes de devolver, insertar automáticamente al `destajistaId` en `obra_destajo_trabajadores` (con `asignado_por = userId`). Si la inserción falla por unique-violation se ignora.

### 2. Migración: backfill destajos existentes
```sql
INSERT INTO public.obra_destajo_trabajadores (destajo_id, trabajador_id, asignado_por)
SELECT d.id, d.destajista_id, d.creado_por
FROM public.obra_destajos d
WHERE NOT EXISTS (
  SELECT 1 FROM public.obra_destajo_trabajadores t
  WHERE t.destajo_id = d.id AND t.trabajador_id = d.destajista_id
);
```
(Opcional: añadir índice único `(destajo_id, trabajador_id) WHERE desasignado_at IS NULL` para evitar duplicados — lo dejo fuera del alcance salvo que lo pidas.)

### 3. `src/components/destajos/DestajoDetalleSheet.tsx` — UI
En la lista de trabajadores asignados, marcar al destajista con un badge "Destajista" (comparando `a.trabajador_id === destajo.destajista_id`). Sin otro cambio funcional.

### 4. `AsignarTrabajadoresDialog.tsx`
Bloquear (checkbox deshabilitado y marcado) la fila correspondiente al destajista para que no se pueda desasignar.

## Resultado
Al crear un destajo, el destajista queda automáticamente en la pestaña Trabajadores; los destajos existentes se rellenan vía migración; el destajista no puede desasignarse desde el diálogo.