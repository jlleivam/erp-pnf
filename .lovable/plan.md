## Objetivo
Mostrar hora además de fecha en cada notificación del dropdown de la campana.

## Cambio
En `src/components/NotificacionesBell.tsx` (línea 90), reemplazar `formatDate(n.created_at)` por `formatDateTime(n.created_at)` y ajustar el import para usar `formatDateTime` desde `@/lib/format` (ya existe ese helper).

Resultado visual: "25 jul 2026, 14:32" en lugar de "25 jul 2026".