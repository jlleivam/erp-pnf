## Objetivo

Dentro de una obra, en móvil, mostrar los 10 módulos de la obra en una **barra inferior con scroll horizontal**, sin paginación ni botón "Más". Fuera de obra el bottom bar sigue igual (5 íconos fijos).

## Cambios

### 1. `src/components/MobileBottomBar.tsx`

Añadir una prop `variant?: "fixed" | "scroll"` (default `"fixed"`):

- **`fixed`** (comportamiento actual): 4 items + botón "Más", repartidos con `flex-1`. Sin cambios para el modo corporativo.
- **`scroll`**: contenedor `overflow-x-auto` con scroll horizontal, sin botón "Más", sin `flex-1`. Cada item con ancho mínimo (`min-w-[72px]`) e ícono + label. Se añade un degradado a la derecha (`pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-card to-transparent`) para insinuar que hay más contenido. `scrollbar-width: none` + `[&::-webkit-scrollbar]:hidden` para ocultar la barra.

El estado activo y el matching de pathname se mantienen igual.

### 2. `src/components/AppShell.tsx`

- Cuando `isInsideObra`, pasar `variant="scroll"` y un array de 10 items (en este orden, según pidió el usuario):
  1. Presupuesto → `/app/obras/$obraId/presupuesto`
  2. Requisiciones → `/app/obras/$obraId/requisiciones`
  3. Nómina → `/app/obras/$obraId/nomina`
  4. Destajos → `/app/obras/$obraId/destajos`
  5. Subcontratos → `/app/obras/$obraId/subcontratos`
  6. Almacén → `/app/obras/$obraId/almacen-obra`
  7. Rentas → `/app/obras/$obraId/rentas`
  8. Gasolinas → `/app/obras/$obraId/gasolinas`
  9. Caja chica → `/app/obras/$obraId/caja-chica`
  10. Tareas → `/app/obras/$obraId/tareas`
- Quitar `onMoreClick` cuando `variant="scroll"` (la prop se vuelve opcional).
- Fuera de obra: sin cambios (sigue con `variant="fixed"`, 4 items + "Más" abriendo el Sheet con el menú corporativo completo).
- "Resumen" no entra en el bottom bar de obra: se accede tocando el nombre de la obra en el header de `ObraShell` (ver punto 3).

### 3. `src/components/ObraShell.tsx`

Hacer que el header móvil de la obra (donde aparece "← Obras" y el nombre de la obra) sea el acceso a **Resumen**: el bloque del nombre/título se convierte en `<Link to="/app/obras/$obraId">`. Así no se pierde el acceso al Resumen a pesar de no estar en el bottom bar.

### 4. Iconos

Reutilizar los iconos ya definidos en `src/lib/modules.ts` (`ClipboardList`, `Users`, `Hammer`, `Handshake`, `Warehouse`, `Truck`, `Fuel`, `Coins`, `ListTodo`) + `Receipt` para Presupuesto/Requisiciones según convenga. Sin nuevos assets.

## Resultado

- Móvil dentro de obra: barra inferior con los 10 módulos en scroll horizontal, fade derecho como pista visual de "hay más", sin estados ocultos ni paginación.
- Acceso a Resumen via el título del header de la obra.
- Móvil fuera de obra y desktop: sin cambios.
