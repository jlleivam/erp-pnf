# Restringir recepción de material a director y residente

## Regla

Solo el **director** (rol global) y el **residente de la obra** (`obras.residente_id = userId`) pueden registrar recepciones. El administrativo, supervisor y auxiliar **no** pueden.

## Cambios

### 1. Backend: `src/lib/api/almacen.functions.ts` → `registrarRecepcion`

Reemplazar la llamada genérica `assertObraAccess(...)` por una validación específica:

- Si `roles.includes("director")` → permitido.
- Si no, leer `obras.residente_id` de `oc.obra_id` y exigir `residente_id === userId`.
- En cualquier otro caso → `throw new Error("Solo el director o el residente de la obra pueden registrar recepciones")`.

`getOCParaRecepcion` se deja igual (es solo lectura y abrir el diálogo no implica registrar; el insert validará).

`assertObraAccess` se mantiene como está para el resto de funciones de almacén (semana, movimientos), porque la restricción aplica solo a la recepción.

### 2. Backend: `src/lib/api/cotizaciones.functions.ts` → `getCotizacionRequisicion`

Calcular y devolver `puede_recibir` por OC para que el frontend oculte el botón cuando no aplica:

- Obtener roles del usuario (mismo patrón que `requireSupabaseAuth` ya inyecta `userId`; leer `user_roles.role` filtrado por company).
- Leer `obras.residente_id` de la obra de la requisición.
- `puede_recibir = roles.includes("director") || residente_id === userId`.

Adjuntar el booleano a cada objeto OC en el resultado (mismo nivel que `recibido_por_insumo`).

### 3. Frontend: `src/components/requisiciones/CotizacionSheet.tsx`

En la sección de OCs, sustituir el cálculo actual:

```ts
const puedeRecibir = (oc.estatus === "enviada" || oc.estatus === "recibida_parcial") && !cerrada;
```

por:

```ts
const puedeRecibir =
  !!oc.puede_recibir &&
  (oc.estatus === "enviada" || oc.estatus === "recibida_parcial") &&
  !cerrada;
```

No se cambia ninguna otra lógica de UI ni los permisos de pago.

## Fuera de alcance

- No se modifica `assertObraAccess` ni los permisos de almacén/semana/movimientos.
- No se cambia la captura de gastos, ni notificaciones.
- No se introduce un nuevo rol ni se altera la tabla `obras`.
