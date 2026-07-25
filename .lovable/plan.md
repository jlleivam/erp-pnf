## Objetivo

En "Nueva solicitud" (pestaña Solicitudes de una requisición), reemplazar el `<Select>` actual del campo **Proveedor** por un combobox con búsqueda que filtre por **razón social** o **nombre comercial**.

## Cambios

**`src/components/requisiciones/SolicitudesTab.tsx`**
- Sustituir el `Select` de proveedor (líneas ~247-256) por un `Popover` + `Command` (shadcn) — mismo patrón que ya usan otros pickers del proyecto (p. ej. `InsumoPicker` en `NuevaRequisicionSheet.tsx`).
- Trigger: botón outline del ancho del contenedor mostrando el proveedor seleccionado (`razon_social` y, si existe, `nombre_comercial` en gris entre paréntesis) o el placeholder "Selecciona proveedor".
- Contenido: `Command` con `CommandInput` (placeholder "Buscar por razón social o nombre comercial…"), `CommandEmpty` y `CommandList` con un `CommandItem` por proveedor.
  - `value` del item: `` `${razon_social} ${nombre_comercial ?? ""}` `` para que el filtro nativo de `cmdk` matchee ambos campos.
  - Al seleccionar, setear `proveedorId` y cerrar el popover.
  - Ícono de check en el item activo.
- Añadir `onWheel`/`onTouchMove` stopPropagation al `PopoverContent` (mismo fix ya aplicado en el picker de insumos) para evitar el bug de scroll dentro de sheets.

Sin cambios en API, tipos ni en la lista `proveedores` que ya llega como prop (ya incluye `nombre_comercial`).

## Notas técnicas

- Reutiliza componentes existentes: `@/components/ui/popover`, `@/components/ui/command`, `Button`, ícono `Check`/`ChevronsUpDown` de `lucide-react`.
- No tocar `CotizacionSheet.tsx` ni otros dropdowns salvo que el usuario lo pida.
