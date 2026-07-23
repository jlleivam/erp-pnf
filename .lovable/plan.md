## Objetivo
Modificar el comportamiento del botón **Agregar renglón** en el presupuesto base para que:
- Inserte el nuevo renglón justo debajo del renglón que el usuario tenga activo/seleccionado.
- Se muestre una indicación visual tenue del renglón activo.
- Si no hay renglón seleccionado, conserve el comportamiento actual (agregar al final).
- El nuevo renglón pase a ser el activo tras insertarse, facilitando insertar varios consecutivos.

## Alcance
Solo el componente `src/components/presupuesto/CapturaPresupuestoSheet.tsx`. No se alteran APIs ni persistencia.

## Cambios planificados
1. **Estado de renglón activo**
   - Agregar `activeRowId: string | null` con `useState`.
   - Inicialmente `null` (sin selección).

2. **Interacción de selección**
   - Hacer que cada `<tr>` responda a `onClick` para activar el `activeRowId`.
   - Evitar que la selección cambie al interactuar con inputs o botón de eliminar dentro de la fila.

3. **Indicador visual activo**
   - Aplicar una clase de fondo tenue (por ejemplo `bg-muted/60`) al renglón cuyo `_id` coincida con `activeRowId`.
   - Preservar los estilos actuales de errores (`bg-destructive/5`) y padres (`bg-accent/40`), dando prioridad a errores y padres sobre el indicador de activo o combinándolos cuidadosamente.

4. **Lógica de inserción**
   - Reemplazar `addRow` por `addRowAfterActive`.
   - Si `activeRowId` existe, insertar una fila vacía en el índice `index + 1`.
   - Si no hay activo, insertar al final (comportamiento actual).
   - Después de insertar, actualizar `activeRowId` al `_id` del nuevo renglón.

5. **Borrado de fila**
   - Si la fila eliminada es la activa, pasar el activo a la fila anterior, a la siguiente o a `null` si era la única.

6. **Validación y verificación**
   - Correr typecheck (`bun run typecheck`) y build de desarrollo para confirmar que no hay errores.
   - Probar en el preview: seleccionar un renglón intermedio, agregar renglón, confirmar que se inserta abajo y que el indicador cambia al nuevo renglón.

## Notas técnicas
- No se agregan dependencias nuevas.
- Se mantiene la funcionalidad de importar Excel/PDF y el overlay de carga existente.
- Se respeta la accesibilidad: los inputs siguen siendo editables y el botón de eliminar sigue operativo.