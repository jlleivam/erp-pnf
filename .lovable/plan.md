# Preseleccionar Caja fuerte al pagar fondos de caja chica

## Contexto
El diálogo `RegistrarPagoCxPDialog` se reutiliza para registrar pagos de cuentas por pagar (CxP). Cuando se usa desde la pestaña de **Fondos de caja chica por pagar**, el usuario siempre debe pagar en efectivo desde la cuenta tipo *caja fuerte* (así lo valida el backend). Actualmente el usuario debe seleccionar manualmente la cuenta cada vez.

## Cambios propuestos

### 1. `RegistrarPagoCxPDialog.tsx`
- Agregar prop opcional `defaultCuentaTipo?: "caja_fuerte"`.
- Cuando las cuentas carguen y `defaultCuentaTipo === "caja_fuerte"`, buscar la primera cuenta activa de tipo `caja_fuerte`, asignarla a `cuentaId` y forzar el método de pago a `efectivo`.
- Esto solo aplica al abrir el diálogo (efecto que corre cuando `cuentas` cambian y aún no hay cuenta seleccionada).

### 2. `CajaChicaPorPagarTab.tsx`
- Al renderizar `<RegistrarPagoCxPDialog>`, pasar la nueva prop:
  ```tsx
  <RegistrarPagoCxPDialog
    ...
    defaultCuentaTipo="caja_fuerte"
  />
  ```

## Resultado esperado
Al abrir el diálogo "Registrar pago" desde fondos de caja chica, la cuenta **Caja fuerte** ya viene preseleccionada y el método de pago está en **Efectivo**, sin necesidad de que el usuario interactúe con el selector.