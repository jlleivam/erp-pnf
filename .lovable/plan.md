# Plan para arreglarlo de otra manera

## Objetivo
Dejar de depender de las solicitudes `recibida` como base de la pestaña **Comparativa** y reconstruir la vista desde los datos persistidos que ya existen en backend: **paquetes** y **OCs**.

## Qué voy a cambiar

1. **Cambiar la fuente de verdad de Comparativa**
   - La vista ya no se basará primero en `solicitudes` para mostrar tarjetas y asignaciones.
   - La base será `paquetes` + `ocs`, porque eso sí permanece cuando cierras y vuelves a abrir.

2. **Separar dos modos dentro de Comparativa**
   - **Modo edición**: cuando sí existen cotizaciones recibidas, se mostrará la matriz editable.
   - **Modo persistido / solo lectura**: cuando ya no existan solicitudes utilizables, se mostrarán las tarjetas y asignaciones guardadas a partir de paquetes y OCs.

3. **Rehacer la hidratación de asignaciones**
   - Hoy la hidratación depende de mapear proveedor ↔ solicitud.
   - La voy a reemplazar por una reconstrucción directa desde `cotizacion_paquetes.items`, para que las líneas sigan apareciendo aunque no haya `solicitudes` activas.

4. **Blindar la carga del sheet**
   - `CotizacionSheet` distinguirá claramente entre:
     - datos de cotización cargando,
     - solicitudes cargando,
     - solicitudes vacías.
   - Así Comparativa no recibirá “vacío” como si fuera estado final cuando todavía no termina una consulta.

5. **Mantener bloqueo y estatus desde OCs**
   - Los badges, bloqueos de edición y acciones seguirán saliendo del estado real de la OC.
   - Si existe OC pendiente/autorizada, la tarjeta quedará bloqueada aunque ya no exista la solicitud original.

## Resultado esperado
- Al salir y volver a la pestaña, **las tarjetas seguirán visibles**.
- Las **asignaciones guardadas no desaparecerán**.
- La tabla comparativa editable solo aparecerá cuando de verdad haya cotizaciones recibidas para editar.
- Si ya solo quedan paquetes/OCs persistidos, la pestaña seguirá mostrando el trabajo guardado en modo estable.

## Archivos a tocar
- `src/components/requisiciones/ComparativaTable.tsx`
- `src/components/requisiciones/CotizacionSheet.tsx`

## Detalles técnicos
- El problema actual es de **doble fuente de verdad**: la UI mezcla estado derivado de `solicitudes` con datos persistidos (`paquetes`, `ocs`).
- La corrección será dejar a `paquetes/ocs` como fuente canónica para reconstrucción visual y usar `solicitudes` solo para la parte editable de comparación de ofertas.
- Evitaré seguir “hidratando” la vista desde un conjunto transitorio que puede llegar vacío o cambiar de orden.

## Validación
- Abrir requisición con paquetes/OCs ya creados.
- Entrar a **Comparativa** después de cerrar/reabrir el sheet.
- Confirmar que reaparecen tarjetas, líneas, totales y bloqueos.
- Confirmar que no se rompe SSR ni deja pantalla en blanco.