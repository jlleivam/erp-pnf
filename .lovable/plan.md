## Objetivo

Mostrar un **Balance General gerencial** de la empresa, donde cada operación (anticipo, pago, estimación, nómina, etc.) impacte automáticamente la categoría correcta. Sin partida doble formal: las cifras se **derivan en vivo** de las tablas operativas que ya existen, agrupadas por un catálogo predefinido para constructora.

---

## 1. Catálogo predefinido (sin tabla nueva, código en TS)

Definimos un catálogo fijo en `src/lib/contabilidad/catalogo.ts`. Cada categoría tiene `codigo`, `nombre`, `grupo` (activo / pasivo / capital), `subgrupo` (circulante / fijo / corto plazo / largo plazo) y un **resolver** que sabe cómo calcular su saldo desde Supabase.

Catálogo inicial:

**Activo circulante**
- `1100` Bancos — suma `cuentas.saldo_actual` (tipo = bancaria)
- `1110` Caja fuerte — suma `cuentas.saldo_actual` (tipo = caja_fuerte)
- `1120` Caja chica — suma `caja_chica_fondos.saldo_actual`
- `1200` Anticipos a proveedores — OCs con anticipo pagado y no amortizado
- `1210` Anticipos a destajistas — `obra_destajo_anticipos` pagados con destajo no liquidado
- `1220` Anticipos a subcontratistas — análogo para subcontratos
- `1300` Obras en proceso — costo acumulado de obras activas (suma de pagos de OC/nómina/destajo/renta asociados a obra activa)
- `1400` Almacén — valor de inventario en obra (recepciones - consumos)

**Pasivo corto plazo**
- `2100` Proveedores por pagar — OCs autorizadas sin pagar
- `2110` Destajistas por pagar — estimaciones de destajo aprobadas sin pagar
- `2120` Subcontratistas por pagar — análogo
- `2130` Nómina por pagar — nóminas cerradas sin pagar
- `2140` Rentas por pagar — eventos de renta sin pagar
- `2150` Vales de gasolina por reembolsar
- `2160` Caja chica por reembolsar — reembolsos solicitados sin pagar

**Capital**
- `3100` Capital social — semilla manual (configurable por director)
- `3200` Resultado del ejercicio — Ingresos − Egresos del periodo

**Cuentas de orden (informativas, no entran al balance)**
- Ingresos por estimaciones a cliente
- Egresos por categoría (mano de obra, materiales, subcontratos, rentas, gasolina, caja chica)

---

## 2. Arquitectura: resolvers en server functions

Sin tabla nueva de movimientos. Cada categoría tiene un resolver que consulta las tablas operativas existentes.

```text
src/lib/contabilidad/
├── catalogo.ts                  # definición + metadata
├── resolvers.ts                 # 1 función por categoría → { saldo, detalle[] }
└── balance.functions.ts         # createServerFn que arma el balance completo
```

Server functions clave:
- `getBalanceGeneral({ fecha? })` → estructura jerárquica con totales por grupo/subgrupo
- `getCategoriaDetalle({ codigo, fecha? })` → drill-down con los registros origen (folio, fecha, monto, link a la entidad)
- `getEstadoResultados({ desde, hasta })` → ingresos vs egresos del periodo

Todas con `requireSupabaseAuth` y filtrado a roles `director` / `administrativo`.

---

## 3. Configuración mínima: Capital social

Único dato que no se puede derivar. Agregamos a `companies`:
- `capital_social numeric(14,2) default 0`

Editable por el director desde Configuración de empresa.

---

## 4. UI: nuevo módulo "Contabilidad" en el menú lateral

Visible solo para `director` y `administrativo`. Dos pestañas:

**Balance General**
- Encabezado: nombre empresa, fecha de corte (selector, default hoy)
- Tres columnas tradicionales: Activo / Pasivo / Capital con totales y verificación `Activo = Pasivo + Capital + Resultado`
- Cada renglón es clickeable → abre Sheet con el detalle (registros que componen el saldo, con link al módulo origen)

**Estado de Resultados**
- Selector de rango (mes actual, trimestre, año, custom)
- Ingresos − Egresos agrupados por categoría
- Mismo patrón de drill-down

---

## 5. Garantías de consistencia

Para que los saldos cuadren sin partida doble, dejamos reglas claras en los resolvers:

1. **Anticipo a proveedor**: se considera "Anticipo" (activo) mientras la OC no esté totalmente amortizada en estimaciones. Al cerrarse, sale de Anticipos y se reclasifica como costo de Obra en proceso.
2. **OC pendiente de pago**: total autorizado − pagado = saldo en Proveedores por pagar.
3. **Obras en proceso**: suma de todos los `pagos` con `origen_tipo` ligado a obra activa, menos lo facturado al cliente (cuando se implemente facturación).
4. **Bancos / Caja**: ya autocontenido vía `cuenta_movimientos`.

Documento estas reglas en `src/lib/contabilidad/README.md` para que cada nuevo origen de pago (futuro módulo) sepa a qué categoría impacta.

---

## 6. Fase 0 (este plan)

1. Agregar `capital_social` a `companies` (migración) + edición desde configuración.
2. Crear `src/lib/contabilidad/{catalogo,resolvers}.ts` + `balance.functions.ts`.
3. Crear ruta `_authenticated/contabilidad/index.tsx` con pestañas Balance / Estado de Resultados.
4. Componentes: `BalanceGeneralView`, `EstadoResultadosView`, `CategoriaDetalleSheet`.
5. Entrada en menú lateral con guard por rol.

No tocamos los módulos existentes (OC, destajos, nómina, etc.): el contable se construye **encima**, leyendo lo que ya generan.

---

## Fase 1 (futuro, no incluido)

- Facturación a cliente → genera Ingresos y Cuentas por cobrar.
- Conciliación bancaria.
- Cierre de periodo (snapshot del balance) para histórico.
- Migración opcional a partida doble si se requiere reporte fiscal formal.

---

## Notas técnicas

- Resolvers cacheables con `useQuery` (`staleTime: 30s`) — el balance no necesita ser milisegundo-real.
- Performance: las queries agregadas usan `sum()` en SQL, no traemos todos los registros al cliente.
- Cada resolver retorna `{ saldo: number, items: Array<{ id, label, monto, fecha, link }> }` para alimentar el drill-down sin refetch.
