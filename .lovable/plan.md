## Objetivo

En la solicitud de renta, además de la cantidad de unidades, el residente debe capturar **cuántos periodos** se piensa ocupar el equipo (ej. 3 semanas, 2 meses). Hoy solo se pide periodicidad sugerida pero no cuántos periodos.

## Cambios

### 1. Base de datos (migración)
- Agregar columna `periodos_estimados numeric NULL` a `public.obra_rentas` (nullable porque puede que en algunos casos sea indefinido).

### 2. Backend — `src/lib/api/rentas.functions.ts`
- `crearSolicitudRenta`: agregar `periodosEstimados: z.number().positive().nullable().optional()` al schema y persistirlo en el insert.
- Devolver el campo en `getRenta` / `listRentas` (si ya hace `select *` no requiere cambio; si hay listas con columnas específicas, agregarlo).

### 3. UI — `src/components/rentas/NuevaRentaDialog.tsx`
- Reordenar el grid: la primera fila queda **Cantidad (unidades)** + **Periodicidad sugerida**.
- Nueva segunda fila: **Cantidad de periodos a ocupar** (input numérico, sufijo dinámico "días/semanas/quincenas/meses" según la periodicidad seleccionada; deshabilitado hasta elegir periodicidad).
- Enviar `periodosEstimados` en el `mutate`.

### 4. UI — Detalle / Cotización
- `src/components/rentas/RentaDetalleSheet.tsx`: mostrar "Periodos estimados: N {unidad}" junto a la periodicidad sugerida.
- `src/components/rentas/CotizarRentaDialog.tsx`: mostrar el dato como referencia para el administrativo al cotizar (solo lectura, no se edita aquí).

### Fuera de alcance
- Cálculo automático de fecha fin programada a partir de periodos estimados.
- Lógica de renovación; los periodos estimados son solo referencia inicial.