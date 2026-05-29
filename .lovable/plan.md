## Contexto

Ya existe el flujo: **Solicitudes → Comparativa → Paquetes → OCs**. Hoy la Comparativa es solo lectura; el administrativo tiene que ir a la pestaña Paquetes y recapturar manualmente qué insumo va con qué proveedor y a qué precio. Eso duplica trabajo y desperdicia la información ya cotizada.

## Objetivo

Permitir que desde la **Comparativa** el administrativo asigne, por insumo, **qué proveedor lo va a surtir y con qué cantidad**, y que de un solo clic se generen/actualicen los paquetes por proveedor con los precios ya cotizados. Luego sigue el flujo normal en la pestaña Paquetes → Generar OC → enviar al supervisor.

## Cambios

### 1. `ComparativaTable.tsx` — agregar columna de asignación

En la fila de cada insumo, sumar al final una columna **"Asignar a"** con:
- Un `Select` con los proveedores que cotizaron ese insumo (label: `Proveedor — $PU`), opción "— Sin asignar".
- Un `Input` de **cantidad a comprar**, que por defecto toma la cantidad cotizada del proveedor seleccionado (acotada a la requerida). El admin puede editarla — útil cuando un proveedor solo cubre parcial y el resto se asigna a otro.
- Resaltar visualmente el proveedor sugerido = el de menor PU disponible (botón rápido "Tomar mejor precio").

Estado local: `Map<insumoId, { proveedorId: string; cantidad: number }>` en el componente. Se inicializa vacío.

Footer adicional con resumen por proveedor:
- Para cada proveedor con asignaciones: `N insumos · Total $X`.
- Indicador global: `X de Y insumos asignados`.

### 2. Botón **"Generar paquetes con esta asignación"** al pie de la comparativa

Habilitado cuando hay al menos un insumo asignado. Al hacer clic:
- Agrupa las asignaciones por `proveedorId`.
- Por cada grupo llama a `guardarPaquete` (ya existe) con:
  - `requisicionId`
  - `proveedorId`
  - `insumos`: `[{ insumo_id, cantidad: <asignada>, precio_unitario: <cotizado por ese proveedor> }]`
  - `paqueteId`: si ya existe un paquete para ese proveedor en esta requisición sin OC enviada, se reusa; si no, se crea.
- Muestra toast con el resumen y cambia a la pestaña **Paquetes** (`setTab("paquetes")` vía prop).
- Invalida `["cotizacion", requisicionId]` para que los paquetes aparezcan hidratados.

### 3. Nueva prop opcional en `ComparativaTable`

```ts
interface Props {
  reqItems: any[];
  solicitudes: any[];
  requisicionId: string;
  onAsignacionGenerada?: () => void; // para que CotizacionSheet salte a "paquetes"
}
```

`CotizacionSheet` pasa `requisicionId` y `onAsignacionGenerada={() => setTab("paquetes")}`.

### 4. Validaciones

- No permitir asignar a un proveedor que marcó el insumo como no disponible.
- No permitir cantidad ≤ 0.
- Si la cantidad asignada > requerida o > cotizada por el proveedor, mostrar warning ámbar pero permitir guardar.
- Si un paquete del proveedor ya tiene una OC `pendiente_autorizacion`/`autorizada`/`pagada`, esa asignación se omite y se avisa al usuario por toast.

### 5. Sin cambios de schema ni de server functions

`guardarPaquete` ya acepta exactamente la forma necesaria. Toda la lógica nueva es de UI + orquestación cliente.

### Resultado para el usuario

1. Captura respuestas → ve Comparativa.
2. En Comparativa elige por insumo el proveedor y la cantidad (con sugerencia de mejor precio).
3. Un clic → se generan los paquetes por proveedor ya con precios.
4. Va a pestaña Paquetes solo para revisar y darle "Generar OC" por cada uno → envía al supervisor.
