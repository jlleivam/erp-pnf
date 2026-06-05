## Compactar bloque de insumo en "Nueva requisición"

Archivo: `src/components/requisiciones/NuevaRequisicionSheet.tsx`

### Cambios
- Tipografía global del bloque a `text-xs`; labels `text-[11px]` y `mb-0.5`.
- Padding del card: `p-3` → `p-2.5`; espaciado interno `space-y-3` → `space-y-2`.
- Inputs / Select / botón de fecha con altura `h-8` y `text-xs`.
- Una sola fila con: Cantidad, Unidad y Fecha requerida (`grid-cols-[1fr_1fr_1.4fr]`), eliminando filas separadas.
- Nota opcional: `Textarea rows={1}` con `min-h-[32px] text-xs resize-none`, label inline más chico.
- Header "Insumo N" + botón eliminar más compactos (botón `h-6 w-6 p-0`).
- Espacio entre bloques `space-y-4` → `space-y-3`.
- Sin cambios en lógica, validación ni envío.