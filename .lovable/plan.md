## Objetivo

Resaltar en amarillo claro todo lo que fue ajustado desde el panel global de nómina: las celdas editadas en el detalle del trabajador y el renglón completo del trabajador en la tabla principal.

## 1. Token de diseño

En `src/styles.css`, agregar un par de tokens semánticos para "editado/ajustado" (amarillo claro), en `:root`, en `.dark` (versión ámbar apagada para no deslumbrar en modo oscuro) y registrarlos en `@theme inline`:

- `--edited` — fondo amarillo claro
- `--edited-foreground` — texto legible sobre ese fondo
- `--edited-border` — borde ámbar sutil para el contorno de la celda

Esto permite usar `bg-edited`, `text-edited-foreground` y `border-edited-border` sin hardcodear colores.

## 2. Celdas editadas (imagen 1)

En `src/components/nomina/NominaAdminPanel.tsx`, dentro del detalle del trabajador:

- La celda ajustada pasa de `bg-primary/5` a fondo `bg-edited` con texto `text-edited-foreground`, borde inferior/anillo `border-edited-border` y el ícono de lápiz en el mismo tono, para que se lea claramente como "editado".
- Se conserva el tooltip actual con fecha, valores originales y motivo.
- El hover de celdas editables no debe pisar el amarillo: se ajusta para que la celda editada mantenga su color.

## 3. Renglón del trabajador (imagen 2)

En la tabla principal del panel global:

- Calcular por trabajador si tiene al menos una asistencia con `ajustado_at` en cualquiera de sus obras.
- Si la tiene, sombrear todo el renglón con el mismo amarillo claro (`bg-edited`), respetando la precedencia: si el trabajador tiene duplicados sin resolver, gana el rojo (`bg-destructive/5`) porque es un estado que bloquea el pago.
- Agregar un ícono de lápiz pequeño junto al nombre, con tooltip "Ajustado desde el panel global", para que el amarillo tenga explicación.

## 4. Leyenda

Debajo de la tabla principal, una leyenda compacta de dos marcas de color: rojo = días duplicados por cuadrar, amarillo = asistencia ajustada por administración.

## Fuera de alcance

- No cambia lógica de negocio, permisos ni el backend.
- No se toca la pestaña de pagos.
