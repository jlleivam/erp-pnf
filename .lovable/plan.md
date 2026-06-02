# Fix: el destajo no permite capturar conceptos

## Diagnóstico

El sheet **"Presupuesto de destajo"** se abre sin permitir edición (sin botones "Agregar renglón" ni "Guardar borrador" y con los inputs deshabilitados) porque `getDestajoPresupuesto` falla en silencio.

La query usa un *embed* de PostgREST:

```ts
.from("obra_destajo_presupuestos")
.select("*, obra_destajos!inner(...)")
```

Pero la migración del módulo de destajos creó **todas** las tablas sin **ningún** `FOREIGN KEY`:

- `obra_destajos.obra_id`, `company_id`, `destajista_id`, `creado_por`
- `obra_destajo_presupuestos.destajo_id` (+ creado_por/enviado_por/autorizado_por/rechazado_por)
- `obra_destajo_renglones.presupuesto_destajo_id`
- `obra_destajo_trabajadores.destajo_id`, `trabajador_id` (+ asignado_por/desasignado_por)
- `obra_destajo_estimaciones.destajo_id`, `company_id` (+ creado_por/cerrada_por)
- `obra_destajo_estimacion_renglones.estimacion_id`

Sin FKs, PostgREST no puede resolver los embeds (`obra_destajos!inner(...)` se usa en varios server functions: `getDestajoPresupuesto`, asignación de trabajadores, payroll lock, etc.), la consulta lanza error, `data` queda `undefined` y el sheet renderiza el título placeholder con `editable = false`.

Como confirmación: el screenshot muestra "Presupuesto de destajo" (fallback) en lugar de "Presupuesto base" (nombre real en BD), lo que confirma que `presupuesto` no se cargó.

## Solución

Migración que agrega los `FOREIGN KEY` faltantes a las 6 tablas del módulo de destajos, con `ON DELETE` apropiado:

- `CASCADE` para relaciones padre→hijo internas del módulo (destajo→presupuestos→renglones; destajo→estimaciones→renglones; destajo→trabajadores).
- `CASCADE` desde `obras` y `companies` (consistente con el resto del esquema).
- `RESTRICT` para `destajista_id → trabajadores` y `trabajador_id → trabajadores` (no borrar un trabajador con destajos asignados).
- `SET NULL` para columnas opcionales de auditoría (`enviado_por`, `autorizado_por`, `rechazado_por`, `desasignado_por`, `cerrada_por`).
- Auditoría obligatoria (`creado_por`, `asignado_por`) → `REFERENCES auth.users(id)` sin `ON DELETE` especial.
- Para `obra_destajo_estimacion_renglones` se mantiene `renglon_clave` como texto (no FK) ya que apunta a una clave WBS reconstruida, no a un renglón concreto.

Adicionalmente, ejecutar `NOTIFY pgrst, 'reload schema'` al final para que PostgREST detecte de inmediato las nuevas relaciones.

## Resultado esperado

- Embed `obra_destajos!inner(...)` y demás se resuelven.
- `getDestajoPresupuesto` regresa `{ presupuesto, renglones }`.
- El sheet muestra el título correcto, habilita los inputs y muestra los botones "Agregar renglón" / "Guardar borrador".
- También se arreglan implícitamente la asignación de trabajadores y el lock en nómina, que dependen del mismo embed.

## Sin cambios de código de aplicación

No se tocan los server functions ni los componentes; basta con la migración de FKs.
