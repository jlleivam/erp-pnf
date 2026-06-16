## Problema

Al **ligar el código** de un vale de gasolina (`ligarCodigoVale`, estatus pasa a `entregado`), el vale ya es una obligación real de la empresa frente al proveedor de combustible — pero no se está creando ningún asiento contable, por lo que el pasivo no aparece en el balance.

## Cambio

En `src/lib/api/vales-gasolina.functions.ts`, dentro de `ligarCodigoVale` (después de actualizar el vale a `entregado` y antes/después de la notificación), generar un asiento contable de partida doble usando `supabaseAdmin` (mismo patrón que `subcontratos.functions.ts` y `destajos.functions.ts`):

- `cargo` → cuenta **"Costo de obra - Gasolinas"** por `monto_autorizado`.
- `abono` → cuenta **"Cuentas por pagar - Gasolinas"** por `monto_autorizado`.

Campos del asiento:
- `asiento_id`: `gen_random_uuid()` (compartido por ambos renglones).
- `fecha`: día de hoy (`ligado_at`).
- `concepto`: `"Vale ${folio} — ${tipo_combustible}"`.
- `referencia`: `folio`.
- `origen_tipo`: `"vale_gasolina_entregado"`.
- `origen_id`: `vale.id`.
- `creado_por`: `userId`.
- `company_id`: `vale.company_id`.

Si la inserción del asiento falla, hacer **rollback** revirtiendo el `update` del vale (vuelve a `autorizado`, limpia `codigo_vale`, `ligado_por`, `ligado_at`) — mismo patrón que se usa en estimaciones.

Ampliar el `select` inicial del vale para traer también `monto_autorizado`, `tipo_combustible`.

## Detalles técnicos

```ts
const asientoId = crypto.randomUUID();
const fechaAsiento = new Date().toISOString().slice(0, 10);
const monto = Number(vale.monto_autorizado ?? 0);
const concepto = `Vale ${vale.folio} — ${vale.tipo_combustible}`;
const base = {
  company_id: vale.company_id,
  asiento_id: asientoId,
  fecha: fechaAsiento,
  concepto,
  referencia: vale.folio,
  origen_tipo: "vale_gasolina_entregado",
  origen_id: data.id,
  creado_por: userId,
};
const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
const { error: asErr } = await supabaseAdmin.from("asientos_contables").insert([
  { ...base, tipo_movimiento: "cargo", cuenta_contable: "Costo de obra - Gasolinas", monto },
  { ...base, tipo_movimiento: "abono", cuenta_contable: "Cuentas por pagar - Gasolinas", monto },
]);
if (asErr) {
  // rollback del update del vale
  throw new Error(asErr.message);
}
```

## Fuera de alcance

- No se crea CxP automática (la integración con `cuentas_por_pagar` queda para una iteración posterior; por ahora solo el asiento que refleja el pasivo en el balance).
- No se modifica el estado de resultados — `gasolinas` ya se cuenta ahí desde `estado-resultados.functions.ts`.
- No se altera el flujo de autorización ni el de confirmación de recepción.
- No se generan asientos para vales históricos ya entregados (solo nuevos a partir del cambio).
