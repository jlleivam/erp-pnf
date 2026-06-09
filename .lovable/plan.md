# Ajustes de tabla de Nómina

## Cambios en `src/components/nomina/NominaModule.tsx`

- **Columna `Semana`**: dejar de ser angosta. Quitar wraps a 3 líneas usando `whitespace-nowrap` y permitir que tome el ancho restante. Alineación a la izquierda (texto y encabezado).
- **Resto de columnas centradas**: `#`, `Estatus`, `Trabajadores`, `Monto`, `Acciones` quedan centradas tanto en `<th>` como en `<td>`. El badge de estatus y los botones de acciones se centran con `justify-center`.
- **Reducir anchos** de las columnas de poco contenido:
  - `#` → `w-12`
  - `Estatus` → `w-24`
  - `Trabajadores` → `w-24`
  - `Monto` → `w-32` (manteniendo `tabular-nums`)
  - `Acciones` → `w-40`
- `Semana` no fija ancho (toma el resto) y se queda como única alineada a la izquierda.

No hay cambios de backend ni de permisos. Sigue siendo un solo renglón por semana.