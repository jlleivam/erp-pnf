
## Objetivo

Permitir capturar cargos adicionales (flete, seguro, maniobras, etc.) en una cotización. Se capturan como renglones separados de **texto libre + importe**, y al guardar se **prorratean** entre los insumos sumándose a su `precio_unitario`. Así el precio unitario guardado refleja el costo real puesto en obra y la comparativa entre proveedores sigue siendo directa, sin tocar el esquema de BD.

## Estrategia de prorrateo

- Cada cargo extra tiene `concepto` (texto) y `monto` (MXN, antes de IVA).
- Suma total de cargos extra = `extras`.
- Subtotal base = Σ(cantidad × precio_capturado).
- Para cada insumo:
  - peso = (cantidad × precio_capturado) / subtotal_base
  - delta_unitario = (extras × peso) / cantidad
  - `precio_unitario_final` = precio_capturado + delta_unitario
- Si subtotal_base = 0, deshabilitar "Guardar" y mostrar mensaje "Captura primero los precios para poder prorratear los cargos".
- El cálculo se hace solo al guardar; en pantalla mostramos importes con precios capturados + bloque de cargos extra + totales reales.

## Cambios en `CapturarRespuestaDialog.tsx`

### Estado nuevo
- `extras: { id: string; concepto: string; monto: number }[]`.
- Inicializa vacío al abrir (no persistimos los cargos por separado).

### UI

Debajo de la tabla de insumos, antes del bloque de totales:

- Sección **"Cargos adicionales (se prorratean entre los insumos)"** con:
  - Lista de renglones: input texto `concepto` (placeholder "Flete, seguro de transporte…") + input numérico con prefijo `$` para `monto` + botón eliminar (ícono basura).
  - Botón secundario **"+ Agregar cargo"** que añade un renglón vacío.
- Si no hay cargos, solo se muestra el botón "+ Agregar cargo".

Bloque de totales actualizado a la derecha:
- Subtotal insumos
- Cargos adicionales (solo si extras > 0)
- Subtotal
- IVA (16%)
- **Total**

### Lógica de guardado

- Al hacer click en "Guardar respuesta":
  1. Calcular `precio_unitario_final` por insumo aplicando el prorrateo.
  2. Para cada cargo con concepto no vacío, concatenarlo en una nota auto-generada (ver abajo).
  3. Enviar a `capturarRespuesta` con los precios ya prorrateados.

### Trazabilidad

Para no perder el detalle de los cargos prorrateados (no hay columna en BD), los anexamos al campo `notas` de la solicitud:

```
[Cargos prorrateados]
Flete: $1,200.00
Seguro: $350.00
```

- Si `solicitud.notas` ya tiene texto, se preserva lo que esté **antes** del marcador `[Cargos prorrateados]` y se reemplaza el bloque.
- Esto requiere una pequeña ampliación de `capturarRespuesta` para aceptar opcionalmente `notas` y actualizar `cotizacion_solicitudes.notas`.

## Cambios en `src/lib/api/solicitudes-cotizacion.functions.ts`

- `capturarRespuesta`: agregar campo opcional `notas: string | null` en el `inputValidator`. En el handler, si viene definido, actualizar `cotizacion_solicitudes.notas` en la misma transacción/llamadas que ya existen.
- Sin cambios de esquema.

## Cambios en el PDF (`solicitud-cotizacion-pdf.ts`)

Sin cambios. El PDF actual es la solicitud que se envía al proveedor (precios en blanco), no el comparativo, así que no necesita reflejar cargos extra.

## Comparativa / lista de SCs

- `calcularTotalSC` y `ComparativaTable` siguen funcionando sin cambios porque los precios unitarios ya traen prorrateado el costo extra. El monto total mostrado coincidirá con el de la cotización del proveedor (sin IVA; el IVA se calcula sobre el subtotal en la UI como antes).

## Archivos a tocar

- `src/components/requisiciones/CapturarRespuestaDialog.tsx` — UI de cargos extra + cálculo de prorrateo + envío.
- `src/lib/api/solicitudes-cotizacion.functions.ts` — aceptar `notas` opcional en `capturarRespuesta` y persistirlo.

## Fuera de alcance

- Persistir los cargos como renglones independientes en BD (se descartó al elegir prorrateo).
- Edición posterior de cargos ya prorrateados: si el usuario vuelve a abrir el diálogo, los precios ya vienen con el cargo incluido; podrá re-capturar desde cero si lo desea. Lo anotamos en la nota.
- Cambios a OC, comparativa o reportes.
