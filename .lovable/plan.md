## Objetivo

1. Cambiar el cálculo de horas extras a relación 1:1 con la hora normal de jornada (sin multiplicador).
2. Permitir que el residente capture una **nota obligatoria** que justifique el pago de cada hora extra, visible vía **popover** al hacer click sobre el campo "+h" y mostrada como **tooltip** en consultas posteriores y en el panel administrativo.

## 1. Cálculo de horas extras

**`src/lib/api/nominas.functions.ts`** — `recalcRenglon`:
- Antes: `importeExtras = horas * (sueldo / 8) * mult`
- Después: `importeExtras = horas * (sueldo / 8)`
- Quitar el parámetro `mult` y el argumento `multiplicador_extras` en la única llamada.
- La columna `multiplicador_extras` permanece en la BD por compatibilidad (sin migración para borrarla); deja de influir en el importe.

**`src/components/nomina/CapturaNominaSheet.tsx`** — quitar la prop `multiplicador_extras` del tipo `Renglon` (ya no se usa).

## 2. Nota obligatoria de horas extras

### Base de datos

Migración que agrega `nota_extras text NULL` a `obra_nomina_asistencias`. No requiere cambios en RLS ni grants (heredan los existentes).

### Server function

**`guardarAsistencia`** en `nominas.functions.ts`:
- Aceptar campo opcional `notaExtras: z.string().trim().max(500).nullable().optional()`.
- **Validación**: si `horasExtras > 0` la nota es obligatoria (≥ 3 caracteres después de trim). Si `horasExtras === 0`, se persiste `nota_extras = null`.
- Persistir `nota_extras` en el upsert.

### UI captura (residente)

**`CapturaNominaSheet.tsx` → `DiaCell`**: reemplazar el `<input>` de horas extras por un disparador que abre un `Popover` con:
- Input numérico de horas extras (mismo control actual).
- `Textarea` "Motivo de las horas extras" (requerido cuando horas > 0).
- Botón "Guardar"; el guardado se hace al cerrar el popover (no `onBlur` inline), validando que la nota no esté vacía cuando aplique.
- El disparador muestra el número de horas (o "+h" si 0); cuando hay nota, agrega un pequeño icono `MessageSquare` para indicar que existe explicación; al hacer hover muestra `Tooltip` con la nota en modo lectura.
- Si la nómina está cerrada, el popover/textarea quedan en sólo lectura (tooltip sigue funcionando).

### Panel administrativo

**`NominaAdminPanel.tsx`** y el server fn `getPanelGlobalNomina`:
- Incluir `nota_extras` en el `select` de asistencias por obra.
- En el detalle por trabajador (desglose por día) donde se listan las horas extras, mostrar la nota como `Tooltip` sobre el badge/celda de horas extras.

## Fuera de alcance

- Editar la nota desde el panel administrativo (sólo lectura).
- Historial de cambios de la nota.
- Migración para eliminar `multiplicador_extras` (queda obsoleto pero inocuo).
