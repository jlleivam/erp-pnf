## Alcance confirmado

El módulo **Condensado semanal** mantiene el contenido que ya tiene, sin agregar ingresos, matriz concepto×obra, pendientes accionables ni exportación.

## Contenido de la página

1. **Encabezado**: título + descripción corta.
2. **Selector de semana** (lunes–domingo) con navegación anterior / siguiente / hoy y filtro "solo conceptos con saldo pendiente".
3. **KPIs de la semana**: Devengado, Pagado, Pendiente de pago.
4. **Desglose por obra + oficina** (acordeón, uno por obra activa con movimiento y uno para "Oficina"):
   - Subtotales por obra: Devengado y Pagado.
   - Tabla de subtotales por concepto: Nómina obra, Nómina oficina, Destajos, Subcontratos, Rentas, Gasolinas, Caja chica, Insumos/CxP proveedor, Gastos oficina, Otros — con Devengado, Pagado y Pendiente.
   - Detalle expandible por concepto: fecha, folio, concepto, detalle, beneficiario, devengado, pagado.

## Corrección pendiente (bloqueante)

La página crashea con `` `Tooltip` must be used within `TooltipProvider` `` porque `TruncatedCell` usa Radix Tooltip y no hay un `TooltipProvider` global.

- Editar `src/routes/__root.tsx`: importar `TooltipProvider` desde `@/components/ui/tooltip` y envolver `<Outlet />` (y `<Toaster />`) con `<TooltipProvider delayDuration={200}>` dentro de `RootComponent`. Esto arregla el condensado y previene el mismo error en el resto de la app.

Sin cambios de lógica, datos, ni de contenido del módulo.