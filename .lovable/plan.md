## Contexto

Hoy, en un reembolso de caja chica:
- El **residente** captura gastos con `tipo_comprobante` ∈ {`factura`, `nota`, `ninguno`}.
- El **supervisor** revisa y cierra → envía al **administrativo**.
- El **administrativo** repone el efectivo total al residente.

El monto reembolsado al residente es **el monto total gastado** (no cambia). Pero el impacto al costo de obra sí depende del tipo:
- `factura` → costo obra = monto / 1.16 (IVA acreditable)
- `nota` / `ninguno` → costo obra = monto completo

Si la factura llega mal hecha (datos fiscales incorrectos, no es deducible), el administrativo necesita **reclasificarla a "nota"** dejando registro del motivo. El monto a reponer al residente no cambia, pero el costo a la obra sube (ya no se descuenta el IVA acreditable) y el IVA deja de ser acreditable.

## Cambios

### 1. Base de datos (migración)

Agregar a `public.caja_chica_gastos`:
- `comprobante_reclasificado_de text` — guarda el tipo original (`factura`) cuando se reclasifica.
- `comprobante_reclasificado_motivo text` — motivo escrito por el administrativo.
- `comprobante_reclasificado_por uuid` — usuario que reclasificó.
- `comprobante_reclasificado_at timestamptz`.

No se altera el flujo de aprobación; sólo se sobrescribe `tipo_comprobante` con el nuevo valor y se preserva la trazabilidad en estas columnas.

### 2. Server function nueva: `reclasificarComprobanteGasto`

En `src/lib/api/caja-chica.functions.ts`:
- Entrada: `{ gastoId, nuevoTipo: "nota" | "ninguno", motivo: string (min 3) }`.
- Permisos: sólo `administrativo` o `director`.
- Validaciones:
  - El gasto debe existir y tener `tipo_comprobante = "factura"` (sólo se permite degradar factura → nota/ninguno; no al revés porque eso sí afectaría el monto reembolsado y no es el caso de uso).
  - El reembolso padre debe estar en estatus `enviado_admin` (aún no repuesto) — para que la reclasificación quede asentada antes de pagar.
- Acción: actualiza `tipo_comprobante`, llena los 4 campos de trazabilidad. **No recalcula `monto_aprobado`** porque el reembolso al residente no cambia.
- Notifica al residente y al supervisor que revisó: "El administrativo reclasificó tu gasto X de factura a nota. Motivo: …".

### 3. UI — administrativo en `RevisarReembolsoSheet`

Cuando el usuario actual es `administrativo` o `director` y el reembolso está en `enviado_admin`, mostrar en cada gasto con `tipo_comprobante = "factura"` un botón **"Reclasificar a nota"** que abre un mini-form inline:
- Select: nuevo tipo (`nota` / `ninguno`).
- Textarea: motivo (requerido).
- Botón Confirmar.

En gastos ya reclasificados, mostrar un badge "Reclasificado de factura" con tooltip/línea con el motivo y quién lo hizo. El cálculo `Obra:` ya muestra el monto correcto automáticamente porque depende de `tipo_comprobante` actual.

### 4. Sin cambios en

- `reponerReembolsoCajaChica` — el monto a reponer ya viene precargado del `monto_aprobado`, que no cambia.
- Balance / contabilidad — `montoGastoObra()` se sigue usando con el `tipo_comprobante` ya actualizado, así que el impacto a la obra se recalcula solo.

## Resultado

El administrativo, antes de reponer el efectivo, puede convertir una factura mal hecha en nota dejando motivo. El residente recibe el mismo monto total; el costo a la obra sube (deja de descontarse el IVA). Queda registro de quién hizo el cambio y por qué, y todos los involucrados reciben notificación.
