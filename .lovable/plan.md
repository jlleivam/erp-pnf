## Objetivo

El residente solicita fondear su caja chica (≤ monto base configurado por el director). La solicitud requiere **autorización del supervisor de la obra**; sólo después de autorizada se genera una **Cuenta por Pagar** que recibe el administrativo para pagarla en efectivo desde caja fuerte. Al pagarse el CxP, el fondo queda entregado y se afectan cuentas + asientos contables.

## Flujo

```text
Residente: Solicitar fondo  (monto ≤ monto_base − fondos vivos)
          │
          ▼
caja_chica_fondos.estatus = 'pendiente_autorizacion'
          │ 🔔 supervisor(es) de la obra
          ▼
Supervisor: Autorizar / Rechazar
   rechazar ─► estatus='rechazado' (motivo)  🔔 residente
   autorizar ─► estatus='autorizado'
                │
                ▼
        Crea cuentas_por_pagar (origen_tipo='caja_chica_fondo',
        beneficiario=residente, folio CxP, estatus='pendiente')
                │ 🔔 administrativos + residente
                ▼
Administrativo (Cuentas por Pagar → tab "Caja chica"):
        Registrar pago → reutiliza registrarPagoCxP
          ├─ Sólo cuenta tipo caja_fuerte + método efectivo
          ├─ pagos + cuenta_movimientos (egreso)
          ├─ Descuenta cuentas.saldo_actual
          ├─ Asiento: Cargo "Cuentas por pagar - Caja chica" /
          │           Abono  "Caja fuerte"
          └─ CxP estatus='pagada'
                │
                ▼
        caja_chica_fondos → 'entregado'   🔔 residente
```

## Cambios

### Migración
- Agregar valores al enum `caja_chica_fondo_estatus`: `'pendiente_autorizacion'`, `'autorizado'`, `'rechazado'`.
- Agregar valor `'residente'` al enum `cxp_beneficiario_tipo`.
- Columnas nuevas en `caja_chica_fondos`: `autorizado_por`, `autorizado_at`, `rechazado_por`, `rechazado_at`, `motivo_rechazo`, `cxp_id`.

### `src/lib/api/caja-chica.functions.ts`
- **`solicitarFondoCajaChica`**:
  - Guard `isResidenteDeObra` (o director).
  - Leer `caja_chica_asignaciones.monto_base` activo. Si no existe → error "El director aún no ha configurado el monto base de caja chica".
  - `disponible = monto_base − Σ fondos vivos (pendiente_autorizacion + autorizado + entregado)`. Rechazar si excede.
  - Inserta fondo en `estatus='pendiente_autorizacion'`.
  - 🔔 supervisor(es) de la obra (y director).
- **`autorizarFondoCajaChica({ id })`** (nueva):
  - Sólo supervisor de la obra (o director).
  - Fondo debe estar en `pendiente_autorizacion`.
  - Marca `estatus='autorizado'`, `autorizado_por`, `autorizado_at`.
  - Crea `cuentas_por_pagar` (folio via `siguiente_folio_cxp`, beneficiario_tipo='residente', beneficiario_id=residente_id, origen_tipo='caja_chica_fondo', origen_id=fondo.id, monto_total).
  - Guarda `cxp_id` en el fondo.
  - 🔔 administrativos + residente.
- **`rechazarFondoCajaChica({ id, motivo })`** (nueva):
  - Mismo guard. `estatus='rechazado'` + motivo + auditoría. 🔔 residente.
- **`entregarFondoCajaChica`**: deprecada para UI; permanece sólo como compatibilidad. La entrega real ocurre vía pago de CxP.

### `src/lib/api/pagos.functions.ts`
- En `registrarPagoCxP`:
  - Mapear `origen_tipo='caja_chica_fondo'` → cuenta de pasivo `"Cuentas por pagar - Caja chica"`.
  - Validar para ese origen: cuenta tipo `caja_fuerte` + método `efectivo`.
  - Tras marcar CxP pagada: actualizar `caja_chica_fondos` (id = cxp.origen_id) → `estatus='entregado'`, `monto_entregado`, `entregado_por`, `entregado_at`. 🔔 residente.
- `cancelarPago` (cuando aplique a este origen): revertir fondo a `autorizado` y CxP a `pendiente`. 🔔 residente.
- Nueva `listCxPCajaChicaFondoPendientes()` para alimentar la pestaña en CxP, enriquecida con obra y residente.

### `src/lib/contabilidad/balance.functions.ts` + `catalogo.ts`
- Registrar la cuenta contable `"Cuentas por pagar - Caja chica"`.
- Pasivo "Caja chica - fondos" = suma de `cuentas_por_pagar` con `origen_tipo='caja_chica_fondo'` y `estatus IN (pendiente, parcial)`. Independiente del pasivo por reembolsos.

### UI

**`src/components/caja-chica/CajaChicaModule.tsx`**
- Tarjeta "Disponible para solicitar" = monto_base − fondos vivos.
- Tab Fondos: cada fondo muestra estatus humanizado (Pendiente autorización · Autorizado · Entregado · Rechazado) y, cuando aplica, folio del CxP.
- Supervisor de la obra (o director): botones **Autorizar / Rechazar** en fondos `pendiente_autorizacion` (rechazar pide motivo).
- Botón "Entregar" eliminado de esta vista.

**`src/components/pagos/CuentasPorPagarModule.tsx`**
- Nueva pestaña **"Caja chica"** con badge de count.
- `CajaChicaPorPagarTab.tsx`: tabla obra · residente · folio CxP · fecha · monto, botón **Registrar pago** → abre `RegistrarPagoCxPDialog` ya existente, restringido a caja_fuerte/efectivo.

### Notificaciones (resumen)
| Evento | Destinatarios |
|---|---|
| `solicitarFondo` | Supervisor(es) de la obra + director |
| `autorizarFondo` | Administrativos + residente |
| `rechazarFondo` | Residente |
| Pago de CxP (origen `caja_chica_fondo`) | Residente |
| Cancelación del pago | Residente |

## Permisos

| Acción | Residente | Supervisor | Administrativo | Director |
|---|---|---|---|---|
| Configurar monto base | — | — | — | ✓ |
| Solicitar fondo | ✓ | — | — | ✓ |
| Autorizar / rechazar | — | ✓ | — | ✓ |
| Pagar CxP del fondo | — | — | ✓ | ✓ |

## Fuera de alcance
- Asiento espejo al crear la CxP (el pasivo se mide directo de `cuentas_por_pagar`).
- Migración de fondos legacy en `pendiente` (siguen disponibles con el flujo antiguo).
- Reembolsos: flujo independiente, sin cambios.
