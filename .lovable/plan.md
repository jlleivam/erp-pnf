### Objetivo
El módulo de Contabilidad ya existe en la barra lateral de administración (`/app/admin/contabilidad`), pero no aparece en el **menú inferior móvil** que ven los perfiles `administrativo` y `director`.

### Cambio
En `src/components/AppShell.tsx`:
1. Importar el icono `Scale` de `lucide-react`.
2. Agregar el item `{ to: "/app/admin/contabilidad", label: "Contabilidad", icon: Scale }` al array del `MobileBottomBar` que se renderiza cuando `showAdmin` es verdadero (líneas 280-291).

No hay cambios de backend ni de base de datos.