## Objetivo

Bajar la intensidad del amarillo que marca las asistencias y renglones ajustados en el panel global de nómina.

## Cambio

Único archivo: `src/styles.css` (tokens semánticos, sin tocar componentes).

Tema claro:
- `--edited`: de `oklch(0.95 0.09 95)` a `oklch(0.975 0.035 95)` — fondo apenas teñido.
- `--edited-border`: de `oklch(0.83 0.13 90)` a `oklch(0.90 0.06 90)` — borde más discreto.
- `--edited-foreground`: se mantiene oscuro para conservar contraste del texto y del ícono de lápiz.

Tema oscuro:
- `--edited`: de `oklch(0.34 0.06 90)` a `oklch(0.28 0.035 90)`.
- `--edited-border`: de `oklch(0.48 0.09 90)` a `oklch(0.38 0.05 90)`.

## Nota técnica

Como `NominaAdminPanel.tsx` ya usa `bg-edited` / `ring-edited-border`, el ajuste se propaga a las celdas del detalle, al renglón del trabajador y a la leyenda sin editar componentes.
