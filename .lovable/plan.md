## Objetivo

Mejorar el diálogo **"Solicitar pago de anticipo"** (en `src/components/destajos/DestajoDetalleSheet.tsx`) para que muestre toda la información clave del destajo antes de enviar la solicitud. Hoy solo aparece el monto del anticipo y las notas.

## Cambios

El diálogo mostrará, en este orden, todos los datos como **solo lectura** excepto las notas:

1. **Destajo** — nombre del destajo (`destajo.nombre`)
2. **Contratista** — nombre del destajista (`destajo.destajista.nombre_completo`, "—" si no hay)
3. **Monto total del destajo** — `formatMXN(destajo.monto_total)`
4. **Monto de anticipo** — `formatMXN(anticipoMonto)` · `anticipoPctNum.toFixed(2)}%` en una sola línea
5. **Notas para administrativo (opcional)** — único campo editable, igual que hoy

Visualmente: bloque con filas tipo "label a la izquierda / valor a la derecha" dentro de un contenedor `rounded-md border bg-muted/30 p-3`, separadas con un sutil divider o `space-y-2`. El campo de notas conserva su estilo actual (Label + Textarea).

Botones del footer (Cancelar / Enviar solicitud) y la mutación `solicitarM` se mantienen sin cambios.

## Archivos afectados

- `src/components/destajos/DestajoDetalleSheet.tsx` — solo el bloque del `<Dialog open={solicitOpen}>` (≈ líneas 622–652).

No se tocan server functions, esquema de base de datos, ni otros componentes.
