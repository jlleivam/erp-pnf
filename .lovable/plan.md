
## Objetivo

Rediseñar `CapturarRespuestaDialog` para que se vea y funcione como una cotización real, de modo que el monto capturado coincida exactamente con el documento del proveedor.

## Cambios en `src/components/requisiciones/CapturarRespuestaDialog.tsx`

### Encabezado
- Título: **"Cotización"** (en lugar de "Capturar cotización · folio").
- Subtítulo con datos del proveedor: razón social del proveedor en grande + folio SC a la derecha. Mantener la línea descriptiva pero más enfocada al formato cotización.

### Tabla de insumos
Columnas (en este orden):
1. **Insumo** (nombre + unidad)
2. **Cantidad** (input numérico)
3. **P. Unitario** (input con prefijo `$` visible dentro del campo)
4. **Importe** (calculado: `cantidad × precio_unitario`, solo lectura, formato MXN, alineado a la derecha)
5. **Nota** (opcional)

Ajustes de UX en los inputs:
- Quitar las flechitas (spinners) de los inputs numéricos: agregar clase utilitaria global o inline `[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`.
- Prefijo `$` para P. Unitario (con un wrapper `relative` y un `<span>` posicionado a la izquierda dentro del input, padding-left para el texto).
- Importe siempre formateado con `formatMXN`.

### Totales (debajo de la tabla)
Bloque alineado a la derecha con tres líneas tabulares:
- **Subtotal:** suma de importes
- **IVA (16%):** subtotal × 0.16
- **Total:** subtotal + IVA — en negritas, ligeramente más grande

Cálculo en vivo con `useMemo` sobre `items`.

### Footer
Mantener `Cancelar` y `Guardar respuesta` (sin cambios funcionales). El total mostrado debe coincidir con `calcularTotalSC` actual (que usa subtotal sin IVA). 

**Pregunta abierta:** el cálculo actual `calcularTotalSC` suma `cantidad × precio_unitario` (subtotal sin IVA). El total mostrado en la lista de SCs y en el PDF ¿debe seguir siendo subtotal, o también incluir IVA? Por consistencia con "asegurar que el monto coincida con la cotización del proveedor", propongo:
- Guardar `precio_unitario` tal cual (sin IVA, como ya se hace).
- El "Total" mostrado en el diálogo es informativo (subtotal + IVA 16%) para que el usuario verifique contra la cotización en papel del proveedor.
- No cambiar el modelo de datos ni `calcularTotalSC` ni el PDF en este turno.

Si prefieres que el total con IVA también se refleje en la tarjeta de la SC y en el comparativo, lo agrego como paso siguiente.

## Archivos a tocar
- `src/components/requisiciones/CapturarRespuestaDialog.tsx` (único cambio)

## Fuera de alcance
- PDF de solicitud de cotización (`solicitud-cotizacion-pdf.ts`).
- `ComparativaTable`, lista de SCs en `SolicitudesTab`.
- Esquema de BD.
