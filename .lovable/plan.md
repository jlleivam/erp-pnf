# Notificaciones del flujo de Requisiciones

Se reutiliza la tabla `notificaciones` y el patrón ya existente (insert vía `supabaseAdmin`, link a la ruta correspondiente, campana `NotificacionesBell` ya conectada).

## Destinatarios

- **Administrativos** y **Supervisores**: usuarios con ese `role` en `user_roles` para la `company_id` de la obra.
- **Residentes**: usuarios en `obra_team` con `role = 'residente'` para la obra (mismo patrón que ya usa `enviarOCAProveedor`).

Si no hay destinatarios, simplemente no se inserta nada (no error).

## Cambios por evento

### 1. Residente envía requisición → Administrativos
**Archivo:** `src/lib/api/requisiciones.functions.ts` → `crearRequisicion`
Después del insert exitoso de `requisicion_insumos`, notificar a todos los administrativos de la empresa.
- tipo: `requisicion_enviada`
- título: `Nueva requisición ${folio}`
- mensaje: `${solicitante} envió una nueva requisición de la obra ${obra}.`
- link: `/app/admin/requisiciones`

### 2. Administrativo envía OC al supervisor → Supervisores
**Archivo:** `src/lib/api/cotizaciones.functions.ts` → `enviarOCASupervisor`
Tras el update a `pendiente_autorizacion`, notificar a supervisores de la empresa (filtrados por obra si están en `obra_team`, si no hay supervisores asignados, a todos los supervisores de la empresa).
- tipo: `oc_pendiente_autorizacion`
- título: `OC ${folio} pendiente de autorizar`
- mensaje: `Hay una OC esperando tu autorización (req. ${reqFolio}).`
- link: `/app/supervisor/requisiciones`

### 3. Supervisor autoriza OC → Administrativos
**Archivo:** `src/lib/api/cotizaciones.functions.ts` → `autorizarOC`
- tipo: `oc_autorizada`
- título: `OC ${folio} autorizada`
- mensaje: `La OC fue autorizada. Puedes enviarla al proveedor.`
- link: `/app/admin/requisiciones`

### 4. Administrativo envía OC al proveedor → Residente
**Ya implementado** en `enviarOCAProveedor`. Sin cambios.

### 5. Residente registra recepción en almacén → Supervisor + Administrativo
**Archivo:** `src/lib/api/almacen.functions.ts` → `registrarRecepcion`
Actualmente solo notifica a administrativos y **solo cuando la OC queda completamente recibida**. Cambios:
- Notificar en **cada** recepción (parcial o completa), no solo al completarse.
- Agregar a los **supervisores** como destinatarios (además de administrativos).
- Diferenciar el título/mensaje según `nuevoEstatus`:
  - `recibida_parcial`: `OC ${folio} con recepción parcial`
  - `recibida`: `OC ${folio} recibida completa`
- link: `/app/obras/${obraId}/almacen-obra`

## Detalles técnicos

- Insertar siempre vía `supabaseAdmin` (igual que el código existente) para evitar problemas de RLS al notificar a otros usuarios.
- Envolver cada insert en try/catch con `console.error` — un fallo de notificación no debe romper la acción principal (mismo patrón que `enviarOCAProveedor`).
- Deduplicar destinatarios con `Array.from(new Set(...))` por si un usuario tiene varios roles.
- Para el residente solicitante en el mensaje de la #1, hacer un lookup ligero a `profiles.nombre_completo`; si no se encuentra, omitir el nombre.

## Fuera de alcance

- Email / push notifications (solo notificaciones in-app).
- Cambios de UI en la campana (`NotificacionesBell` ya muestra todo lo que se inserte).
- Reglas de preferencia por usuario (todos los destinatarios reciben siempre).
