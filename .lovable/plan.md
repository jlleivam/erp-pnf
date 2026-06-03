## Objetivo

En **móvil**, sustituir el menú hamburguesa actual del `AppShell` por una **barra inferior fija** de 5 íconos. Cuando el usuario entra a una obra, esa misma barra cambia de contenido para mostrar la navegación interna de la obra (lo que hoy hace `ObraShell` aparte). En **desktop** todo sigue exactamente igual: sidebar lateral en `AppShell` y contenido pleno en obra.

## Cambios

### 1. Nuevo componente `src/components/MobileBottomBar.tsx`

Barra fija inferior (`fixed bottom-0 inset-x-0 h-16 bg-card border-t z-30`), visible solo en `md:hidden`. Recibe props:
- `items: { to, label, icon, match }[]` — 4 entradas + 1 slot fijo "Más".
- `onMoreClick: () => void` — abre un Sheet con el resto del menú.

Cada ítem es un `<Link>` con estado activo basado en `pathname` (resaltado en `text-primary`).

### 2. `AppShell.tsx` — modo corporativo

- Detectar si la ruta actual es una obra: `pathname.startsWith("/app/obras/") && pathname !== "/app/obras/nueva"`.
- Calcular los `items` del bottom bar:
  - **Fuera de obra** (corporativo):
    1. Dashboard → `/app`
    2. Obras → `/app` (lista — mismo destino, pero podemos dejar Catálogos)
    3. Catálogos → `/app/catalogos`
    4. Configuración → `/app/configuracion`
    5. Más → abre Sheet
  - **Dentro de obra**:
    1. Resumen → `/app/obras/$obraId`
    2. Estimaciones → `/app/obras/$obraId/estimaciones`
    3. Tareas → `/app/obras/$obraId/tareas`
    4. Almacén → `/app/obras/$obraId/almacen-obra`
    5. Más → abre Sheet (con los módulos restantes de la obra + atajo "Salir a Obras")
- Reemplazar el `Sheet` hamburguesa actual del header por:
  - Quitar el botón `Menu` del header en móvil.
  - El Sheet del menú completo se abre ahora con el ítem "Más" del bottom bar (mismo `SheetContent side="left"` con el nav existente).
- Renderizar `<MobileBottomBar />` justo antes de cerrar el shell, fuera del `<main>`.
- Añadir `pb-20 md:pb-0` al `<main>` para que la barra no tape el contenido.

### 3. `ObraShell.tsx`

- Eliminar la `nav` bottom bar actual (ahora la maneja `AppShell`).
- Quitar el `pb-24` del `<main>` (lo aporta el AppShell).
- Conservar el header con "← Obras" para el botón de salida en móvil.

### 4. Lista de módulos de obra para el bottom bar

Crear un export `OBRA_QUICK_NAV` en `src/lib/modules.ts` con las 4 entradas principales (Resumen, Estimaciones, Tareas, Almacén) y `OBRA_MORE_MODULES` con el resto, para alimentar el Sheet "Más" dentro de obra.

## Resultado

- **Desktop**: sin cambios visibles. Sidebar siempre presente.
- **Móvil corporativo**: barra inferior con Dashboard / Obras / Catálogos / Config / Más.
- **Móvil dentro de obra**: la misma barra inferior cambia a Resumen / Estimaciones / Tareas / Almacén / Más, sin duplicación, sin perder la posibilidad de regresar a otros módulos vía "Más".
- Header móvil se limpia (sin hamburguesa).
