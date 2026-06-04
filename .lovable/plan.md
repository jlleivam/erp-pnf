## Eliminar sección Administración del dashboard del director

### Objetivo
Quitar del dashboard principal (`/app`) la sección "Administración — Módulos administrativos a nivel empresa" que actualmente muestra todos los módulos como "Pronto" (no disponibles).

### Cambio técnico

En `src/routes/_authenticated/app.index.tsx`:

1. Eliminar el bloque condicional `{showAdmin && (...)}` que renderiza la sección de Administración (líneas ~78-84).
2. Limpiar imports: quitar `ADMIN_MODULES` del import de `@/lib/modules`.
3. Limpiar variables no usadas: quitar `const showAdmin = ...` y el hook `useEffectiveRoles` si ya no se usa en otra parte del componente.
4. Verificar que `ModuleEntry` sigue siendo necesario (sí, lo usa `CONFIG_MODULES` vía `ModuleSection`).

### Resultado esperado
El dashboard del director solo mostrará:
- Sección de **Obras** (existente)
- Sección de **Configuración** (existente)

La sección **Administración** desaparece por completo.