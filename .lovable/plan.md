## Objetivo

Cambiar el diálogo actual **"Solicitar pago de anticipo"** por uno más simple titulado **"Pago de anticipo de destajo"** que muestre destajo, destajista, fecha de hoy (no editable) y un **folio único consecutivo** generado al enviar, además del campo de notas.

## Cambios en el diálogo (`DestajoDetalleSheet.tsx`)

Nuevo contenido del `<Dialog open={solicitOpen}>`:

1. **Título** → "Pago de anticipo de destajo"
2. Bloque de solo lectura (`rounded-md border bg-muted/30 p-3`, filas label/valor):
   - **Destajo** → `destajo.nombre`
   - **Destajista** → `destajo?.destajista?.nombre_completo ?? "—"`
   - **Fecha** → fecha de hoy formateada en es-MX (Input deshabilitado o texto)
   - **Folio** → se muestra como "Se asignará al enviar" (gris). El folio definitivo se asigna en el servidor para garantizar consecutividad sin huecos.
3. **Notas** (Textarea) — único campo editable.
4. Footer: Cancelar / Enviar solicitud (igual que hoy).

Se eliminan del diálogo: Monto total del destajo y Monto de anticipo (% y monto). Esa información sigue visible en la tarjeta de Anticipo, sólo se quita del diálogo según lo solicitado.

## Folio consecutivo

Formato: **`AD-YYYY-NNNN`** (Anticipo de Destajo), consecutivo por `company_id` y año, igual patrón que los folios existentes (`CC-…`, `VG-…`, `REQ-…`).

### Esquema (migración)

- Agregar columna `folio text` a `public.obra_destajo_anticipos` (nullable; los registros existentes quedan sin folio).
- Crear índice único parcial `(company_id, folio) WHERE folio IS NOT NULL` para garantizar unicidad por empresa.
- Crear función `public.siguiente_folio_anticipo_destajo(_company_id uuid)` análoga a `siguiente_folio_caja_chica`, devolviendo `AD-YYYY-NNNN`.

### Server function

En `solicitarAnticipoDestajo` (`src/lib/api/destajos.functions.ts`):
- Al marcar `solicitado_at` por primera vez, si `folio IS NULL` llamar a `siguiente_folio_anticipo_destajo(company_id)` y guardarlo en el `update`.
- El folio se conserva aunque se cancele y vuelva a solicitar (no se reasigna), para no romper consecutividad. Si se prefiere reasignar, lo confirmamos antes de implementar.
- Devolver el folio para mostrarlo en el `toast` de éxito ("Solicitud enviada · AD-2026-0001").

## Archivos afectados

- `src/components/destajos/DestajoDetalleSheet.tsx` — rediseño del diálogo.
- `src/lib/api/destajos.functions.ts` — asignar folio en `solicitarAnticipoDestajo` y exponerlo en el retorno.
- Migración SQL — columna `folio`, índice único y función de folio.

No se tocan otros módulos (Cuentas por Pagar seguirá leyendo `solicitud_notas` y ahora podrá mostrar `folio` si se desea más adelante).

## Preguntas abiertas

1. ¿El folio debe **conservarse** al cancelar/re-solicitar, o reasignarse cada vez? (Propuesta: conservarse.)
2. ¿Quieres que el folio también se muestre en la tarjeta de Anticipo y en Cuentas por Pagar? (Por ahora sólo se asigna; mostrarlo en otras vistas se puede hacer en un paso siguiente.)
