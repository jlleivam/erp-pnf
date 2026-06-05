Bloquear el calendario de **Fecha requerida** en la Nueva Requisición para evitar selección de fechas pasadas y navegación a meses anteriores.

### Cambios

1. **`src/components/requisiciones/NuevaRequisicionSheet.tsx`**
   - Importar `startOfDay` desde `date-fns`.
   - Calcular la fecha de hoy a medianoche (`startOfDay(new Date())`) una vez, arriba del return del componente principal.
   - Pasar dos nuevas props al componente `<Calendar>` dentro del bloque de fecha requerida:
     - `fromDate={hoy}` — evita que el usuario navegue a meses anteriores (deshabilita el botón "anterior" cuando llega al mes actual).
     - `disabled={{ before: hoy }}` — deshabilita visualmente los días anteriores a hoy, impidiendo su selección.
   - Esto aplica a **cada bloque de insumo** que se agregue, ya que el Calendar se renderiza dentro del `.map()` de bloques.

### Detalle técnico

El componente `<Calendar>` de shadcn/ui es un wrapper sobre `react-day-picker` y acepta todas sus props vía spread (`...props`). Las props `fromDate` y `disabled` son nativas de react-day-picker v8 y funcionan directamente.

Se usa `startOfDay` para normalizar la hora a 00:00 y evitar que el día actual quede parcialmente deshabilitado por la hora del momento del render.
