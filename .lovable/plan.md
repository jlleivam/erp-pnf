## Objetivo

Compactar el encabezado de filtros del catálogo de proveedores/contratistas para que quepa en una sola fila en anchos típicos de escritorio, sin scroll horizontal.

## Cambios en `src/components/terceros/CatalogoTerceroModule.tsx`

1. Reducir padding de la Card contenedora: `p-4` → `p-3`, `gap-3` → `gap-2`.
2. Quitar el `flex-wrap` para forzar una sola fila (`flex items-center gap-2`).
3. Reducir altura de inputs/selects a `h-9` y aplicar `text-sm`.
4. Buscador: bajar `min-w-64` a `min-w-[200px]` y mantener `flex-1` para que absorba el espacio disponible.
5. Selects: reducir anchos (`w-44` → `w-40`, `w-48` → `w-44`) y agregar `shrink-0` para que no se compriman.
6. En pantallas muy angostas (<640 px), permitir wrap como fallback: usar `flex-wrap sm:flex-nowrap` para no romper en móvil.

## Fuera de alcance

- No se cambia la lógica de filtrado ni las opciones disponibles.
- No se toca la tabla ni otros módulos.
