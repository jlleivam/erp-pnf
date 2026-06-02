## Problema

El módulo de gestión de equipo ya está implementado en `src/routes/_authenticated/app.equipo.tsx` (listar miembros, crear cuenta, editar roles, remover). Sin embargo, la pestaña **Equipo** dentro de `/app/configuracion` muestra un `ModulePlaceholder` con "Próximamente" en vez del módulo real.

## Solución

Refactor mínimo, sólo presentación — sin tocar lógica ni server functions.

### 1. Extraer el contenido de `app.equipo.tsx` a un componente reutilizable

Crear `src/components/equipo/EquipoModule.tsx` que exporte `EquipoModule` con el contenido actual de `EquipoPage` (tabla, diálogos de invitar/editar/remover). Quitar el `<h1>Equipo</h1>` y descripción del header del componente, ya que el header lo provee la página contenedora — dejar sólo el botón "Crear cuenta" alineado a la derecha sobre la tabla.

### 2. Usarlo en la pestaña Equipo de Configuración

En `src/routes/_authenticated/app.configuracion.tsx`, reemplazar el `<ModulePlaceholder>` del `TabsContent value="equipo"` por `<EquipoModule />`.

### 3. Mantener (o eliminar) la ruta `/app/equipo`

Dejar `app.equipo.tsx` apuntando al mismo `EquipoModule` (con su header propio) para no romper enlaces existentes en el sidebar/navegación. Es un cambio de una línea: el componente de la ruta importa y renderiza `EquipoModule` envuelto en el header de página.

## Archivos afectados

- **Crear**: `src/components/equipo/EquipoModule.tsx`
- **Editar**: `src/routes/_authenticated/app.configuracion.tsx` (importar y usar `EquipoModule`)
- **Editar**: `src/routes/_authenticated/app.equipo.tsx` (reducir a wrapper que usa `EquipoModule`)

No hay cambios de base de datos, server functions, ni RLS.
