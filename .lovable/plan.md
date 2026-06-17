## Diagnóstico

El reembolso `CC-2026-0001` quedó a nombre de Pedro Velazquez porque en `solicitarReembolsoCajaChica` (y `crearGastoCajaChica`) la autorización es demasiado laxa:

- `crearGastoCajaChica` (línea 540-541): permite **residente o director**.
- `solicitarReembolsoCajaChica` (línea 700-701): permite **cualquier miembro del obra_team o director**.
- En ambos casos se guarda `residente_id = userId` (el caller), no el residente real de la obra.

Pedro (administrativo) es miembro del `obra_team` de esa obra, así que pasó la validación del reembolso y quedó registrado como "residente" del movimiento.

Caja chica es un fondo personal del residente. Administrativo, supervisor y director no deben capturar gastos ni solicitar reembolsos en su nombre.

## Cambios

**1. `src/lib/api/caja-chica.functions.ts` — endurecer permisos**

- `crearGastoCajaChica`: exigir `isResidenteDeObra(userId, obraId)`. Quitar el bypass de director. Mensaje: "Solo el residente de la obra puede registrar gastos de caja chica".
- `actualizarGastoCajaChica` / `eliminarGastoCajaChica`: ya validan `g.residente_id !== userId`; añadir además `isResidenteDeObra` para que un ex-residente no pueda editar.
- `solicitarReembolsoCajaChica`: exigir `isResidenteDeObra`. Quitar el bypass de director y la rama `isMemberObra`. La validación `g.residente_id !== userId` se mantiene.
- Revisar otras funciones del archivo por consistencia (sin cambiar permisos donde sí corresponde admin/supervisor: revisar, aprobar, reponer).

**2. UI — ocultar acciones para no-residentes**

- `src/components/caja-chica/CajaChicaModule.tsx` y diálogos relacionados (`NuevoGastoDialog`, `SolicitarReembolsoDialog`): mostrar los botones de "Nuevo gasto" y "Solicitar reembolso" solo cuando el usuario es el residente de la obra. Para los demás roles, dejar visible el listado en modo lectura.

**3. Limpieza del dato existente (decisión del usuario)**

El reembolso `CC-2026-0001` y sus 2 gastos quedaron con `residente_id` incorrecto. Dos opciones, **a confirmar antes de implementar**:

- **(A)** Borrar `CC-2026-0001` y sus gastos para que Arturo lo recapture correctamente. Implica revertir el pago de reposición (si ya afectó cuentas) — no recomendado si ya hubo movimiento bancario real.
- **(B)** Migración puntual de datos: `UPDATE` para reasignar `residente_id` de esos gastos y del reembolso al residente actual de la obra (Arturo). El asiento contable y el monto del reembolso quedan intactos; solo cambia el "dueño" del registro.

Recomiendo **(B)** porque el dinero ya se movió y los montos son correctos; solo está mal atribuido el residente.

## Fuera de alcance

- No modificamos la lógica de balance ni la cuenta 1120: una vez corregido el `residente_id`, el descuento por residente que ya añadimos cuadra automáticamente.
- No cambiamos roles ni `obra_team`.

## Pregunta para confirmar

¿Vamos con la opción **(B)** (reasignar `residente_id` del reembolso y gastos existentes al residente actual de la obra) o prefieres **(A)** (borrar y recapturar)?
