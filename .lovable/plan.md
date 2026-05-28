Tarea: Agregar botón de acceso rápido a Configuración de la empresa.

Actualmente la ruta `/app/configuracion` existe y tiene un NavItem en el sidebar, pero el usuario no lo encuentra visible. Agregaremos un shortcut adicional en la barra superior (header).

1. En `src/components/AppShell.tsx`, agregar un icono de Settings como botón/link en el header, a la izquierda del menú de usuario/rol. Este icono navegará directamente a `/app/configuracion`.
2. No se modifica la ruta ni el contenido de la página de configuración.
3. No se modifican las migraciones ni el backend.