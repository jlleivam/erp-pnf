## Objetivo
Agregar un indicador de carga prominente y bloqueante cuando se está importando un PDF en la ventana "Presupuesto base", evitando que el usuario cierre o interactúe con la pantalla mientras dura el proceso.

## Cambios propuestos

### `src/components/presupuesto/CapturaPresupuestoSheet.tsx`

1. **Overlay de carga bloqueante**
   - Renderizar un overlay a pantalla completa dentro del `SheetContent` cuando `parsingPdf` (o también `parsing` para Excel) esté activo.
   - El overlay usará `fixed inset-0 z-50`, fondo semitransparente (`bg-background/80` o similar semántico) y `pointer-events-auto` para capturar clicks.
   - Centrar un spinner animado (usar `Loader2` de lucide-react o reutilizar patrón existente) y un mensaje descriptivo: "Analizando PDF, por favor no cierres esta ventana..."

2. **Prevenir cierre accidental**
   - Modificar `onOpenChange` del `Sheet` para que ignore intentos de cierre mientras `parsingPdf` o `parsing` sean `true`.
   - Esto evita que el usuario cierre el sheet desde la X o haciendo click fuera.

3. **Deshabilitar controles internos**
   - Asegurar que los botones "Cerrar", "Guardar borrador" y "Guardar y autorizar" estén deshabilitados durante la importación (ya existen condiciones parciales, consolidar).
   - Asegurar que no se puedan editar celdas de la tabla mientras se analiza el PDF.

4. **Reutilizar estado existente**
   - Usar los estados actuales `parsing` e `parsingPdf`; no agregar nuevos estados si no es necesario.
   - Mostrar el overlay para cualquiera de los dos procesos de importación (Excel y PDF), ya que ambos son operaciones de parseo que no deberían interrumpirse.

## Fuera de alcance
- Sin cambios en backend ni en la lógica de extracción del PDF (`parsearPdfPresupuesto`).
- Sin cambios en el flujo de guardado o autorización.
- Sin cambios en la tabla editable fuera del estado de carga.