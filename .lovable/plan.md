
# Detalle granular por categoría en Estado de resultados

Hoy el panel de detalle muestra una lista plana de documentos (ej. "Nómina #3 — $42,000"). Vamos a enriquecerlo para que cada documento se pueda expandir y mostrar sus conceptos internos, mediante acordeones, sin saturar la vista.

## Qué se mostrará por categoría

- **Producción (estimación):** cada estimación con sus renglones (clave, concepto, unidad, cantidad ejecutada, P.U., importe ejecutado).
- **Almacén:** la semana de almacén con la lista de insumos consumidos (nombre, unidad, utilizado, P.U., subtotal).
- **Nómina:** cada nómina con la lista de trabajadores (nombre, días, horas extra, importe total).
- **Destajos:** cada estimación de destajo con sus renglones (concepto, cantidad ejecutada, P.U., importe).
- **Subcontratos:** cada estimación de subcontrato con sus renglones (concepto, cantidad ejecutada, P.U., importe).
- **Rentas:** cada equipo rentado con detalle del prorrateo (días activos en la semana, tarifa diaria efectiva, monto). *(Ya es por equipo, se ajusta el formato.)*
- **Gasolinas:** vales (folio, tipo de combustible, descripción, monto). *(Ya es por vale, sin sub-detalle, no requiere acordeón.)*
- **Caja chica:** cada gasto reembolsado (concepto, descripción, tipo de comprobante, fecha, monto).

## UX

- El sheet de detalle conserva el encabezado (categoría + rango de semana).
- Cada documento queda dentro de un `Accordion` (collapsed por defecto). El trigger muestra: título + estatus + monto total. Al abrir, se despliega una tabla compacta con los conceptos.
- Categorías sin sub-detalle natural (gasolinas) seguirán como tarjetas simples.
- En la tarjeta resumen "Producción ejercida" del módulo, al hacer clic se abre el mismo sheet con las estimaciones de la semana y sus renglones expandibles.

## Detalles técnicos

- En `src/lib/api/estado-resultados.functions.ts`:
  - Ampliar el tipo `DocumentoCosto` para incluir `conceptos?: ConceptoDetalle[]` opcional.
  - Definir `ConceptoDetalle = { id, descripcion, cantidad?, unidad?, precio_unitario?, monto, meta?: string }`.
  - En `calcularBuckets`, además de los selects actuales:
    - **Producción:** ya se traen los renglones de `obra_estimacion_renglones` (hoy solo se suman). Guardarlos por estimación para devolverlos como `conceptos`.
    - **Almacén:** traer `almacen_movimientos_semana` con join a `insumos(nombre, unidad)` y mapear cada movimiento utilizado > 0 como concepto.
    - **Nómina:** traer `obra_nomina_renglones` con join a `trabajadores(nombre)` por las nóminas de la semana; cada renglón → concepto.
    - **Destajos / Subcontratos:** traer `obra_destajo_estimacion_renglones` / `obra_subcontrato_estimacion_renglones` por las estimaciones de la semana; cada renglón → concepto.
    - **Rentas:** mantener cada equipo como un `DocumentoCosto` con `conceptos` = un único concepto resumen (días × tarifa diaria = monto).
    - **Caja chica:** cada gasto sigue siendo un `DocumentoCosto`; sus campos extra (`descripcion`, `tipo_comprobante`, `fecha`) se exponen en `meta`/sub-línea.
  - Para no inflar el payload, los selects de detalle se filtran por los IDs de la semana visible (la función `getEstadoResultadosSemana` ya pide solo 1 semana; el histórico de 8 semanas no necesita el detalle, así que ese branch sigue sin traer renglones).

- En `src/components/estado-resultados/EstadoResultadosModule.tsx`:
  - Reemplazar la lista del sheet por un `Accordion` de shadcn (`type="multiple"`).
  - Crear un sub-componente `<ConceptoTabla items={conceptos} />` para renderizar la tabla compacta dentro de cada accordion item.
  - Mantener el "Sin movimientos en esta semana" para listas vacías.

- Sin migraciones de BD. Sin cambios al cálculo de totales.

## Fuera de alcance

- Edición desde el detalle (sigue siendo de solo lectura).
- Links a los módulos de origen (se pueden añadir después).
- Exportar el desglose a Excel/PDF.
