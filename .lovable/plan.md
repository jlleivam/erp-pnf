# Asignación de un insumo a múltiples proveedores

## Problema

Hoy la comparativa permite asignar **un solo proveedor por insumo**. Si la requisición pide 150 kg de acero y Aceros Alcalde solo tiene 120 kg disponibles, no hay forma de cubrir los 30 kg restantes con otro proveedor desde la misma pantalla.

## Solución (solo UI / cliente)

Cambiar el estado de asignación de `Record<insumoId, Asignacion>` a `Record<insumoId, Asignacion[]>`, de modo que cada insumo pueda repartirse entre varios proveedores y la suma se compare contra la cantidad requerida.

### Cambios en `ComparativaTable.tsx`

1. **Estado**
   - `asignaciones: Record<string, Asignacion[]>` donde `Asignacion = { proveedorId: solicitudId, cantidad }`.
   - Helpers: `addAsignacion`, `updateAsignacion(insumoId, idx, …)`, `removeAsignacion(insumoId, idx)`.

2. **Columna "Asignar a"** (por fila de insumo)
   - Lista vertical de filas de asignación, cada una con:
     - `Select` de proveedor (solo opciones que cotizaron, disponibles, y **que aún no estén usadas** en otra fila del mismo insumo).
     - `Input` numérico de cantidad (default = `min(faltante, oferta.cantidad)`).
     - Botón ✕ para quitar esa asignación.
   - Botón **"+ Agregar proveedor"** visible mientras queden proveedores disponibles y `asignado < cantReq`.
   - Indicador de progreso debajo: `asignado / cantReq unidad` con color:
     - verde si `asignado === cantReq`
     - ámbar si `asignado < cantReq` (faltante)
     - rojo si `asignado > cantReq` (sobreasignado)
   - Aviso por fila si la cantidad excede `oferta.cantidad` del proveedor elegido.

3. **"Tomar mejor precio" / "Asignar mejor precio en todos"**
   - Reescribir para que llene en cascada: empieza por el proveedor con menor PU disponible, toma `min(faltante, oferta.cantidad)`, y si aún falta, agrega el siguiente proveedor más barato hasta cubrir `cantReq` o agotar ofertas.

4. **Resumen por proveedor** y **`generarMut`**
   - Iterar `Object.entries(asignaciones)` y, dentro, cada `Asignacion[]`, sumando por `proveedorId` real (vía `provBySolicitud`). El resto del flujo (`guardarPaquete` por proveedor) no cambia, ya recibe `{ insumo_id, cantidad, precio_unitario }[]`.
   - Contador "X de Y insumos asignados" cuenta insumos con **al menos una** asignación; opcionalmente un segundo contador "Z totalmente cubiertos" para los que llegan exactamente a `cantReq`.

5. **Resaltado en columnas del proveedor**
   - El `ring` de "asignado" se aplica si el `solicitudId` aparece en cualquiera de las asignaciones del insumo.

### Sin cambios

- No se toca el esquema, ni `cotizaciones.functions.ts`, ni `CotizacionSheet.tsx`, ni el servidor. `guardarPaquete` ya acepta múltiples insumos por proveedor; aquí solo cambia cómo el cliente arma esas listas.

### Validaciones

- No permitir cantidades ≤ 0 en una asignación (se omite al generar paquetes).
- Permitir guardar aunque haya insumos parcialmente cubiertos (con aviso visual), igual que hoy.
- No bloquear sobreasignación, solo marcarla en rojo.

## Archivo afectado

- `src/components/requisiciones/ComparativaTable.tsx`
