# Flujo de órdenes de cambio: residente solicita, supervisor autoriza

Aplica a **Presupuesto de obra**, **Destajos** y **Subcontratos**. La OC solo modifica el contrato vigente cuando queda **autorizada**.

## Reglas de permisos

- **Solicitar OC** (crear y enviar para autorización): miembros de la obra (`obra_team`) con rol `residente`. El **Director** también puede.
- **Autorizar / Rechazar OC**: miembros de la obra con rol `supervisor`. El **Director** también puede.
- El residente no puede autorizar lo que él solicita; el supervisor no crea OCs (puede rechazar/autorizar).
- Ambos roles se toman de la pestaña **Equipo** de la obra (`obra_team.role`), no del rol global.

## Estados (unificados para OC / adenda)

```text
borrador  →  solicitada  →  autorizada
                       ↘
                         rechazada  →  (residente vuelve a borrador y reenvía)
```

- **borrador**: el residente edita renglones.
- **solicitada**: enviada al supervisor; ya no es editable por el residente.
- **autorizada**: se suma al contrato vigente (única que afecta totales).
- **rechazada**: vuelve a editarse; el residente puede reenviar a "solicitada".

Solo las OCs **autorizadas** se incluyen en totales y validaciones del contrato (ya es el comportamiento actual, se mantiene).

## Cambios técnicos

### Base de datos (una migración)

1. Extender `presupuesto_estatus` con `solicitada` y `rechazada` (hoy solo tiene `borrador, autorizado`). Reutilizar `destajo_doc_estatus` existente (`borrador, enviado, autorizado, rechazado`) — renombramos semánticamente `enviado` ↔ "solicitada" en UI/labels, sin cambiar el enum.
2. Dos funciones `SECURITY DEFINER`:
   - `public.is_residente_de_obra(_obra_id uuid) → boolean`
   - `public.is_supervisor_de_obra(_obra_id uuid) → boolean`
   Consultan `obra_team` por `auth.uid()` + rol.

### Server functions (`src/lib/api/*.functions.ts`)

**Presupuestos (`presupuestos.functions.ts`)**
- `crearPresupuesto` con `tipo='adenda'`: permitir si `isDirector` **o** `is_residente_de_obra(obraId)`. `tipo='base'` sigue siendo solo Director.
- Nueva `solicitarAutorizacionPresupuesto({ id })`: `borrador → solicitada`. Permitida a residente/director, valida que tenga renglones.
- `autorizarPresupuesto({ id })`: pasar de `solicitada → autorizado`. Permitida a `is_supervisor_de_obra` o Director (hoy es solo Director).
- Nueva `rechazarPresupuesto({ id, motivo? })`: `solicitada → rechazada`. Mismo permiso que autorizar.

**Destajos (`destajos.functions.ts`) y Subcontratos (`subcontratos.functions.ts`)**
- `crearOrdenCambioDestajo` / `crearOrdenCambioSubcontrato`: permitir a residente de obra o Director (hoy: cualquier miembro). Estado inicial `borrador`.
- Nuevas `solicitarAutorizacion…` (`borrador → enviado`).
- `autorizarPresupuestoDestajo` / `…Subcontrato`: cambiar permiso a `is_supervisor_de_obra` o Director (hoy: Director o `app_role=supervisor` global).
- Nueva `rechazarPresupuesto…` (`enviado → rechazado`) con el mismo permiso.

### UI

Componentes ya existentes: `VerPresupuestoSheet`, `DestajoDetalleSheet`, `SubcontratoDetalleSheet` (y panel de OC en `PresupuestoModule`).

En cada uno, según estado y rol del usuario en la obra:
- Estado `borrador` + (residente|director): botón **"Solicitar autorización"**.
- Estado `solicitada/enviado` + (supervisor|director): botones **"Autorizar"** y **"Rechazar"** (con motivo opcional).
- Estado `rechazada`: mostrar motivo + botón "Volver a borrador" para el residente.
- Mostrar badge de estado con color (gris/amarillo/verde/rojo).

Para saber el rol del usuario en la obra se reutiliza la consulta de equipo ya disponible; si no existe un hook, agregar `useObraTeamRole(obraId)` que regresa `{ isResidente, isSupervisor }`.

### Sin cambios

- Cálculo de totales del contrato (sigue sumando solo adendas `autorizado`).
- RLS de las tablas existentes.
- Lógica de renglones, estimaciones, importes.
