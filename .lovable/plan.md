## Objetivo

Al importar (PDF/Excel) o al guardar el presupuesto base, si el usuario incluye una clave como `1.1.1` sin que exista su padre `1.1` (o `1`), auto-crear los renglones padre faltantes con concepto `"—"`, sin unidad, cantidad ni PU. Así los cálculos actuales (suma por hijos directos, detección de grupo, vigente, OCs) siguen funcionando sin cambios.

## Cambios

### 1. `src/lib/presupuesto-utils.ts` — nuevo helper

Agregar función pura reutilizable:

```ts
export function completarPadresFaltantes(input: RenglonInput[]): RenglonInput[]
```

- Recorre las claves; para cada `clave` con padres ausentes en el input, inserta un renglón por cada ancestro faltante con:
  - `clave` = el ancestro (`1.1`, `1`)
  - `concepto` = `"—"`
  - `unidad = null`, `cantidad = null`, `precio_unitario = null`
- No modifica el orden preexistente; los padres agregados se dejan en la lista (el orden visual final lo resolverá `procesarRenglones` con `ordenSort`).
- Idempotente: si el padre ya existe (aunque esté vacío), no lo duplica.

### 2. `src/components/presupuesto/CapturaPresupuestoSheet.tsx`

- **Al importar** (`handleImportarExcel` y `handleImportarPdf`): pasar los renglones por `completarPadresFaltantes` antes de `aplicarRenglonesImportados`, para que el usuario vea los padres auto-creados en la tabla y pueda editar su concepto si quiere.
- **Al guardar** (`handleGuardar`): antes de construir el payload y calcular con `procesarRenglones`, expandir `rows` con los padres faltantes y actualizar `setRows` (así el usuario ve qué se agregó y por qué desaparecen los errores tipo "Falta el renglón padre 1.1"). Luego procede la validación normal.
- Mostrar un `toast.info` cuando se auto-crean padres, indicando cuántos, para que el usuario los revise.

### 3. Alcance intencionalmente limitado

- **No** se toca `procesarOrdenCambio`: las OCs siguen exigiendo padre explícito. Si en el futuro se quiere el mismo comportamiento allí, se aplicará el helper también en las capturas de OC.
- **No** cambian las reglas de suma ni el modelo persistido: el padre auto-creado se guarda como un renglón normal (grupo por tener hijos), con concepto `"—"` editable después.
- **No** se altera el flujo de destajos/subcontratos: usan sus propios sheets y no importan PDF hoy.

## Verificación

- Test manual en Playwright: capturar `1`, luego `1.1.1` con cantidad/PU, guardar borrador. Confirmar que aparece renglón `1.1` con concepto `"—"` marcado como grupo, y el total sube correctamente.
- Test manual: importar un PDF que contenga solo `1` y `1.1.1`; confirmar que la tabla muestra el `1.1` auto-creado.
- `bun tsgo` para typecheck.
