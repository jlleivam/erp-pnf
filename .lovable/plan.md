## Objetivo
Cuando el supervisor/director hace clic en una notificación de caja chica, el módulo debe abrirse en la pestaña correcta: **Fondos** si fue solicitud de fondo, **Reembolsos** si fue solicitud de reembolso.

## Cambios

### 1. `src/lib/api/caja-chica.functions.ts`
Agregar query param `?tab=` al `link` de las notificaciones:
- `solicitarFondoCajaChica` (línea 265): `link: /app/obras/{obraId}/caja-chica?tab=fondos`
- `solicitarReembolso` (cerca de línea 755): `link: /app/obras/{obraId}/caja-chica?tab=reembolsos`
- Aplicar lo mismo a las notificaciones de autorización (`caja_chica_fondo_autorizado`, `caja_chica_reembolso_autorizado`) para que también aterricen en la pestaña correcta.

### 2. `src/components/caja-chica/CajaChicaModule.tsx`
Leer el query param `tab` de la URL con `useSearch` de TanStack Router (o `window.location.search` como fallback si la ruta no declara search schema) y usarlo como valor inicial de `useState<string>(tab)`:
- Si `?tab=fondos` → estado inicial `"fondos"`.
- Si `?tab=reembolsos` → `"reembolsos"`.
- En otro caso, mantener la lógica actual (`"mis-gastos"` para residente, `"reembolsos"` para admin).
- Validar que la pestaña exista para el rol actual (p. ej. no forzar `"asignaciones"` si no aplica).

No se cambia el layout ni la UI de las pestañas; sólo se añade la selección inicial derivada del link de la notificación.
