## Cambio

En el sheet de detalle del proveedor (al hacer click en un renglón de Cuentas por pagar → Proveedores OC), agregar un botón **"Registrar pago"** por cada OC con saldo pendiente, que abra el diálogo `RegistrarPagoOCDialog` directamente — el mismo módulo de pago que se usa en la pestaña OCs de la requisición (imagen 1).

### Archivos

1. **`src/components/pagos/CuentasPorPagarModule.tsx`** (componente `ProveedorDetalleSheet`, líneas 272–360):
   - Importar `RegistrarPagoOCDialog` y `useQueryClient`.
   - Agregar estado local `pagarOC` con `{ id, folio, pendiente }`.
   - Añadir columna **"Acción"** en la tabla de OCs; mostrar botón "Registrar pago" cuando `pend > 0`.
   - Al guardar, invalidar `["saldos-proveedores"]` y `["saldo-proveedor", proveedorId]` para refrescar saldos.
   - Renderizar `<RegistrarPagoOCDialog>` cuando `pagarOC` esté seteado.

### Fuera de alcance

- No se cambia el comportamiento del click en la fila del proveedor (sigue abriendo el sheet de detalle).
- No se modifica la pestaña Anticipos de destajo.
- No se altera `RegistrarPagoOCDialog` ni server functions.

### Por qué no navegar a la requisición

Un proveedor puede tener múltiples OCs en distintas obras/requisiciones, por lo que el click en el renglón del proveedor es ambiguo para una sola navegación. Mantener el sheet con OCs listadas y un botón "Registrar pago" por OC abre exactamente el mismo formulario de pago que se usa en la vista de requisición.
