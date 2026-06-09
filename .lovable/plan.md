# Plan: Compactar la pantalla de Destajos

Objetivo: dar protagonismo a la lista (un destajo por renglón) reduciendo el espacio del header y de las tarjetas de totales.

## Cambios en `src/components/destajos/DestajosModule.tsx`

1. **Header más compacto**
   - Reducir título a `text-xl` y quitar el párrafo descriptivo ("Subcontratación a trabajadores propios…").
   - Mantener el botón "Nuevo destajo" alineado a la derecha en la misma fila.
   - Reducir `space-y-6` a `space-y-4`.

2. **KPIs en una sola fila compacta**
   - Reemplazar las 3 `Card` grandes (`p-4`, valor `text-xl`) por una sola tarjeta horizontal con 3 columnas separadas por divisores:
     - Padding `p-3`, label `text-[11px]`, valor `text-base font-semibold`.
   - Esto baja la altura del bloque KPIs de ~110px a ~56px.

3. **Tabla: forzar un destajo por renglón**
   - En `<td>` de "Destajo": quitar la descripción debajo del nombre (o mostrarla en `truncate` con `title`) para evitar wrap a 2 líneas.
   - En `<td>` de "Destajista": añadir `whitespace-nowrap` (evita que "Mario Sánchez García" rompa en 3 líneas).
   - En `<td>` de "Estatus": el `Badge` con `whitespace-nowrap` para que "Por autorizar" quepa en una línea.
   - Reducir padding de celdas de `p-3` a `py-2 px-3`.

## No se toca
- Lógica, queries, server functions, permisos.
- Otros archivos.

## Resultado esperado
Header + KPIs ocupan ~⅓ de lo actual; cada destajo se ve en un solo renglón de la tabla.
