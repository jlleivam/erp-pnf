## Objetivo

Hacer la tarjeta de requisición más compacta sin perder información: vista por defecto reducida, expandible para ver los insumos.

## Cambios en `src/components/requisiciones/RequisicionesModule.tsx`

### 1. Estado de expansión
- Agregar `const [expandidos, setExpandidos] = useState<Set<string>>(new Set())` y un helper `toggleExpand(id)`.

### 2. Helper de formato de fecha corta
- Nueva función `formatDateShort(d)` que devuelve `DD/MM/YY` (ej. `07/06/26`). Se usará en los chips. `formatDate` existente se mantiene para el encabezado.

### 3. Header compacto (líneas 82–114)
- Reducir padding del Card de `p-4` a `p-3`.
- Una sola línea con: **folio** · fecha · `N insumos` · solicitante (separados por `·`, truncados si no caben).
- Badge de estatus a la derecha en tamaño más pequeño (`text-[10px] px-2 py-0.5`).
- Botón "Revisar y autorizar" (supervisor) se mantiene a la derecha pero más compacto.
- Agregar chevron (▸/▾) clickeable a la izquierda del folio para expandir/colapsar. El click en el chevron NO abre el detalle; el click en el resto de la tarjeta sigue abriendo el detalle (`setDetalleId`).

### 4. Chips de insumos (líneas 115–131)
- Sólo se renderizan cuando la tarjeta está **expandida**.
- Quitar la fecha individual del chip; en su lugar mostrar **cantidad + unidad + nombre**.
- Agregar arriba de los chips un mini-resumen de fechas requeridas: `Entrega: 07/06/26 – 09/06/26` (rango min–max usando `formatDateShort`), o una sola fecha si todos coinciden.
- Mantener el límite de 6 chips + `+N más`.

### 5. Por defecto colapsada
- Vista inicial = sólo header (1–2 líneas + badge). Click en el chevron expande para mostrar el resumen de fechas + chips de insumos.

## Resultado visual

```text
Colapsada:
▸ REQ-2026-001 · 4 jun 2026 · 4 insumos · Jose Luis Leiva           [Enviada]

Expandida:
▾ REQ-2026-001 · 4 jun 2026 · 4 insumos · Jose Luis Leiva           [Enviada]
  Entrega: 07/06/26 – 09/06/26
  [30 KG · Alambre recocido] [7 M3 · Arena] [25 BTO · Cemento gris] [10 PZA · Varilla 1/2"]
```

## Fuera de alcance
- No se cambia la tabla de "histórico" (líneas 145+).
- No se cambia el componente de detalle ni `NuevaRequisicionSheet`.
