En `src/components/nomina/NominaModule.tsx`, dentro de `NuevaNominaDialog`:

- Eliminar el campo `Fecha` (Label + Input type="date").
- Fijar internamente la fecha a hoy (`toISODate(new Date())`) sin estado editable.
- Mantener el recuadro "Semana asignada" como informativo, mostrando la semana calculada para hoy.
- Conservar el aviso si ya existe nómina para esa semana, y los botones Cancelar / Continuar.

Sin cambios en lógica de negocio ni en server functions.