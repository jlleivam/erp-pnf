## Cambio: capturar sueldo semanal, mostrar diario calculado

En `src/components/trabajadores/TrabajadorFormDialog.tsx`, reemplazar el input de "Sueldo diario (MXN)" por dos campos lado a lado dentro de la misma celda del grid:

- **Sueldo semanal (MXN)** — input numérico editable. Es el valor que captura el usuario.
- **Sueldo diario (MXN)** — campo de solo lectura (`readOnly`, estilizado como muted) que muestra `semanal / 6` con 2 decimales.

### Detalles

- El estado interno sigue siendo `sueldo_diario` (la BD y el resto del sistema —nómina, snapshots, listados— no cambian).
- Se agrega un estado local derivado `sueldoSemanal`. Al editarlo se hace `set("sueldo_diario", semanal / 6)`. Si se abre en modo edición con un `sueldo_diario` existente, se inicializa `sueldoSemanal = sueldo_diario * 6`.
- La validación obligatoria en modo solicitud sigue exigiendo `sueldo_diario > 0` (indirectamente valida que se capturó el semanal). El asterisco rojo `<Req />` se mueve a la etiqueta de "Sueldo semanal".
- La leyenda de campos obligatorios ya existente no cambia.

No hay otras "solicitudes de alta de trabajadores": `TrabajadorFormDialog` es el único formulario usado tanto por residentes (solicitud) como por admin (alta directa), así el cambio cubre todos los casos.

### Fuera de alcance

- Migraciones de BD: se conserva `sueldo_diario` como fuente de verdad.
- Vistas de nómina, detalle de trabajador y listados: siguen mostrando "/día" como hoy.