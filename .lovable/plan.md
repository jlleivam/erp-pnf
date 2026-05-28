# Mostrar módulos en el dashboard principal (`/app`)

Hoy `/app` solo muestra obras. Agregaré, debajo de la lista de obras, una vista de "Módulos disponibles" filtrada por el rol del usuario, para que cada quien vea de un vistazo a qué tiene acceso (aunque la mayoría sean placeholders "Próximamente").

## Cómo se verá

Estructura nueva en `/app`, en este orden:

1. **Obras** (lo que ya existe, sin cambios)
2. **Administración** — tarjetas con los 13 módulos administrativos (solo visible para Director y Administrativo)
3. **Configuración** — tarjetas con Facturación, Equipo, Otras (solo Director)

Cada tarjeta de módulo:
- Ícono + nombre del módulo
- Badge "Próximamente" en gris para los placeholder, sin badge para los que ya funcionan (ej. Clientes, Equipo)
- Hover sutil; click navega al módulo (o muestra la página placeholder que ya existe)
- Grid responsivo: 2 col móvil, 3 col tablet, 4 col desktop

Los módulos *de obra* (Estimaciones, Nómina, etc.) NO se incluyen aquí porque dependen de una obra específica — siguen viviendo dentro del detalle de cada obra.

## Filtrado por rol

- **Director**: ve Obras + Administración + Configuración
- **Administrativo**: ve Obras + Administración
- **Residente / Auxiliar / Supervisor**: solo ven Obras (igual que hoy)

Respeta el "Asumir rol" del header (usa `useAuthStore` con `assumedRole` ya implementado).

## Cambios técnicos

- Editar `src/routes/_authenticated/app.index.tsx`:
  - Mantener bloque actual de obras
  - Agregar secciones nuevas debajo, condicionadas por rol
  - Reusar la lista `ADMIN_MODULES` (extraerla a `src/lib/modules.ts` para compartir entre `AppShell` y dashboard)
- Crear `src/lib/modules.ts` con las constantes de módulos (admin + configuración) e íconos lucide por módulo
- `AppShell.tsx`: importar la lista desde el nuevo archivo (sin cambios de comportamiento)

Sin cambios de backend, base de datos ni lógica de negocio. Es puramente UI.
