# Persistir "Vista asumida" del Director

## Problema

Cuando un Director cambia su vista a "Residente" en el Dashboard y entra a una obra, la vista vuelve a "Director". Causa: `assumedRole` vive en un store Zustand sin persistencia. Al entrar a la obra (especialmente si hay rehidratación de sesión o recarga del shell), el estado se reinicia a `null`, lo que equivale a Director.

## Objetivo

Mantener el rol asumido por el Director de forma consistente en toda la app (dashboard, obras, catálogos, etc.) hasta que el propio Director lo cambie manualmente o cierre sesión.

## Cambios

### 1. `src/stores/auth.ts` — persistir `assumedRole`

- Envolver el store con el middleware `persist` de Zustand.
- Persistir **solo** `assumedRole` en `localStorage` bajo la clave `erp-pnf:assumed-role` (no persistir `userId`, `profile`, `roles` ni `loading`, que deben revalidarse contra el backend).
- Mantener el reset explícito de `assumedRole` dentro de `reset()` (logout) para que cerrar sesión limpie la preferencia.

### 2. Validación al hidratar la sesión

En `src/routes/__root.tsx` (`AuthSync`), tras obtener `ctx.roles`:
- Si el usuario rehidratado **no** es director, forzar `setAssumedRole(null)` para evitar que un rol asumido obsoleto afecte a un usuario que ya no es director (cambio de cuenta en el mismo navegador, revocación de rol, etc.).

### 3. Sin cambios de UI

No se toca `AppShell`, `ObraShell` ni los módulos. La selección sigue siendo el mismo dropdown de "Vista" en el header del shell corporativo; ahora simplemente se respeta de forma consistente.

## Resultado esperado

- Director elige "Vista: Residente" → entra a una obra → sigue viendo la app como Residente.
- Recarga la página → sigue como Residente.
- Cambia manualmente a "Director (mi rol)" → vuelve a Director.
- Cierra sesión → la preferencia se limpia.
