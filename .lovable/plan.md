## Rediseño Tesorería — enfoque en movimientos

Objetivo: que la tabla de movimientos sea la protagonista. Reducir drásticamente el espacio del KPI y de la lista de cuentas.

### Cambios visuales

**1. KPI total — de Card grande a barra delgada**
- Reemplazar la Card del saldo total por una fila compacta arriba: ícono + "Saldo total cuentas activas" + monto en línea (un solo renglón, ~40px de alto).
- Eliminar el gradiente y el padding generoso.

**2. Cuentas — de cards verticales a chips horizontales**
- Sustituir la columna lateral de Cards por una fila horizontal scrolleable (chips/pills) arriba del detalle.
- Cada chip: ícono + nombre + saldo (una línea). Estado seleccionado con borde primary.
- Toggle "Inactivas" se vuelve un chip extra al final ("+N inactivas").
- Esto libera todo el ancho para la tabla.

**3. Encabezado de detalle más compacto**
- Header de la cuenta seleccionada en una sola fila: nombre + badge tipo a la izquierda, saldo actual a la derecha (sin "Inicial" visible — se mueve a tooltip sobre el saldo).
- Filtros (fechas, tipo, CSV) en la misma fila cuando hay espacio, debajo en mobile.

**4. Totales del rango — inline, no Cards**
- Reemplazar las 3 Cards (Ingresos/Egresos/Neto) por una fila de texto compacta: `Ingresos $X · Egresos $Y · Neto $Z`.

**5. Tabla de movimientos — el foco**
- Mantener un movimiento por renglón (sin wrap).
- Formato fecha `DD/MM/AA` (helper local, no `formatDate`).
- Columnas centradas excepto **Concepto** que va alineado a la izquierda.
- Concepto truncado a ancho menor (~180px) con `Tooltip` mostrando concepto completo + referencia + origen al hacer hover.
- Reducir padding de celdas (`py-1.5`) y tipografía a `text-sm`/`text-xs` para densidad.
- Quitar la columna "Ref." y "Origen" del cuerpo principal (se muestran en el tooltip del concepto) para liberar ancho. Mantener Fecha · Concepto · Ingreso · Egreso · Saldo.

### Lo que NO cambia
- Lógica de datos, queries, cálculo del saldo corrido, export CSV, permisos.
- Filtros disponibles (fechas, tipo).
- Backend: ninguna modificación.

### Archivos
- `src/components/tesoreria/TesoreriaModule.tsx` — único archivo modificado.

### Detalle técnico
- Helper `formatDateShort(iso)` → `DD/MM/AA` con `Intl.DateTimeFormat('es-MX', { day:'2-digit', month:'2-digit', year:'2-digit' })`.
- `Tooltip` de shadcn (ya disponible) envolviendo la celda Concepto.
- Chips de cuentas: `flex gap-2 overflow-x-auto pb-1` con `snap-x` opcional.
- Columnas centradas: `text-center` en `TableHead` y `TableCell`; Concepto queda con `text-left`.

¿Procedo con esta implementación?
