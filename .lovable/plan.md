## Notificar solo al administrador de la obra (no a todos)

### Contexto
- `obra_team` mapea usuarios a una obra con un `role` (`administrativo`, `supervisor`, `residente`).
- El "administrador de la obra" = usuarios en `obra_team` con `role = 'administrativo'` para esa `obra_id`.
- Hoy `crearTrabajador` no recibe `obraId`; el trabajador es del catálogo de empresa.
- La solicitud desde nómina viene de `CapturaNominaSheet` (que sí tiene `obraId`) → abre `TrabajadorFormDialog` → llama a `crearTrabajador`.

### Cambios

**1. `src/lib/api/trabajadores.functions.ts` → `crearTrabajador`**
- Extender el input schema con `obraId: z.string().uuid().optional()` (campo opcional).
- Reemplazar la consulta a `user_roles` por una consulta a `obra_team`:
  - Si viene `obraId`: `select user_id from obra_team where obra_id = :obraId and role = 'administrativo'`, excluir al solicitante.
  - Si NO viene `obraId` (alta desde el catálogo sin contexto de obra): no enviar notificación (la solicitud queda como pendiente y aparecerá en la pestaña "Pendientes" del catálogo igualmente; ya no se difunde a toda la empresa).
- En el insert de `notificaciones`, incluir `obra_id: obraId` para que la notificación quede asociada a la obra.
- Mantener `link: "/app/admin/trabajadores"` (el administrador llega al catálogo y ve la pestaña Pendientes).
- Mantener el try/catch y los `console.error` en caso de falla.

**2. `src/components/trabajadores/TrabajadorFormDialog.tsx`**
- Aceptar prop opcional `obraId?: string`.
- Incluir `obraId` dentro del `payload` enviado a `createM.mutate({ data: { ...payload, obraId } })` (solo cuando esté definido).

**3. `src/components/nomina/CapturaNominaSheet.tsx`**
- En el render del `TrabajadorFormDialog` (línea 619), pasar `obraId={obraId}`.

### Lo que NO cambia
- Esquema de base de datos (`notificaciones.obra_id` ya existe).
- UI y flujo del residente al solicitar.
- Permisos: residentes siguen creando con `estatus_autorizacion = "pendiente"`, administradores con `"autorizado"` (y sin notificación, igual que hoy).
- El uso de `TrabajadorFormDialog` desde el catálogo (`CatalogoTrabajadoresModule`) sigue funcionando — simplemente no envía `obraId` ahí.