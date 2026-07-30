# Avisar al residente cuando el administrativo ajusta su nómina

## Situación actual (verificado)

Hoy **no hay ningún aviso**. Cuando el administrativo ajusta la asistencia desde el panel global:

- Se guarda la bitácora del ajuste (valor original, quién ajustó, cuándo y el motivo).
- **No** se crea ninguna notificación: no existe ningún tipo de notificación de nómina en el catálogo.
- La pantalla "Nómina semanal" del residente ya recibe los datos del ajuste desde el servidor, pero **no los muestra**: los días editados se ven iguales que los demás, sin resaltado ni motivo.

## Qué construir

### 1. Notificación al residente
- Nuevo tipo de notificación "Nómina ajustada por administración" (activada por defecto para residente y director).
- Al guardar un ajuste, se envía al residente de la obra: título con la obra y la semana, mensaje con el trabajador, el día, el cambio (de → a) y el motivo. El enlace lleva directo a la nómina de esa obra.
- Se agrupan los ajustes del mismo trabajador/semana para no saturar: si ya existe una notificación no leída de esa nómina, se actualiza en vez de crear otra.

### 2. Señal visual en la nómina del residente
- Las celdas de días ajustados se sombrean con el amarillo tenue ya usado en el panel global, con ícono de lápiz.
- Al pasar el cursor / tocar la celda: "Ajustado por administración · valor original X · motivo".
- Aviso arriba de la tabla cuando la semana tiene ajustes: "Esta nómina fue ajustada por administración (N cambios)".

## Detalles técnicos

- `src/lib/notificaciones/catalogo.ts`: agregar `nomina_ajustada` (defaults director + residente).
- `src/lib/api/nominas.functions.ts` → `ajustarAsistenciaAdmin`: tras recalcular, resolver residentes de la obra vía `obra_team` e insertar en `notificaciones` respetando `notificacion_preferencias`, siguiendo el patrón ya usado en otros módulos.
- `src/components/nomina/CapturaNominaSheet.tsx`: usar `ajustado_at` / `jornada_original` / `ajuste_motivo` (ya vienen en la consulta) para el resaltado, tooltip y banner; reutilizar los tokens `--edited` de `src/styles.css`.
