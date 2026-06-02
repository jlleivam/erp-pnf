## Objetivo

En el almacén, cuando un mismo insumo entra a precios distintos, cada precio debe aparecer como **un renglón independiente (lote)** dentro de la semana. El residente captura el "utilizado" por lote, y al cerrar la semana cada lote (con su precio original) se traslada como inventario inicial a la siguiente semana.

---

## Cambios

### 1. Base de datos (migración)

Hoy `almacen_movimientos_semana` se trata como único por `(semana_id, insumo_id)` (el código hace `.maybeSingle()` al actualizar la recepción). Para soportar lotes:

- Si existe un índice/constraint único en `(semana_id, insumo_id)`, **eliminarlo**.
- Agregar un índice no único `(semana_id, insumo_id, precio_unitario)` para acelerar el lookup de lote por precio.
- Conservar todas las columnas actuales (sigue siendo un renglón por lote: mismo insumo + mismo precio se siguen consolidando en un solo renglón).

No se borran datos existentes — los renglones actuales pasan a representar el lote "histórico" de cada insumo.

### 2. Recepción (`src/lib/api/almacen.functions.ts` → `registrarRecepcion`)

Cambiar la lógica de actualización de movimientos:
- En lugar de buscar `(semana_id, insumo_id)`, buscar `(semana_id, insumo_id, precio_unitario)`.
- Si existe el lote → sumar la cantidad a `recibido`.
- Si no existe → insertar un nuevo renglón con ese precio.
- Nunca sobrescribir `precio_unitario` de un renglón existente.

### 3. Siembra de inventario inicial al abrir nueva semana (`getOrCreateSemanaAbierta`)

Hoy traslada el saldo agrupado por `insumo_id`. Cambiar para trasladar **un renglón por lote** `(insumo_id, precio_unitario)` de la semana cerrada anterior, copiando el `precio_unitario` tal cual. Cada lote con saldo final ≠ 0 se convierte en una fila de inventario inicial en la nueva semana.

### 4. Captura del "utilizado" (`actualizarUtilizado`)

Sin cambios en la firma: ya opera por `movimientoId`, así que cada lote se captura por separado de forma natural. El residente decide cuánto consume de cada lote (no se aplica PEPS/UEPS automático).

### 5. UI — Semana actual (`SemanaActualPanel.tsx`)

- La tabla ya itera `items` y muestra `precio_unitario` por renglón, así que **funciona sin cambios estructurales**.
- Ajuste menor: ordenar primero por nombre de insumo y luego por `precio_unitario` ascendente, para que los lotes del mismo insumo aparezcan juntos.
- (Opcional) Mostrar el nombre del insumo solo en el primer lote y dejar las filas siguientes con sangría, para que se lea como "agrupación por insumo". Si esto complica el código, se deja igual y se distinguen por la columna PU.

### 6. UI — Historial (`AlmacenModule.tsx > SemanaReadOnly`)

Misma tabla, mismo orden por insumo + precio. No requiere cambios funcionales.

### 7. Dialog de recepción (`RecepcionDialog.tsx`)

No requiere cambios. Sigue capturando cantidad y precio por insumo de la OC; el backend ya decide a qué lote suma.

---

## Detalles técnicos

- **Tabla afectada**: `public.almacen_movimientos_semana`.
- **Comparación de precios**: usar igualdad exacta de `numeric` (mismo precio capturado en la OC → mismo lote). No hay redondeo silencioso.
- **Inv. final por lote** = `inv_inicial + recibido - utilizado` (ya está así, se mantiene).
- **Valor recibido / utilizado** del pie de tabla: la suma ya pondera por `precio_unitario` de cada renglón, así que con lotes queda automáticamente correcto.
- **Datos existentes**: las semanas ya cerradas no se tocan. Las semanas abiertas conservan sus renglones consolidados; los próximos ingresos a distinto precio abrirán nuevos lotes a partir de la siguiente recepción.

---

## Fuera de alcance

- Lógica automática PEPS/UEPS para repartir el consumo entre lotes.
- Reportes nuevos de valuación de inventario.
- Edición o fusión manual de lotes.
