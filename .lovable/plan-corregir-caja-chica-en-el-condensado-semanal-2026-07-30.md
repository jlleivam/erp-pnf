# Corregir "Caja chica" en el Condensado semanal

## Qué está pasando

Tienes razón: lo que aparece hoy bajo el concepto "Caja chica" es la **entrega del fondo al residente**, no un gasto.

Lo verifiqué en la base: existe una sola cuenta por pagar con origen `caja_chica_fondo` por $3,500 con concepto "Fondo de caja chica". El condensado agrupa **todas** las CxP de la semana por su origen, así que ese movimiento se cuenta como devengado y su pago como salida de la obra.

Contablemente eso es un traspaso de activo (caja fuerte → caja chica del residente, 1110 → 1120). No es costo de obra. El costo real ocurre cuando el residente **comprueba gastos** (los gastos de caja chica aprobados), y la reposición sólo repone el fondo.

## Qué se va a cambiar

1. **Sacar la entrega/reposición de fondo del gasto**: las CxP con origen `caja_chica_fondo` dejan de sumar a Devengado y Pagado del condensado y del total de la obra.

2. **Mostrarlas aparte como informativo**: una sección "Movimientos de fondos (no representan gasto)" al final, con su propio subtotal, para que sí se vea la salida de efectivo sin contaminar el costo de obra.

3. **Traer el gasto real de caja chica**: el concepto "Caja chica" de cada obra pasa a alimentarse de los gastos comprobados y aprobados por el supervisor en la semana (`caja_chica_gastos`), con su fecha, monto, tipo de comprobante y descripción — que es el momento en que el dinero se convierte en costo de la obra.

## Detalle técnico

- `src/lib/api/condensado-semanal.functions.ts`
  - `bucketFromOrigen`: separar `caja_chica_fondo` en un bucket `traspaso_fondo` excluido de los totales de costo.
  - Marcar los conceptos con una bandera `informativo: boolean` en `CondensadoConcepto`; los informativos no suman a `grupo.devengado/pagado` ni a `totales`.
  - Nueva consulta a `caja_chica_gastos` filtrando por `company_id`, estatus aprobado/reembolsado y fecha del gasto dentro de la semana, agrupada por `obra_id` en el bucket `caja_chica` como devengado (y pagado cuando ya fue repuesto).
- `src/components/.../CondensadoSemanalModule.tsx`: renderizar los conceptos informativos en un bloque separado, con estilo atenuado y la nota "no suma al costo de la obra"; los totales de cabecera no cambian de fórmula, sólo dejan de incluir el traspaso.
