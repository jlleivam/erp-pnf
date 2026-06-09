## Objetivo

En `CapturaDestajoSheet` (pantalla "Presupuesto base") agregar:

- **Arriba de la tabla**: Nombre del destajo y Destajista (en lugar de solo el título genérico).
- **Abajo de la tabla**: Bloque "Condiciones del destajo" con Anticipo y Fondo de garantía, ambos mostrando % y monto calculado sobre el Total actual.

## Cambios

### 1) `src/lib/api/destajos.functions.ts` — `getDestajoPresupuesto`

Extender el `select` del join `obra_destajos!inner(...)` para incluir `anticipo_pct, anticipo_monto, fondo_garantia_pct` y los datos del destajista vía relación a `trabajadores`:

```
obra_destajos!inner(
  id, obra_id, company_id, destajista_id, nombre, numero,
  anticipo_pct, anticipo_monto, fondo_garantia_pct,
  trabajadores:destajista_id ( id, nombre_completo, puesto )
)
```

Sin cambios de lógica, validaciones ni de escritura.

### 2) `src/components/destajos/CapturaDestajoSheet.tsx`

**Encabezado (arriba de la tabla):**
- Reemplazar el título actual "Presupuesto base" / nombre del presupuesto por una sección con:
  - `SheetTitle`: "Presupuesto base" + badge de estatus (igual que hoy).
  - Tarjeta compacta con dos campos read-only:
    - **Destajo**: `presupuesto.obra_destajos.nombre` (con `# numero` si aplica).
    - **Destajista**: `obra_destajos.trabajadores.nombre_completo` (· puesto si existe).
- Mantener `SheetDescription` con la nota de WBS.

**Pie (debajo de la tabla, antes del sticky footer):**
- Nuevo bloque "Condiciones del destajo" (Card) con dos filas:
  - **Anticipo**: `anticipo_pct %` · monto calculado = `montoTotal * anticipo_pct / 100`. Nota chica: "Se calcula sobre el total y se amortiza con cada estimación. Monto definitivo al autorizar."
  - **Fondo de garantía**: `fondo_garantia_pct %` · monto estimado al cierre = `montoTotal * fondo_garantia_pct / 100`. Nota chica: "Se retiene de cada estimación; el % muestra el acumulado al 100% del contrato."
- Si ambos % son 0 mostrar una línea "Sin anticipo ni fondo de garantía".
- Usar `formatMXN` y `calc.montoTotal` (ya disponible) para los cálculos. Si hay errores en renglones, mostrar "—" en los montos pero conservar los %.

Sin cambios al guardado, validaciones, ni a la tabla de renglones.

## Notas técnicas

- El tipo de `presupuesto` actualmente es `any` en el componente, así que no hace falta tocar `types.ts`.
- Las condiciones son solo informativas en esta pantalla (no editables aquí); ya se capturan al crear el destajo en `NuevoDestajoDialog`.
