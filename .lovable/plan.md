## Contexto
En el modal de "Solicitar fondo de caja chica" el residente debe poder ver el monto base (tope) que el director asignó a la obra, y el monto disponible que aún puede solicitar, para que no tenga que adivinar cuánto pedir.

## Cambios

### 1. `CajaChicaModule.tsx`
- Pasar los datos del saldo (`montoBase`, `disponible`) al componente `SolicitarFondoDialog` como nuevas props.

### 2. `SolicitarFondoDialog.tsx`
- Agregar props `montoBase?: number` y `disponible?: number`.
- Mostrar un bloque informativo sobre el monto base y disponible, usando el formato de moneda existente.
- Actualizar la descripción del modal: "Tu supervisor autorizará la solicitud antes de que el administrativo realice el pago."
- Agregar `max={disponible}` al input de monto solicitado para prevenir valores mayores.
- Deshabilitar el botón "Solicitar" si `disponible <= 0` y mostrar un mensaje informativo.