## Cambios

### 1. Sidebar lateral desktop — sección contextual "Obra"
En `src/components/AppShell.tsx`, dentro de `renderNav`, cuando `isInsideObra && obraId`, agregar una nueva sección **arriba** de "Corporativo" (adicional, no reemplaza) titulada **"Obra"** con los mismos items que ya están en el `MobileBottomBar` contextual:

- Presupuesto, Estimaciones, Requisiciones, Nómina, Destajos, Subcontratos, Almacén, Rentas, Gasolinas, Caja chica, Tareas.

Cada uno renderizado con `<NavItem>` (link + icono), marcando activo cuando `pathname` empieza con la ruta del módulo. Reutilizar el mismo array que alimenta al bottom bar para evitar duplicar la lista (extraerlo a una const local `obraBottomItems`).

### 2. Botón X en header para salir de la obra (desktop)
En el `<header>` del `AppShell` (la barra superior), cuando `isInsideObra`, mostrar un botón discreto con icono `X` (lucide-react) a la izquierda del bloque de acciones (antes de `NotificacionesBell`), con `aria-label="Salir de la obra"`, estilo ghost, que navegue a `/app`. Visible en todos los tamaños (móvil y desktop) — sustituye la necesidad de una navegación de retorno manual.

### 3. Bottom bar
No cambia. Ya está `md:hidden`, así que en desktop no aparece. En móvil sigue funcionando igual.

## Archivo a modificar
- `src/components/AppShell.tsx`