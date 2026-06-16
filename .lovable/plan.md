# Plan: Abrir detalle de renta en pestaña Cotización para el administrativo

## Cambios

1. **`src/components/rentas/RentaDetalleSheet.tsx`**
   - Agregar prop opcional `defaultTab?: string` al componente.
   - Cambiar `<Tabs defaultValue="vigencia">` a `<Tabs defaultValue={defaultTab ?? "vigencia"}>`.

2. **`src/components/rentas/RentasModule.tsx`**
   - Calcular `defaultTab` antes de renderizar `RentaDetalleSheet`: `"cotizacion"` si `isAdministrativo`, de lo contrario `"vigencia"`.
   - Pasar `defaultTab` como prop a `<RentaDetalleSheet />`.

## Alcance
Solo cambia la pestaña inicial del Sheet de detalle según el rol del usuario. Sin cambios en permisos, backend ni flujo de negocio.