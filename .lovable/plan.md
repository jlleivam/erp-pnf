El proyecto usa `react-day-picker` v9, donde la prop `fromDate` ya no existe (fue reemplazada en la v9). Por eso el calendario sigue dejando navegar a meses pasados aunque los días estén deshabilitados.

### Cambio

1. **`src/components/requisiciones/NuevaRequisicionSheet.tsx`** (bloque `<Calendar>` de Fecha requerida):
   - Reemplazar `fromDate={startOfDay(new Date())}` por `startMonth={startOfDay(new Date())}` — esta es la prop equivalente en RDP v9 que tope la navegación al mes actual (oculta/deshabilita el chevron izquierdo cuando se está en el mes actual).
   - Mantener `disabled={{ before: startOfDay(new Date()) }}` para que los días anteriores a hoy no sean seleccionables.

Resultado: al abrir el calendario en el mes actual, la flecha izquierda queda inactiva y no se puede retroceder a meses pasados.
