# Configuración de empresa exclusiva para director + Equipo como pestaña

## 1. Restringir ruta `/app/configuracion` a directores
**Archivo:** `src/routes/_authenticated/app.configuracion.tsx`
- Agregar hook `useEffectiveIsDirector` desde `@/stores/auth`.
- Agregar `useNavigate` y `useEffect`.
- Si `!director`, redirigir a `/app` y retornar `null`.

## 2. Limpiar menú desktop (sidebar)
**Archivo:** `src/components/AppShell.tsx`
- Quitar import `UserCog` de `lucide-react`.
- Quitar el `NavItem` de "Equipo" del sidebar corporativo (líneas 149-151).
- Envolver el `NavItem` de "Configuración" con `{director && (...)}` para que solo lo vean directores.

## 3. Limpiar menú móvil (bottom bar)
**Archivo:** `src/components/AppShell.tsx`
- Construir el array de items dinámicamente.
- Quitar "Equipo".
- Solo incluir "Config" cuando `director === true`.

## 4. Limpiar header (botón redundante)
**Archivo:** `src/components/AppShell.tsx`
- Quitar el botón "Configuración" del header (líneas 209-214) por redundante; ya queda accesible desde el menú lateral/inferior para directores.

## Resultado
- **Director desktop:** Sidebar Corporativo = Dashboard, Catálogos, Nueva obra, Configuración.
- **Director móvil:** Bottom bar = Dashboard, Catálogos, Config.
- **No-director desktop:** Sidebar Corporativo = Dashboard, Catálogos. (Sin Configuración ni Equipo).
- **No-director móvil:** Bottom bar = Dashboard, Catálogos. (Sin Configuración ni Equipo).
- Dentro de Configuración, "Equipo" ya existe como pestaña (`TabsTrigger value="equipo"`).
- Ruta `/app/configuracion` redirige a `/app` si un no-director entra directamente por URL.