## Objetivo
Corregir el error al abrir requisiciones desde perfiles asumidos (administrativo/residente) y dejar el cambio de vista estable en toda la app.

## Qué voy a implementar
1. Centralizar el cálculo del rol/permisos efectivos en el store de auth para que no genere referencias nuevas en cada render.
2. Reemplazar los usos todavía inconsistentes de `roles`, `assumedRole`, `isDirector` y `effectiveRoles` por helpers estables en todas las rutas y módulos afectados.
3. Revisar específicamente las dos rutas de requisiciones:
   - `/app/obras/:obraId/requisiciones`
   - `/app/admin/requisiciones`
4. Unificar el gating de navegación y permisos para que cada vista asumida solo vea y ejecute lo permitido por ese perfil.
5. Validar que al cambiar de vista siempre puedas entrar al dashboard y luego navegar sin disparar el loop de render.

## Archivos a tocar
- `src/stores/auth.ts`
- `src/components/AppShell.tsx`
- `src/routes/_authenticated/app.index.tsx`
- `src/routes/_authenticated/app.equipo.tsx`
- `src/routes/_authenticated/app.obras.nueva.tsx`
- `src/routes/_authenticated/app.obras.$obraId.$.tsx`
- `src/routes/_authenticated/app.admin.requisiciones.tsx`
- módulos que consumen permisos efectivos (`requisiciones`, `insumos`, `clientes`, `terceros`, `trabajadores`)

## Enfoque técnico
- Crear/usar selectores estables para:
  - `effectiveRoles`
  - `effectiveRole`
  - `effectiveIsDirector`
- Evitar derivaciones inline que devuelvan arrays/objetos nuevos desde Zustand.
- Donde hoy se mezclan `roles reales` y `roles asumidos`, dejar una sola fuente de verdad para el gating.
- Mantener visible el selector de vista solo para director real, pero hacer que el resto de la UI se comporte únicamente con el perfil asumido.

## Validación
- Cambiar entre Director / Administrativo / Residente.
- Confirmar redirección al dashboard al cambiar vista.
- Abrir requisiciones desde obra y desde administración sin error.
- Verificar que menú, acciones y botones coincidan con el perfil asumido.
- Confirmar que no reaparece `Maximum update depth exceeded`.

## Resultado esperado
La app dejará de romperse al abrir requisiciones desde cualquier vista asumida y los permisos quedarán aplicados de forma consistente en todos lados.