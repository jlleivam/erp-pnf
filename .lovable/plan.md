## Objetivo

Mostrar un globo (badge) con el número de pendientes de acción que corresponden al usuario según su rol, sobre cada módulo, en:

1. Sidebar de obra (módulos dentro de `/app/obras/:obraId/*`)
2. Sidebar de administración (`/app/admin/*`)
3. Bottom bar móvil (mismos badges replicados)
4. Tarjetas de obra en Home (`/app/`) — un contador total de pendientes de esa obra para el usuario

## Qué cuenta como "pendiente de acción" por rol

Los conteos son por rol efectivo del usuario y, en obra, filtrados por esa obra.

| Módulo | Rol que lo ve pendiente | Regla |
|---|---|---|
| Requisiciones (obra) | residente/auxiliar | requisiciones en `borrador` propias + rechazadas por corregir |
| Requisiciones (admin) | administrativo/director | `enviada` sin cotización + `pendiente_autorizacion` |
| Requisiciones (supervisor) | supervisor | `pendiente_autorizacion` en sus obras |
| Almacén (obra) | residente/auxiliar | OC `autorizada`/`enviada` pendientes de recepción + semana abierta con capturas faltantes |
| Nómina (obra) | residente | nómina de la semana en `borrador` sin cerrar |
| Nómina (admin/CxP) | administrativo | semanas `cerrada` sin `pagada` |
| Destajos (obra) | residente | estimaciones en `borrador` + destajos con anticipo `enviado` |
| Destajos (admin) | administrativo | anticipos y estimaciones `enviado`/`cerrada` por autorizar/pagar |
| Subcontratos | análogo a destajos | |
| Rentas (obra) | residente | rentas en `borrador` y renovaciones `pendiente` |
| Rentas (admin) | administrativo | `solicitada` por cotizar + `autorizada` sin activar |
| Gasolinas (obra) | residente | vales `entregado` sin confirmar |
| Gasolinas (admin) | administrativo | `pendiente_autorizacion` + `autorizado` sin entrega |
| Caja chica (obra) | residente | fondos `pendiente_autorizacion`, gastos `rechazado`, reembolsos `rechazado` |
| Caja chica (supervisor) | supervisor | fondos y reembolsos por revisar en sus obras |
| Caja chica (admin/CxP) | administrativo | fondos `autorizado` + reembolsos `enviado_admin` |
| CxP (admin) | administrativo | CxP `pendiente`/`parcial` |
| Tesorería (admin) | administrativo/director | pagos/movimientos por conciliar (si aplica) |
| Gastos de oficina | administrativo/director | `pendiente_aprobacion` |
| Tareas | asignado | tareas asignadas al usuario abiertas |
| Presupuestos / Estimaciones (obra) | residente | estimaciones en `borrador`; presupuestos `solicitada` (para director/admin en su vista) |

## Diseño técnico

### 1. Un único endpoint agregador

Nuevo `src/lib/api/pendientes.functions.ts`:

- `getPendientesGlobales()` — con `requireSupabaseAuth`, devuelve `{ admin: Record<modulo, number>, obras: Record<obraId, Record<modulo, number>> }`.
- Internamente, para cada categoría hace `select("id", { count: "exact", head: true })` con los filtros de estatus y RLS del usuario. Un único server fn evita N llamadas desde el cliente.
- Sin cambios de esquema.

Ejemplo de shape:

```text
{
  admin: {
    requisiciones: 3, cxp: 5, nomina: 1, caja_chica: 2,
    gasolinas: 0, destajos: 0, subcontratos: 0, rentas: 1,
    gastos_oficina: 0, tareas: 4
  },
  obras: {
    "<obraId>": {
      requisiciones: 2, almacen: 1, nomina: 0, destajos: 0,
      subcontratos: 0, rentas: 0, gasolinas: 0, caja_chica: 1,
      tareas: 2
    }
  }
}
```

### 2. Hook cliente

`src/hooks/usePendientes.ts`:

- `useQuery({ queryKey: ["pendientes"], queryFn: fetchPendientes, refetchInterval: 60_000 })`.
- Exporta helpers: `usePendientesAdmin()`, `usePendientesObra(obraId)`, `useTotalPendientesObra(obraId)`.
- Se invalida en `onSuccess` de mutaciones existentes (patrón: agregar `qc.invalidateQueries({ queryKey: ["pendientes"] })` en los flujos más impactantes: autorizar, cotizar, pagar, cerrar semana). Como fallback está el `refetchInterval`.

### 3. Componente `<PendientesBadge count={n} />`

- Reutilizable, mismo estilo que la campana: círculo rosa/rojo, texto `9+` cuando `count > 9`, oculto si `count === 0`.
- Colocación: posicionado sobre el ícono (top-right absolute) tanto en sidebar/desktop como en botones de bottom bar y tarjetas.

### 4. Puntos de integración

- `src/components/AppShell.tsx` — sidebar admin: leer `usePendientesAdmin()` y mapear por `to` de `ADMIN_MODULES` en `src/lib/modules.ts` (agregar una `key` por entrada, ej. `key: "requisiciones"`).
- `src/components/AppShell.tsx` — sidebar de obra (cuando la ruta actual es una obra): usar `usePendientesObra(obraId)`.
- `src/components/MobileBottomBar.tsx` — mismo mapeo por key sobre los botones visibles.
- `src/routes/_authenticated/app.index.tsx` — sobre cada tarjeta de obra, mostrar `useTotalPendientesObra(o.id)` como badge en la esquina superior derecha.

### 5. Rendimiento y visibilidad

- Un solo query global refrescado cada 60s. El payload es pequeño (números).
- Directores no ven "pendientes" que no les toquen (p. ej. no cuentan borradores de residentes) para evitar ruido.
- Si `count === 0`, no se renderiza nada.

## Cambios de archivos

Nuevos:
- `src/lib/api/pendientes.functions.ts`
- `src/hooks/usePendientes.ts`
- `src/components/PendientesBadge.tsx`

Modificados:
- `src/lib/modules.ts` — agregar `key` a cada `ModuleEntry` (mapea al conteo).
- `src/components/AppShell.tsx` — render de badge en sidebar admin y sidebar de obra.
- `src/components/MobileBottomBar.tsx` — render de badge en botones.
- `src/routes/_authenticated/app.index.tsx` — badge total en tarjetas de obra.
- Invalidaciones en handlers clave de mutaciones (requisiciones, caja chica, rentas, nómina, CxP, gasolinas) — solo agregar `queryClient.invalidateQueries({ queryKey: ["pendientes"] })`.

## Fuera de alcance

- No se cambia el esquema de BD.
- No se agregan notificaciones nuevas; se cuentan estados reales.
- No se añade filtro/ordenamiento en los módulos por "pendientes"; solo el indicador visual.
