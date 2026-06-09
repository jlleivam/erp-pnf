## Objetivo

En el presupuesto vigente, hacer visibles los efectos de las órdenes de cambio:

1. **Modificado**: si una OC cambió la cantidad y/o el PU de un concepto, resaltar **solo el campo modificado** con color distinto (ámbar) y mostrar el valor base como tooltip al pasar el mouse.
2. **Eliminado**: ya no ocultar el renglón; mantenerlo en la tabla con badge `Eliminado`, cantidad `0`, importe `$0.00`, y fila en gris claro tipo "deshabilitado" (texto muted, fondo `muted/20`, sin contribuir al total — ya no contribuye porque su importe es 0).

## Cambios

### 1. `src/lib/presupuesto-utils.ts`

Extender `VigenteNode` y el reconstructor para conservar información de cambios:

- `origen` agrega un nuevo valor: `"eliminada"` (además de `base | modificada | agregada`).
- Nuevos campos opcionales en `VigenteNode`:
  - `cantidad_base?: number | null` — cantidad original (solo si origen `modificada`).
  - `pu_base?: number | null` — PU original (solo si origen `modificada`).
  - `cantidad_modificada?: boolean` — true si la cantidad cambió respecto al base.
  - `pu_modificado?: boolean` — true si el PU cambió respecto al base.

En `reconstruirVigente`:
- Antes de aplicar modificaciones, guardar `cantidad_base` / `precio_unitario_base` en la Hoja cuando se aplique la primera modificación sobre un renglón base.
- **Ya no filtrar** las hojas eliminadas: dejarlas en la lista con `origen="eliminada"`, `cantidad=0`, `precio_unitario` se conserva (informativo) pero `importe=0`.
- Las eliminadas no contribuyen al importe del grupo padre (ya es 0 × algo, o forzamos 0).
- Las eliminadas tampoco arrastran sus grupos: si un grupo se queda sin hojas vivas no debe desaparecer si la única hoja era eliminada — se mantiene visible con importe 0 (consistente con el reporte).

### 2. `src/components/presupuesto/VigenteTable.tsx`

- Tipo `VigenteRow` extendido con los nuevos campos (`cantidad_base`, `pu_base`, `cantidad_modificada`, `pu_modificado`, y `origen` incluyendo `"eliminada"`).
- Render:
  - Badges:
    - `origen="modificada"` → `Mod` (existente, secondary).
    - `origen="agregada"` → `Nuevo` (existente, primary).
    - `origen="eliminada"` → `Eliminado` (`variant="outline"` con texto muted).
  - Cuando `origen="eliminada"`:
    - Fila con `bg-muted/20 text-muted-foreground line-through opacity-70`.
    - Mostrar `0` en cantidad e `$0.00` en importe.
  - Cuando `origen="modificada"`:
    - Si `cantidad_modificada`: celda Cantidad con `bg-amber-100 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-medium`, envuelta en Tooltip mostrando "Antes: {cantidad_base}".
    - Si `pu_modificado`: misma idea para la celda PU.

### 3. Sin cambios en consumidores

`VerVigenteSheet.tsx`, `VigenteViewerDialog.tsx` y los serverFns (`getVigente`) siguen igual — solo se enriquece el tipo de retorno.

## Detalles técnicos

```text
src/lib/presupuesto-utils.ts
  Hoja: { ..., cantidad_base, pu_base, cantidad_mod, pu_mod }
  Loop OCs:
    eliminacion → h.eliminada = true (NO se filtra al final)
    modificacion → if h.origen === "base":
                     h.cantidad_base = h.cantidad
                     h.pu_base = h.precio_unitario
                   h.cantidad_mod = h.cantidad_mod || (newCant !== h.cantidad_base)
                   h.pu_mod        = h.pu_mod      || (newPU  !== h.pu_base)
                   h.cantidad = newCant; h.precio_unitario = newPU
                   h.origen = "modificada"

  Construir nodos: NO descartar eliminadas. Para eliminadas:
    cantidad = 0, precio_unitario conservado, importe = 0, origen = "eliminada"

  Importes de grupos: ignorar hojas eliminadas en la suma (importe = 0 de todas formas).
```

```text
src/components/presupuesto/VigenteTable.tsx
  rowClass: r.origen === "eliminada"
              ? "bg-muted/20 text-muted-foreground opacity-70"
              : r.es_grupo ? "bg-muted/30 font-medium" : ""

  Badge eliminada: <Badge variant="outline" className="text-[10px] h-4 px-1">Eliminado</Badge>

  Cantidad cell:
    if eliminada → "0"
    if cantidad_modificada → wrap in Tooltip + amber bg
    else → valor normal

  PU cell: análogo con pu_modificado.
```

Sin cambios de schema ni de datos persistidos; toda la lógica vive en `presupuesto-utils.ts` y la presentación en `VigenteTable.tsx`.
