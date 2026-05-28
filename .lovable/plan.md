# Mostrar el menú lateral en pantallas pequeñas

## Problema
El sidebar en `src/components/AppShell.tsx` usa `hidden md:flex md:w-64`, por lo que solo aparece a partir de 768px de ancho. El viewport actual es de 750px y no existe un botón hamburguesa, por eso no se ve ningún menú.

## Cambios en `src/components/AppShell.tsx`

1. **Extraer el contenido del `<nav>`** a un componente interno `SidebarNav` para reutilizarlo en desktop y móvil sin duplicar lógica.

2. **Sidebar desktop**: mantener `hidden md:flex md:w-64` con el mismo contenido.

3. **Sidebar móvil**: usar el componente `Sheet` de shadcn (`@/components/ui/sheet`) con:
   - `SheetTrigger` como botón hamburguesa (`Menu` icon de lucide-react) visible solo en `md:hidden`, ubicado a la izquierda del header.
   - `SheetContent side="left"` con el mismo `SidebarNav` y el branding "ERP PNF / Constructoras".
   - Cerrar el Sheet automáticamente al hacer clic en cualquier `NavItem` (controlando el estado `open` con `useState` y pasando `onNavigate` a `SidebarNav`).

4. **Header**: añadir el botón hamburguesa antes del logo "ERP PNF" (solo móvil).

## Resultado
- Desktop (≥768px): sidebar fijo a la izquierda igual que ahora.
- Móvil (<768px): botón hamburguesa en el header que abre el menú lateral deslizable con las mismas opciones (Dashboard, Clientes, Equipo, Nueva obra, Configuración, módulos de Administración).

No se tocan rutas, lógica de auth ni estilos del catálogo de clientes.
