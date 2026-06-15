### Objetivo
Que los montos de las columnas Contratado, Estimado y Pagado en la tabla de subcontratos se vean completos, sin truncamiento con "..."

### Diagnóstico
- La tabla usa `table-fixed`, lo que fuerza anchos fijos a las columnas.
- Las columnas monetarias tienen asignados solo 11-12% del ancho (Ej: en ~730px de viewport son ~80-90px).
- Las celdas monetarias tienen la clase `truncate`, que corta el texto con "..." cuando no cabe.
- Un monto formateado como "$32,700.00" + el porcentaje adjunto ("· 45%") requiere ~120-170px, mucho más de lo asignado.

### Cambios propuestos
1. **Quitar `table-fixed`** de la tabla para que el navegador ajuste el ancho de cada columna según su contenido real.
2. **Quitar `truncate`** de las celdas monetarias (`<td>` de Contratado, Estimado y Pagado) para que los montos se muestren completos.
3. **Agregar `whitespace-nowrap`** a esas mismas celdas y a sus encabezados (`<th>`) para evitar que los números se rompan en varias líneas.
4. **Controlar el ancho de las columnas de texto** (Subcontrato y Contratista) agregando `max-w-[200px]` a los `<p>` internos, para que sigan truncándose si son muy largos y no desborden la tabla.
5. **Opcional:** si la tabla resulta más ancha que la pantalla, envolverla en un contenedor con `overflow-x-auto` para permitir scroll horizontal sin perder información.

### Archivo a modificar
- `src/components/subcontratos/SubcontratosModule.tsx`

### Sin cambios en
- Backend (`subcontratos.functions.ts`)
- Ningún otro componente o flujo de permisos