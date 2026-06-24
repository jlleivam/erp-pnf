## Módulo: Condensado semanal de gastos

Nuevo módulo administrativo (solo director / administrativo) para revisar todos los gastos de la semana —tanto devengados como pagados— de todas las obras activas y de oficina, agrupados por obra con detalle expandible.

### Ubicación y acceso
- Nueva entrada en el sidebar admin de `AppShell.tsx`: **"Condensado semanal"** (ícono `CalendarRange`), debajo de Contabilidad.
- Ruta servida por `app.admin.$.tsx` con slug `condensado-semanal` → nuevo componente `CondensadoSemanalModule`.
- Visible solo si el rol es `director` o `administrativo` (mismo gate que Tesorería/Contabilidad).

### Selector de semana
- Header con: `‹ Semana 23 · 1 Jun – 7 Jun 2026 ›` y botón "Hoy".
- Semana **lunes a domingo**. Default: semana en curso.
- Las flechas navegan ±1 semana. La semana queda en search params (`?semana=2026-06-01`) para que el enlace sea compartible.

### Datos consolidados

Dos métricas paralelas por cada fila:
- **Devengado**: gasto generado dentro de la semana, sin importar si se pagó. Fuente: fecha de creación del concepto (CxP, nómina, vale, gasto oficina, etc.).
- **Pagado**: salidas reales de tesorería con `fecha_pago` dentro de la semana. Fuente: tabla `pagos`.

Fuentes incluidas (todas filtradas a la semana seleccionada y company actual):

| Concepto | Devengado (fecha) | Pagado (vía) |
|---|---|---|
| Nómina obra | `obra_nominas.fecha_pago` (semana) | `pagos` vinculado a CxP de nómina |
| Nómina oficina | `gastos_oficina.fecha_gasto` (tipo=nomina_oficina) | `pagos` → CxP `origen_tipo='gasto_oficina'` |
| Destajos (anticipos + estimaciones) | `obra_destajo_anticipos.fecha` / estimaciones | `pagos` → CxP origen destajo |
| Subcontratos | `obra_subcontrato_anticipos.fecha` / estimaciones | `pagos` → CxP origen subcontrato |
| Insumos / CxP proveedor | `cuentas_por_pagar.fecha_emision` (origen=requisicion u OC) | `pagos` correspondientes |
| Rentas | `obra_renta_pagos.periodo_fin` (devengo) | `pagos` → CxP `origen_tipo='renta_periodo'` |
| Gasolinas | `vales_gasolina.fecha` | `pagos` correspondientes |
| Caja chica | `caja_chica_gastos.fecha` (estatus aprobado) | `pagos` de reembolsos CC en la semana |
| Otros gastos oficina | `gastos_oficina.fecha_gasto` (tipo≠nomina) | `pagos` → CxP `origen_tipo='gasto_oficina'` |

> **Estrategia técnica:** una sola server function `getCondensadoSemanal({ semanaInicio })` que aprovecha que casi todo pasa por `cuentas_por_pagar` (con `origen_tipo`) y `pagos`. Solo se consultan tablas-fuente adicionales para conceptos que no generan CxP (ej. caja chica gastos no reembolsados aún). Esto evita 9 queries y mantiene una sola fuente de verdad. Buckets de concepto se derivan de `origen_tipo` y `obra_id IS NULL` (= oficina).

### Vista principal — lista detallada agrupada por obra

```
┌──────────────────────────────────────────────────────────────────┐
│ Total semana   Devengado: $1,245,300   Pagado: $987,150          │
│                Pendiente de pago: $258,150                       │
├──────────────────────────────────────────────────────────────────┤
│ Filtros: [Todos los conceptos ▾]  [Solo con saldo pendiente ☐]   │
└──────────────────────────────────────────────────────────────────┘

▾ Obra: Torre Lomas                      Deveng. $420k   Pagado $380k
   ├ Nómina semanal              $180,000 deveng / $180,000 pagado
   ├ Destajos                    $120,000 deveng /  $90,000 pagado
   ├ Insumos (CxP)               $ 80,000 deveng /  $80,000 pagado
   └ Rentas                      $ 40,000 deveng /  $30,000 pagado
   [Ver detalle ▾]  ← expande filas individuales con folio, proveedor,
                      concepto, monto deveng, monto pagado, link al doc.

▾ Obra: Casa Polanco                     Deveng. $310k   Pagado $260k
   ...

▾ Oficina (sin obra)                     Deveng. $215k   Pagado $190k
   ├ Nómina oficina              $ 95,000 / $ 95,000
   ├ Servicios (luz, agua…)      $ 45,000 / $ 30,000
   ├ Papelería                   $ 20,000 / $ 20,000
   └ Otros                       $ 55,000 / $ 45,000
   [Ver detalle ▾]
```

- Cabecera con 3 KPIs (devengado, pagado, pendiente).
- Una **sección colapsable por obra activa** (`obras.estatus='activa'`) que tuvo movimiento + una sección final **"Oficina"** para `obra_id IS NULL`.
- Dentro de cada sección: subtotal por concepto, y un botón "Ver detalle" que despliega la tabla de gastos individuales (folio, fecha, beneficiario, concepto, devengado, pagado, link al CxP / pago / vale).
- Obras sin movimiento en la semana se ocultan (toggle "Mostrar obras sin gastos").
- Cada folio enlaza a su módulo original (CxP → `/app/admin/cuentas-por-pagar?folio=...`, vale → módulo gasolinas, etc.).

### Detalles técnicos

- **Backend** (`src/lib/api/condensado-semanal.functions.ts`):
  - `getCondensadoSemanal` protegido con `requireSupabaseAuth` + verificación de rol `director|administrativo` vía `has_role`.
  - Input: `{ semanaInicio: string (YYYY-MM-DD lunes) }`.
  - Output: `{ semana: {inicio, fin}, totales: {devengado, pagado, pendiente}, obras: [{obra_id, nombre, conceptos: [{tipo, label, devengado, pagado, items: [...]}]}], oficina: {...} }`.
  - Una query a CxP con join a obras y pagos agregados; consulta auxiliar a caja_chica_gastos para gastos aprobados aún sin reembolso emitido.
- **Frontend** (`src/components/condensado-semanal/CondensadoSemanalModule.tsx`):
  - Header con selector de semana (botones `‹ ›` + label) y KPIs.
  - `Accordion` de shadcn por obra; dentro, tabla compacta con patrón `TruncatedCell`.
  - Filtros: multiselect de concepto + checkbox "Solo con saldo pendiente".
  - Botón "Exportar CSV" de la semana (opcional, en vista expandida).
- **Search params**: `?semana=YYYY-MM-DD`; validados con `validateSearch` en la ruta.

### Fuera de alcance (mencionar al cierre)
- Gráficas / tendencia multi-semana → puede vivir después en Contabilidad.
- Edición o aprobación desde este módulo: es solo-lectura, los gastos se siguen aprobando en sus módulos origen.
- Comparativo presupuesto vs gastado por obra.