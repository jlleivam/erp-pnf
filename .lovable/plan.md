## Problema

El rol **administrativo** puede editar borradores de destajo y subcontrato (crear, modificar renglones del presupuesto base, capturar órdenes de cambio en borrador, eliminar). No debería: la edición de borrador corresponde sólo a **director** o **residente** de la obra (igual que `crearOrdenCambioDestajo`, `enviarPresupuestoDestajo` y `reabrirPresupuestoDestajo`, que ya usan ese guard).

La causa raíz son guards permisivos del lado servidor que usan `isDirector || isMemberObra(obra)`. `isMemberObra` devuelve `true` para cualquier miembro del `obra_team` — incluyendo administrativo, auxiliar y supervisor. Y los botones de la UI no gatean por rol.

## Cambios

### 1. Server — tightening de permisos

Reemplazar `isDirector || member` por `isDirector || obraRole.isResidente` (cargando `obraRole` con el helper `getObraRole` ya existente) en:

**`src/lib/api/destajos.functions.ts`**
- `crearDestajo` (~157)
- `actualizarDestajo` (~235)
- `eliminarDestajo` (~275)
- `guardarRenglonesDestajo` (~345) — captura del presupuesto base en borrador
- `guardarRenglonesOCDestajo` (~482) — captura de OC en borrador
- `actualizarTerminosDestajo` (~839)

**`src/lib/api/subcontratos.functions.ts`** (equivalentes en mismas líneas aproximadas)
- `crearSubcontrato`
- `actualizarSubcontrato`
- `eliminarSubcontrato` (~271)
- `guardarRenglonesSubcontrato` (~333)
- `guardarRenglonesOCSubcontrato` (~465)
- `actualizarTerminosSubcontrato`

No se tocan los guards de estimaciones (capturar/cerrar/eliminar/autorizar), pagos, anticipos, autorización/rechazo de presupuestos, ni asignación de trabajadores — esos siguen como están.

### 2. UI — esconder botones para admin

Usar `useEffectiveIsDirector()` + `useObraRole(obraId).isResidente` para calcular `canEditDraft = director || isResidente` y gatear:

**`src/components/destajos/DestajosModule.tsx`**
- Botón "Nuevo destajo" (línea 112): mostrar sólo si `canEditDraft`.

**`src/components/subcontratos/SubcontratosModule.tsx`**
- Botón "Nuevo" (línea 98): mostrar sólo si `canEditDraft`.

**`src/components/destajos/DestajoDetalleSheet.tsx`**
- Pasar `canEditDraft` a `PresupuestoCard` y a `RenglonesDestajoView` no aplica; los botones a gatear están en `PresupuestoCard`:
  - "Editar" y "Solicitar autorización" en borrador (líneas 367–370): mostrar sólo si `canEditDraft`.
  - "Reabrir como borrador" en rechazado (línea 389–391): mantener — ya está gateado por `canAuthorize` flujo? Verificar; si no, gatear por `canEditDraft` también para consistencia con server.
- Botón "Nueva orden de cambio" (línea 188–194): mostrar sólo si `canEditDraft`.

**`src/components/subcontratos/SubcontratoDetalleSheet.tsx`**
- Mismas reglas: gatear "Editar", "Solicitar autorización", "Nueva orden de cambio" por `canEditDraft`.

### 3. Sin cambios

- Esquema, RLS, tabla `user_roles` y `obra_team`: intactos.
- Capture sheets (`CapturaDestajoSheet`, `CapturaSubcontratoSheet`, `CapturaOrdenCambioDestajoSheet`, `CapturaOrdenCambioSubcontratoSheet`): no se tocan; los inputs siguen habilitados por estatus borrador, pero el servidor ya bloquea cualquier guardado de admin. Como bonus la UI ya no expone los botones para llegar ahí.
- Estimaciones, anticipos, pagos: sin cambios.

## Resultado

Un usuario con rol administrativo:
- No verá botones "Nuevo destajo/subcontrato", "Editar", "Solicitar autorización" ni "Nueva orden de cambio".
- Aunque dispare la server fn por otra vía, recibirá "Sin permisos".
- Sigue pudiendo ver, registrar pagos, ligar anticipos, etc. (sus flujos propios no cambian).
