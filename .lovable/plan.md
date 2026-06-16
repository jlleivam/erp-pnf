## Contexto

La pestaña **Cuentas por pagar → Caja chica** sólo está listando un tipo de pasivo:

- ✅ Muestra: `cuentas_por_pagar` con `origen_tipo = caja_chica_fondo` (solicitudes de **fondo** autorizadas pendientes de entregar al residente).
- ❌ No muestra: `caja_chica_reembolsos` con `estatus = enviado_admin` (reembolsos semanales aprobados por el supervisor que el administrativo debe reponer al residente).

Ambos son pasivos reales: en el balance el reembolso ya cuenta como **2160 Caja chica por reembolsar**, pero el administrativo no lo ve en su bandeja de "por pagar". Por eso el usuario dice "está autorizado y no me aparece".

## Cambios

### 1. Backend — extender `listCxPCajaChicaFondoPendientes`

Renombrar el endpoint a `listCajaChicaPorPagar` (manteniendo un alias exportado con el nombre viejo para no romper otros lugares) y devolver **dos colecciones**:

```ts
{
  fondos: [...filas actuales con tipo: "fondo"...],
  reembolsos: [
    {
      tipo: "reembolso",
      id: reembolso.id,
      folio: reembolso.folio,
      fecha_emision: reembolso.enviado_admin_at ?? created_at,
      obra_id, obra_nombre,
      beneficiario_id: residente_id,
      beneficiario_nombre: residente_nombre,
      concepto: `Reembolso semana ${semana_inicio}–${semana_fin}`,
      monto_total: monto_aprobado,
      monto_pagado: 0,
      saldo: monto_aprobado,
      estatus: "enviado_admin",
    }
  ]
}
```

Los reembolsos se obtienen de `caja_chica_reembolsos` con `estatus = 'enviado_admin'` filtrados por `company_id`, enriqueciendo `obra.nombre` y `residente.nombre`.

### 2. Frontend — `CajaChicaPorPagarTab`

- Unir las dos listas en una sola tabla y agregar columna **Tipo** con badge: `Fondo` / `Reembolso`.
- Buscar funciona contra folio / obra / residente (igual que hoy).
- El **Saldo total** suma ambos.
- Botón "Registrar pago":
  - **Fondo** → abre el `RegistrarPagoCxPDialog` actual (sin cambios).
  - **Reembolso** → abre el `ReponerReembolsoDialog` ya existente (recibe el objeto reembolso). El dialog se reutiliza tal cual: ya invalida queries y notifica al residente.
- `onSaved` invalida `["caja-chica-por-pagar"]`, `["balance"]` y `["caja-chica"]` (igual que hoy).
- El badge de cantidad arriba del tab (`Caja chica`) debe reflejar la suma fondos + reembolsos.

### 3. Sin cambios en

- El cálculo del balance (`2160` ya consideraba `enviado_admin`).
- La lógica del flujo de aprobación (residente solicita → supervisor cierra → ya queda en `enviado_admin`).
- Ningún cambio de base de datos.

## Resultado

Cuando el supervisor envía el reembolso al administrativo, éste lo ve inmediatamente en su pestaña **Cuentas por pagar → Caja chica** junto con los fondos pendientes, y puede pagarlo desde ahí con el mismo flujo (preselección de caja fuerte + efectivo).
