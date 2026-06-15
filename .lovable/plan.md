## Ajustar tabla de subcontratos sin scroll horizontal

### Problema
La tabla de subcontratos genera scroll horizontal en viewports de ~766 px porque las columnas de texto (Subcontrato, Contratista) se expanden según su contenido y la tarjeta contenedora tiene `overflow-x-auto`.

### Solución
1. **Eliminar `overflow-x-auto`** de la Card que envuelve la tabla.
2. **Agregar `table-fixed`** al `<table>` para que las columnas respeten anchos explícitos y no se expandan por contenido.
3. **Definir anchos fijos** en los `<th>`:
   - `#`: `w-8` (oculta en pantallas pequeñas con `hidden md:table-cell`)
   - Subcontrato: `w-[22%]`
   - Contratista: `w-[26%]`
   - Estatus: `w-[15%]`
   - Contratado: `w-[15%]`
   - Pagado: `w-[15%]`
   - Acciones: `w-[7%]`
4. **Botón "Abrir" como ícono solamente** en pantallas pequeñas (`hidden sm:inline` en el texto), reduciendo el ancho de la columna de acciones.
5. **Truncar todo texto** con `truncate` en Subcontrato y Contratista para evitar desbordes.

No hay cambios de datos ni lógica, solo presentación.