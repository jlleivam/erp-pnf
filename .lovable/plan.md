# Badges de pendientes: reactivos y confiables

## Objetivo

1. Que los globos aparezcan (hoy hay datos pendientes en BD pero no se muestran).
2. Eliminar el refetch cada 60s. Los badges se actualizan solo cuando cambian los registros relevantes en la base.

## Diagnóstico

- Ya hay datos que deberían pintar badge (1 requisición enviada, 1 renta solicitada, 1 vale autorizado, etc.).
- `safeCount` traga cualquier error de RLS / query y devuelve 0, así que si algo falla la UI queda muda. Hay que exponer errores en dev y verificar que los `count: "exact", head: true` pasen RLS para cada rol.
- `moduleKeyFromPath` toma solo el último segmento; sirve para admin (`/app/admin/nomina`) y obra (`/app/obras/:id/nomina`). Se conserva.

## Cambios

### 1. Suscripción Realtime en lugar de polling

- Migración: `ALTER PUBLICATION supabase_realtime ADD TABLE` para las tablas fuente de conteos:
  `requisiciones`, `cuentas_por_pagar`, `obra_nominas`, `caja_chica_fondos`, `caja_chica_reembolsos`, `caja_chica_gastos`, `vales_gasolina`, `gastos_oficina`, `obra_rentas`, `ordenes_compra`, `obra_tareas`.
- Nuevo hook `usePendientesRealtime()` montado una sola vez en `AppShell`:
  - Se suscribe con `supabase.channel("pendientes")` a `postgres_changes` (`event: "*"`) de cada tabla.
  - En cada evento hace `queryClient.invalidateQueries({ queryKey: ["pendientes"] })` con un debounce de ~300 ms para agrupar ráfagas.
  - Limpia el canal en el `useEffect` cleanup.
- `usePendientes()`:
  - Quitar `refetchInterval`.
  - `staleTime: Infinity` (la fuente de verdad son los eventos Realtime).
  - Mantener `refetchOnWindowFocus: true` como respaldo por si se pierde un evento.
  - Invalidar también en `supabase.auth.onAuthStateChange` sign-in.

### 2. Que los badges realmente se pinten

- Reemplazar `safeCount` por una versión que en dev haga `console.warn` con la tabla y el error, para detectar fallas silenciosas de RLS.
- Verificar por rol que las queries head-count pasen RLS (residente sobre `ordenes_compra` de su obra, supervisor sobre `caja_chica_*`, admin sobre tablas de company). Ajustar policies faltantes en la misma migración si aparece alguna.
- `PendientesBadge`: subir el z-index y ajustar posición absoluta en:
  - Sidebar (ya renderiza al final del `NavItem`, ok).
  - Bottom bar móvil (badge sobre el icono).
  - Tarjetas de obra en Home (esquina superior derecha).
- Añadir estado inicial: en el primer render `usePendientes()` devuelve `undefined`; asegurar que `usePendientesAdmin/Obra` devuelvan `{}` (ya lo hacen) y que ningún consumidor rompa cuando aún no hay datos.

### 3. Ampliar cobertura de conteos que faltan

Revisar y añadir los que hoy no cuentan pero sí son "acción pendiente":

- Obra:
  - `presupuesto`: presupuestos en estatus `solicitada` (residente) o `borrador` propio.
  - `estimaciones`: estimaciones en `borrador` del residente.
  - `nomina` (obra): nóminas en `borrador` del residente / `cerrada` sin pagar para admin.
  - `destajos` y `subcontratos`: documentos `enviado` pendientes de autorizar.
- Admin:
  - `condensado-semanal`: sin conteo (informativo).
  - `contabilidad` / `tesoreria`: sin conteo.

## Archivos afectados

- `src/lib/api/pendientes.functions.ts` — añadir conteos faltantes y logging de errores.
- `src/hooks/usePendientes.ts` — quitar polling, exponer `usePendientesRealtime`.
- `src/components/AppShell.tsx` — montar `usePendientesRealtime()` una vez.
- `src/components/PendientesBadge.tsx` — z-index y tamaños.
- Migración SQL — `ALTER PUBLICATION supabase_realtime ADD TABLE ...` para las 11 tablas.

## Notas técnicas

- Realtime respeta RLS: cada usuario solo recibe eventos de filas que puede leer, así que el canal global no filtra data ajena.
- El debounce evita invalidar 5 veces cuando se guardan varias filas seguidas (ej. una nómina completa).
- No se agregan tablas de catálogos (`terceros`, `clientes`, `trabajadores`) a Realtime; no alimentan badges.
