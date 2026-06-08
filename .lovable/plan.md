# Módulo Tesorería (Corporativo)

Conectar el item ya existente "Tesorería" de la barra lateral (`/app/admin/tesoreria`, visible para director y administrativo) con un módulo real que liste las cuentas de la empresa y permita ver el detalle de saldos y movimientos.

## Backend

Ya existe todo lo necesario en `src/lib/api/cuentas.functions.ts`:

- `listCuentas` — devuelve todas las cuentas de la empresa (activas e inactivas), accesible para director y administrativo.
- `listMovimientos({ cuentaId, from?, to? })` — devuelve movimientos de una cuenta filtrables por rango de fechas.

No se requieren cambios de base de datos ni nuevos endpoints.

## Frontend

### Nuevo componente `src/components/tesoreria/TesoreriaModule.tsx`

Vista única con dos paneles:

1. **Lista de cuentas activas** (panel izquierdo / arriba en móvil)
   - Cards de cuentas con `activa = true`, ordenadas por nombre.
   - Cada card muestra: nombre, tipo (`Bancaria` / `Caja fuerte`), banco + últimos 4 dígitos de la cuenta, saldo actual destacado en MXN, moneda si es distinta a MXN.
   - Toggle/colapsable "Ver cuentas inactivas" para listar también las cerradas (mismo formato, atenuadas).
   - KPI superior: **saldo total** sumando todas las cuentas activas (agrupado por moneda si existe alguna no-MXN; por ahora todas son MXN).
   - Selección de una cuenta abre el detalle.

2. **Detalle de cuenta seleccionada** (panel derecho / Sheet en móvil)
   - Encabezado: nombre, tipo, banco/clabe/numero (enmascarado salvo últimos 4), saldo inicial, saldo actual.
   - Filtros de movimientos: rango de fechas (default últimos 30 días) y tipo (ingreso/egreso/todos).
   - Tabla de movimientos: fecha · concepto · referencia · origen (badge) · ingreso · egreso · saldo corrido.
     - Saldo corrido se calcula en cliente: partir del saldo actual, recorrer los movimientos en orden descendente y revertir cada uno para obtener el saldo de cada renglón.
   - Totales del rango filtrado: ingresos, egresos, neto.
   - Botón "Exportar CSV" del rango filtrado (cliente, sin endpoint nuevo).

### Nueva ruta `src/routes/_authenticated/app.admin.tesoreria.tsx`

Ruta dedicada (más específica gana sobre `app.admin.$`). Carga `TesoreriaModule`. Verifica vía `useEffectiveRoles` que el usuario sea `director` o `administrativo`; si no, redirige a `/app`.

### Read shape

- `cuentasQuery` con `useSuspenseQuery` precargada en el loader vía `ensureQueryData(listCuentasOptions)`.
- `movimientosQuery` por cuenta seleccionada usando `useQuery` (no suspense — el panel ya está montado y solo cambia al elegir cuenta).
- Mutaciones no aplican en este módulo (solo lectura).

### Notificaciones

Ninguna nueva.

## Permisos

- UI: `useEffectiveRoles().includes('director' | 'administrativo')`. El residente y otros roles no ven el item en la barra (ya configurado en `src/lib/modules.ts`) y la ruta los redirige si lo intentan abrir directo.
- Backend: las funciones ya validan rol director/administrativo en `ensureRole`.

## Fuera de alcance

- No se agrega creación/edición de cuentas (sigue viviendo en Configuración → Cuentas).
- No se agregan traspasos entre cuentas, conciliación bancaria, ni ajustes manuales.
- No se cambia el módulo de Cuentas por pagar ni el flujo de pagos de OC.
- No se renombra el item de la barra (sigue como "Tesorería"). Si prefieres que diga "Corporativo" lo cambiamos en una iteración posterior.
