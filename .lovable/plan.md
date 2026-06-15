## Unificar tablas de Destajos en Cuentas por Pagar

Hoy la pestaña **Destajos** tiene dos tablas separadas (Estimaciones por pagar y Anticipos pendientes). Como ambos son pagos al mismo destajista, se unifican en una sola tabla con una columna **Tipo** que distinga *Anticipo* vs *Estimación*.

### Resultado visual

Una única tabla "Pagos a destajistas pendientes" con columnas:

```text
Tipo | Folio/Ref | Obra | Destajista | Concepto | Fecha | Total | Pagado | Saldo | Estatus | Acción
```

- **Tipo**: badge "Anticipo" (azul) / "Estimación" (slate).
- **Folio/Ref**: folio CxP para estimaciones; para anticipos, `#N · Nombre destajo`.
- **Concepto**: para anticipos, "Anticipo de destajo" + notas si existen.
- **Total/Pagado/Saldo**: para anticipos, Total = monto solicitado, Pagado = 0, Saldo = monto.
- **Estatus**: "Pendiente" / "Parcial".
- **Acción**: "Registrar pago" abre el diálogo correspondiente según el tipo (`RegistrarPagoAnticipoDialog` o `RegistrarPagoCxPDialog`).

Una sola tarjeta de resumen arriba: **Saldo total** = anticipos + estimaciones. El badge del tab sigue sumando ambos (ya lo hace).

### Cambios

Solo UI, en `src/components/pagos/CuentasPorPagarModule.tsx` dentro de `AnticiposDestajoTab`:

1. Combinar `rows` (anticipos) y `estRows` (estimaciones) en un solo arreglo `unified` con un campo discriminador `tipo: "anticipo" | "estimacion"` y campos normalizados (folio, obra, destajista, concepto, fecha, total, pagado, saldo, estatus).
2. Ordenar por fecha desc (estimaciones tienen `fecha_emision`; anticipos `solicitadoAt`).
3. Renderizar una sola `<Table>` con las columnas listadas; eliminar las dos `<section>` separadas y sus dos `<Card>` de totales — dejar una sola tarjeta de saldo total combinado.
4. Al click en "Registrar pago", según `tipo` se setea `pagar` o `pagarCxP` (los dos diálogos y sus invalidaciones siguen igual).
5. Renombrar el encabezado de la sección a "Pagos a destajistas pendientes" con descripción "Anticipos solicitados y estimaciones autorizadas pendientes de pago.".

No se tocan server functions, base de datos, contabilidad ni el flujo de pago. No se cambia la pestaña de Proveedores (OC).

### Archivos a editar

- `src/components/pagos/CuentasPorPagarModule.tsx`
