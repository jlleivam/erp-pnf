## Ajustes a la reclasificación de comprobante

### 1. Restringir a gastos aprobados
- En `reclasificarComprobanteGasto` (server): exigir `estatus === "aprobado"` además de las validaciones actuales. Si está `rechazado`, `borrador`, `solicitado` o `reembolsado`, error.
- En `RevisarReembolsoSheet`: mostrar el botón **"Reclasificar"** sólo si `g.estatus === "aprobado"` (además de los chequeos actuales de rol y `reemb.estatus === "enviado_admin"`).

### 2. Permitir reclasificación en ambos sentidos
- Ampliar el enum del input a `["factura", "nota", "ninguno"]`.
- Validar que `nuevoTipo !== tipo_comprobante actual` (sin no-ops).
- Guardar el valor original en `comprobante_reclasificado_de` la primera vez. Si se reclasifica de nuevo, conservar el `de` original (es la trazabilidad histórica) y sólo actualizar motivo / usuario / fecha.
- En la UI, el selector mostrará las dos opciones que **no** son el tipo actual del gasto:
  - Si es `factura` → opciones: Nota, Sin comprobante.
  - Si es `nota` → opciones: Factura, Sin comprobante.
  - Si es `ninguno` → opciones: Factura, Nota.
- El texto auxiliar pasa a ser neutro: "El monto a reponer al residente no cambia. El costo a la obra se ajusta según el tipo de comprobante (factura descuenta el IVA acreditable)."
- Mostrar el botón aunque ya esté reclasificado, para permitir cambiar otra vez (la línea amarilla "Reclasificado de …" sigue visible con el motivo más reciente).

### Resultado
- Los gastos rechazados ya no muestran el bloque de reclasificación.
- El administrativo puede reclasificar en cualquier dirección (factura ↔ nota ↔ sin comprobante) mientras el reembolso esté en `enviado_admin` y el gasto esté `aprobado`, con motivo obligatorio.
