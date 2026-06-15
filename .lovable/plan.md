## Problema

`getOrCreateSemanaAbierta` (en `src/lib/api/almacen.functions.ts`) busca *cualquier* semana abierta de la obra sin importar su fecha. Si nadie pulsa "Cerrar semana", la semana del 7–12 jun se queda abierta indefinidamente aunque ya estemos en una semana posterior.

## Solución: auto-rollover de semanas vencidas

Antes de devolver la semana abierta, comparar `semana_fin` contra hoy. Si la semana ya terminó (hoy > sábado), cerrarla automáticamente y abrir las semanas siguientes hasta llegar a la semana que contiene hoy, trasladando saldos en cada salto. Solo en este flujo automático no se requiere acción del usuario; el cierre manual sigue funcionando igual.

### Cambios en `src/lib/api/almacen.functions.ts`

1. **Nuevo helper `autoCerrarSemanasVencidas(supabase, companyId, obraId)`**:
   - Loop: mientras exista una semana abierta cuya `semana_fin < hoy`:
     - Marcarla `cerrada` con `cerrada_at = now()`, `cerrada_por = null` (cierre automático del sistema).
     - Calcular lunes/sábado siguientes con los helpers existentes `siguienteLunes` / `sabadoDeSemana`.
     - Crear (o reutilizar) la semana siguiente con estatus `abierta`.
     - Trasladar saldos finales (`inv_inicial + recibido − utilizado`) por `(insumo_id, precio_unitario)` a la nueva semana — misma lógica que `cerrarSemana` ya implementa; extraerla a un helper compartido `trasladarSaldos(supabase, semanaOrigenId, semanaDestinoId)` para no duplicar código.
   - Devuelve la semana abierta vigente al final del loop.

2. **`getOrCreateSemanaAbierta`**: al inicio, llamar a `autoCerrarSemanasVencidas` antes de hacer la búsqueda. Si todavía no existe ninguna semana, sigue creando la actual como hoy.

3. **`cerrarSemana`**: refactorizar para usar el mismo helper `trasladarSaldos` (sin cambio funcional).

### No cambia

- `cerrarSemana` sigue disponible para cierre manual anticipado.
- UI: no requiere cambios; al entrar a "Semana actual" se verá ya la semana que contiene hoy y las anteriores aparecerán en "Historial" como cerradas.
- Permisos, cálculos de balance, contabilidad: sin cambios.

### Nota sobre `cerrada_por`

Hoy la columna es nullable (RLS lo permite porque sólo escribimos desde server functions con service-role efectivo vía middleware autenticado). El cierre automático lo dejará en `null` para distinguirlo del cierre manual; si prefieres marcarlo con el usuario que disparó la consulta, lo cambiamos.

## Archivos modificados

- `src/lib/api/almacen.functions.ts`
