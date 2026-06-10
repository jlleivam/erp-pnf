
## Objetivo

Al registrar el pago de un anticipo de destajo en Cuentas por Pagar, además del egreso ya existente, disparar 4 acciones:

1. Notificar al residente que solicitó el anticipo.
2. Generar un asiento contable (nueva tabla `asientos_contables`).
3. Marcar visualmente el destajo como "Anticipo pagado" con fecha y quien pagó.
4. Guardar `pagado_por` en el anticipo.

---

## 1. Migración de base de datos

### 1.1 Columna `pagado_por` en `obra_destajo_anticipos`
- Agregar `pagado_por uuid REFERENCES auth.users(id)`.

### 1.2 Nueva tabla `asientos_contables`
Estructura mínima (doble partida en filas separadas vinculadas por `asiento_id`):

- `id`, `company_id`, `fecha`, `concepto`, `referencia`
- `origen_tipo` ("anticipo_destajo", luego se reutiliza), `origen_id`
- `tipo_movimiento` ("cargo" | "abono")
- `cuenta_contable` (texto: ej. "Anticipo a destajistas", "Bancos", "Caja")
- `monto`
- `creado_por`, `created_at`
- Agrupador `asiento_id uuid` para juntar las dos líneas del mismo asiento

Para el pago de anticipo se insertan 2 filas con el mismo `asiento_id`:

```text
Cargo:  Anticipo a destajistas        $ monto
Abono:  Bancos / Caja (cuenta usada)  $ monto
```

GRANT a `authenticated` y `service_role`. RLS: SELECT por `current_company_id()`; escritura solo por director o administrativo (vía función `pagarAnticipoDestajo`, que ya valida rol).

---

## 2. `pagarAnticipoDestajo` (src/lib/api/destajos.functions.ts)

Dentro del mismo flujo transaccional, después de marcar el anticipo como pagado:

a. **Update anticipo**: agregar `pagado_por: userId` al `.update(...)`.

b. **Asiento contable**: insertar las dos filas en `asientos_contables` con un `asiento_id` compartido (gen_random_uuid en cliente). Cuenta contable de abono = `"Bancos"` si `cuenta.tipo === "bancaria"`, `"Caja"` si `caja_fuerte`. Si falla, rollback igual al resto de pasos.

c. **Notificación al residente solicitante**:
   - Leer `solicitado_por` del anticipo (ya disponible en la consulta inicial — incluirlo en el `select`).
   - Si existe y es distinto de `userId`, insertar una fila en `notificaciones`:
     - `tipo: "anticipo_destajo_pagado"`
     - `titulo: "Anticipo pagado"`
     - `mensaje: "Se pagó el anticipo ({monto}) del destajo {nombre} · {destajista}"`
     - `link: /app/admin/destajos/{destajoId}` (o el path actual del detalle del destajo)
     - `obra_id` del destajo
   - Helper local `notifySolicitanteAnticipoPagado` siguiendo el patrón de `notifyAdminsAnticipoSolicitado` (try/catch, log si error, sin romper el pago).

d. Return: `{ ok: true, pagoId, asientoId }`.

---

## 3. UI — marca visual en el destajo

En la vista/detalle del destajo (componente que ya muestra el bloque de anticipo):

- Cuando `pagado === true`, mostrar badge verde **"Anticipo pagado"** con:
  - Fecha de pago (`pagado_at` o `fecha`)
  - "Pagado por: {nombre del usuario en `pagado_por`}"
- Extender la query del detalle del destajo (`destajos.functions.ts`, función que carga el detalle) para incluir `pagado_por` + join a `profiles` para el nombre.

Sin nueva sección de pagos — solo el badge ya existente enriquecido.

---

## 4. UI — Cuentas por Pagar

Sin cambios visuales adicionales. Tras el éxito, invalidar las queries que ya invalida hoy + opcionalmente `destajo-detalle` para que la marca aparezca en vivo.

---

## Archivos a tocar

- Migración SQL (nueva tabla + columna)
- `src/lib/api/destajos.functions.ts` — `pagarAnticipoDestajo`, helper de notificación, query de detalle (incluir `pagado_por` y nombre)
- Componente del detalle del destajo (badge "Anticipo pagado") — identificar el archivo en build mode

---

## Notas técnicas

- El asiento se inserta dentro de la secuencia de rollback existente: si falla, se revierte pago, movimiento, saldo de cuenta y estado del anticipo.
- La notificación NO bloquea el pago (try/catch + log), igual que el resto de notificaciones del módulo.
- `asientos_contables` queda como base reutilizable para futuros módulos (nómina, gastos, etc.) sin acoplarse al destajo.
