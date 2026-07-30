# Separar "Obras" del Dashboard

Hoy la ruta `/app` muestra el listado de obras pero en el menú aparece como "Dashboard". Vamos a separar ambas cosas.

## Qué se va a hacer

1. **Nueva página Obras en `/app/obras`**
   - Mueve tal cual el contenido actual: título "Obras", subtítulo, botón "Nueva obra" (según permiso `obras.crear`), tarjetas de obra con su globo de pendientes y el estado vacío.

2. **Dashboard en blanco en `/app`**
   - Queda como página placeholder: título "Dashboard" y un mensaje tipo "Próximamente" en una tarjeta punteada, sin datos.

3. **Navegación**
   - Sidebar: "Dashboard" apunta a `/app` (activo exacto) y se agrega "Obras" apuntando a `/app/obras` con icono de casco.
   - Barra inferior móvil: el ítem "Obras" apunta a `/app/obras`; el ítem "Dashboard" se queda en `/app`.
   - Los redireccionamientos internos que hoy mandan a `/app` (cambio de rol simulado, salir de una obra, post-login) pasan a `/app/obras`, que es la vista útil.

## Detalles técnicos

- Nuevo archivo `src/routes/_authenticated/app.obras.index.tsx` con `createFileRoute("/_authenticated/app/obras/")` y el componente actual (incluye `ObraCard`).
- `src/routes/_authenticated/app.index.tsx` se reduce al placeholder.
- `src/components/AppShell.tsx`: se actualizan los `NavItem`/ítems móviles (líneas ~199, 324, 337) y los `navigate({ to: "/app" })` (líneas ~120 y ~428).
- No se toca lógica de datos ni permisos; `listObras` sigue igual.
