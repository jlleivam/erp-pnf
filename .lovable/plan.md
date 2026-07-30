## Objetivo

Al reabrir una celda que ya fue ajustada, el diálogo "Ajustar asistencia" debe mostrar la información previamente guardada, no un formulario en blanco.

## Situación actual

En `src/components/nomina/NominaAdminPanel.tsx`, el diálogo ya precarga la jornada y las horas extras desde la asistencia, pero el campo **Motivo del ajuste** siempre arranca vacío, aunque en la base ya exista un motivo guardado (`ajuste_motivo`). Eso obliga a reescribirlo cada vez y da la impresión de estar creando un ajuste nuevo.

## Cambio

En `AjusteAsistenciaDialog` (dentro de `NominaAdminPanel.tsx`):

- Inicializar el motivo con el valor guardado: `useState(asistencia?.ajuste_motivo ?? "")`.
- Cuando la celda ya tiene un ajuste previo, mostrar arriba del formulario una línea informativa de solo lectura con:
  - quién/cuándo se ajustó (`ajustado_at`, formateado con `formatDateTime`), y
  - los valores originales previos al primer ajuste (`jornada_original`, `horas_extras_original`).
- Cambiar el título/botón según el caso: "Ajustar asistencia" / "Guardar ajuste" cuando es la primera vez, y "Editar ajuste" / "Actualizar ajuste" cuando ya existe uno.
- Dejar el motivo editable: al guardar se sobrescribe el mismo registro (comportamiento actual del backend), pero partiendo del texto anterior en vez de vacío.

## Fuera de alcance

- No se cambia el backend (`ajustarAsistenciaAdmin` sigue haciendo upsert sobre la misma fila).
- No se agrega bitácora histórica de múltiples ajustes.
