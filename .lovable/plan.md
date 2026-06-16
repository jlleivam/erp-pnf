## Objetivo

Que el balance se modifique **cada día** mientras el equipo está en obra: un asiento diario que acumula gasto en la obra y crece el pasivo con el proveedor.

## Diseño

**Dos flujos independientes** (uno contable diario, otro operativo por período):

1. **Devengo contable diario** → asientos en `asientos_contables`, uno por día rentado.
2. **Devengo operativo por período** → `obra_renta_pagos` + `cuentas_por_pagar`, igual que hoy. No se toca el cálculo de períodos.

Ambos suman al mismo saldo de la cuenta "Cuentas por pagar - Rentas". Cuando se paga la CxP, el módulo de pagos ya cancela ese pasivo contra banco/caja.

### Asiento diario

Para cada día `d` entre `fecha_llegada_real` y `min(hoy, fecha_devolucion_real)`:

```text
Fecha: d
Concepto: "Renta <equipo> · <dd/mm/yyyy>"
Referencia: <id corto de la renta>
origen_tipo: "renta_devengo_diario"
origen_id: obra_rentas.id

  Cargo  · Costo de obra - Rentas              monto_diario
  Abono  · Cuentas por pagar - Rentas          monto_diario
```

**`monto_diario`** = `tarifa_unitaria * cantidad / dias_por_periodo`, donde `dias_por_periodo` = {diaria:1, semanal:7, quincenal:15, mensual:30}. Así la suma de los 30 asientos diarios de una renta mensual = exactamente el monto del período mensual.

### Idempotencia

Antes de insertar el asiento de la fecha `d`, verificar que no exista uno con `origen_tipo='renta_devengo_diario'`, `origen_id=renta.id`, `fecha=d`. Esto permite correr el cron varias veces sin duplicar.

## Cambios técnicos

**1. Nueva función SQL: `public.devengar_asientos_renta(_renta_id uuid) RETURNS integer`**
- `SECURITY DEFINER`, mismo patrón que `generar_periodos_renta`.
- Calcula `dias_por_periodo` y `monto_diario`.
- Loop desde `GREATEST(fecha_llegada_real, último_asiento_diario + 1)` hasta `LEAST(current_date, COALESCE(fecha_devolucion_real, current_date))`.
- Inserta los dos renglones (cargo/abono) por día con un `asiento_id` distinto por día. `creado_por = COALESCE(r.creado_por, r.cotizado_por)`.
- Retorna cuántos días devengó.

**2. Nueva función SQL: `public.devengar_asientos_rentas_activas() RETURNS integer`**
- Itera rentas con estatus `activa` o `devuelta` y llama a la anterior. Mismo patrón que `generar_periodos_rentas_activas`.

**3. Hook diario `/api/public/hooks/devengar-rentas`**
- Llamar primero a `devengar_asientos_rentas_activas` y después a `generar_periodos_rentas_activas` (el orden no afecta los totales pero deja el log más claro). Devolver ambos contadores.

**4. `marcarLlegada` (server fn)**
- Después de activar la renta y de llamar a `generar_periodos_renta`, también llamar a `devengar_asientos_renta` para que el día de llegada quede contabilizado al instante.

**5. `marcarDevolucion` (si existe)**
- Llamar a `devengar_asientos_renta` una última vez para cerrar el devengo al día de devolución.

## Front-end

Sin cambios.

## Edge cases

- **Tarifa o periodicidad cambia a media renta**: el devengo diario usa los valores actuales de la renta. Si más adelante hay renovaciones con tarifa distinta, se ajusta en otro turno.
- **Cancelación retroactiva de una renta activa**: fuera de alcance; reverso manual.
- **Depósito en garantía**: fuera de alcance.

## Confirmación

¿OK con `dias_por_periodo` = {diaria 1, semanal 7, quincenal 15, mensual 30} para que la suma diaria empate exactamente con el monto del período? Es la convención que ya usa `generar_periodos_renta`.