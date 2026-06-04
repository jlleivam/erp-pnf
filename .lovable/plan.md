## Plan: Eliminar sección Configuración del dashboard del director

### Objetivo
Quitar del dashboard principal (`/app`) la sección "Configuración" que muestra los módulos de Facturación, Equipo y Otras opciones.

### Cambio técnico

En `src/routes/_authenticated/app.index.tsx`:

1. Eliminar el bloque condicional `{director && (<ModuleSection title="Configuración" ... />)}` (líneas 79-85).
2. Limpiar imports: quitar `CONFIG_MODULES` y `type ModuleEntry` del import de `@/lib/modules`.
3. Evaluar si `ModuleSection` queda sin uso — en ese caso eliminar la función también.
4. Verificar si `Construction` de `lucide-react` sigue siendo necesario (solo se usa dentro de `ModuleSection`).

### Resultado esperado
El dashboard del director solo mostrará:
- Sección de **Obras** (existente)

Las secciones **Administración** y **Configuración** desaparecen por completo.