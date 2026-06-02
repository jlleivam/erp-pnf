# Órdenes de cambio al presupuesto autorizado

## Concepto

Hoy tenemos "Adendas aditivas" que son presupuestos sueltos que se suman al base. Eso no permite **modificar** ni **eliminar** conceptos existentes — solo agregar.

Propongo evolucionar `adenda` → **Orden de Cambio (OC-P)** que actúe como un **delta** contra el presupuesto base. El base nunca se toca; el "vigente" se calcula como base + suma de órdenes autorizadas.

## Tipos de movimiento dentro de una orden de cambio

Cada renglón de una OC-P es uno de tres tipos:

| Tipo | Acción | Clave WBS | Importe |
|------|--------|-----------|---------|
| `modificacion` | Cambia cantidad y/o PU de un concepto existente | Misma clave del vigente | `(cant_nueva × PU_nuevo) − importe_vigente` (puede ser ±) |
| `adicion` | Agrega un concepto nuevo | Clave nueva | `cantidad × PU` (positivo) |
| `eliminacion` | Elimina un concepto existente | Misma clave del vigente | `−importe_vigente` (negativo) |

Reglas:
- Solo se puede modificar/eliminar renglones **hoja** (no grupos).
- No se puede modificar/eliminar dos veces la misma clave dentro de la misma OC.
- Una OC sobre una clave ya eliminada por una OC previa autorizada se rechaza.
- Adiciones deben respetar la jerarquía WBS (el padre debe existir en el vigente o agregarse en la misma OC).

## Cálculo del "vigente"

```text
vigente[clave] = base[clave]
            + Σ modificaciones_autorizadas[clave].delta
            + adiciones_autorizadas[clave]
            − eliminaciones_autorizadas[clave]   (la clave desaparece)
```

Los grupos se recalculan sumando sus hijos vigentes.

## Cambios de esquema (migración)

`obra_presupuesto_renglones`:
- Nuevo enum `tipo_movimiento ('renglon','modificacion','adicion','eliminacion')`.
  - Base → todos `renglon`.
  - OC → `modificacion | adicion | eliminacion`.
- Nueva columna `importe_delta numeric` (firmado), calculada en servidor para OCs.

(El enum `tipo` de `obra_presupuestos` se mantiene `base|adenda` para no romper datos; en UI se muestra como "Orden de cambio #N".)

## Lógica servidor

En `presupuesto-utils.ts`:
- `reconstruirVigente(baseRenglones, ocsAutorizadas)` → árbol vigente.
- `procesarOrdenCambio({ vigentePrevio, ocInputRenglones })`:
  1. Valida cada renglón según su `tipo_movimiento`.
  2. Calcula `importe_delta` por renglón.
  3. Devuelve `{ renglones, errores, montoDelta }` (el total de la OC puede ser negativo).

En `presupuestos.functions.ts`:
- `getVigente(obraId)` → devuelve el presupuesto vigente reconstruido, marcando renglones modificados/agregados.
- `guardarRenglonesOC(presupuestoId, renglones[])` → reemplaza a `guardarRenglones` cuando el presupuesto es OC.
- Se mantiene `guardarRenglones` solo para presupuesto base.
- **No hay parseo de Excel para OCs.** La función `parsearExcelPresupuesto` actual sigue existiendo solo para el base.

## UI

**`PresupuestoModule`:**
- Renombrar tab "Adendas" → "Órdenes de cambio (N)".
- Tarjetas resumen: Base autorizada · Σ Órdenes autorizadas (puede ser negativo) · Total vigente.
- Botón "Nueva orden de cambio" (solo Director, requiere base autorizado).
- Nuevo botón "Ver presupuesto vigente" en el header del módulo.

**Nuevo `CapturaOrdenCambioSheet`** (solo manual, sin Excel):
- 3 secciones tabuladas dentro del sheet:
  1. **Modificar** – buscador sobre el vigente actual; al elegir un concepto se agrega una fila con `clave · concepto · cant_actual · PU_actual` y campos editables `cant_nueva / PU_nuevo`; muestra delta en vivo.
  2. **Agregar** – tabla manual estilo captura actual (clave WBS, concepto, unidad, cantidad, PU). Validación de claves WBS y jerarquía.
  3. **Eliminar** – picker múltiple sobre el vigente; muestra el importe que se restará por cada uno.
- Footer fijo con `Δ Total: ±$X` y acciones Guardar borrador / Autorizar.

**`VerPresupuestoSheet`:**
- Para una OC: muestra sus renglones agrupados por tipo de movimiento con su delta.
- Para el base: sin cambios.

**Nuevo `VerVigenteSheet`:**
- Árbol consolidado base + OCs autorizadas, con badges en renglones modificados/agregados.

## Permisos

Solo **Director** crea, edita y autoriza OCs. Una vez autorizada queda inmutable. Para revertir → otra OC con movimientos opuestos.

---

### Entregable

1. Migración: enum `tipo_movimiento` + columnas `tipo_movimiento` e `importe_delta` en `obra_presupuesto_renglones`.
2. `presupuesto-utils.ts`: `reconstruirVigente` + `procesarOrdenCambio`.
3. `presupuestos.functions.ts`: `getVigente`, `guardarRenglonesOC`.
4. UI: `CapturaOrdenCambioSheet` (manual), `VerVigenteSheet`, ajustes en `PresupuestoModule` y `VerPresupuestoSheet`.
