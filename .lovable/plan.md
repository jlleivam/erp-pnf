## Objetivo

Cambiar el flujo del **presupuesto base** para que replique el de las órdenes de cambio:

```text
borrador ──▶ solicitada ──▶ autorizado
                 └───▶ rechazada ──▶ (reabrir a borrador)
```

Hoy el base salta de `borrador` directo a `autorizado` con un solo botón "Guardar y autorizar". A partir de este cambio, quien tenga `crear_base` guarda el borrador y lo envía; quien tenga `autorizar_base` es el único que autoriza o rechaza.

## Cambios

### 1. Catálogo de permisos — `src/lib/permisos/catalogo.ts`
- Agregar `presupuestos.enviar_base` con label **"Enviar presupuesto base a autorización"**, defaults iguales a `enviar_oc` (residente por defecto).

### 2. API — `src/lib/api/presupuestos.functions.ts`
- `solicitarAutorizacionPresupuesto`:
  - Aceptar también `tipo === "base"`.
  - Elegir permiso según tipo: `enviar_base` para base, `enviar_oc` para adenda.
  - Requerir renglones cargados (ya lo hace).
- `autorizarPresupuesto` (rama base):
  - Requerir `estatus === "solicitada"` (igual que adenda).
  - Aplicar la regla de no auto-autorizar: si `enviado_por === userId` y no es Director, bloquear.
- `rechazarPresupuesto`:
  - Permitir rechazar también base; elegir permiso según tipo (`autorizar_base` / `autorizar_oc`).
  - Notificar al remitente (`enviado_por`) con un tipo nuevo o reusando el existente (usar el mismo patrón que OC).
- `reabrirPresupuesto`:
  - Permitir también base; elegir permiso según tipo (`crear_base` / `crear_oc`).

### 3. UI de captura — `src/components/presupuesto/CapturaPresupuestoSheet.tsx`
- Leer `data.tipo` y `data.estatus`, y `usePermisos()`.
- Flags:
  - `enBorrador = estatus === "borrador"`
  - `puedeEditar = enBorrador && can(esOC ? "crear_oc" : "crear_base")`
  - `puedeEnviar = enBorrador && can(esOC ? "enviar_oc" : "enviar_base")`
- Eliminar el botón **"Guardar y autorizar"**.
- Botones finales:
  - **"Guardar borrador"** — visible solo si `puedeEditar`. Persiste renglones sin cambiar estatus.
  - **"Guardar y enviar a autorización"** — visible solo si `puedeEditar && puedeEnviar`. Guarda renglones y llama `solicitarAutorizacionPresupuesto`.
- Si `!enBorrador`, mostrar solo "Cerrar" (vista de solo lectura de renglones ya soportada por `yaAutorizado`).

### 4. UI del módulo — `src/components/presupuesto/PresupuestoModule.tsx`
- En `PresupuestoCard`, actualizar flags derivados:
  - `puedeSolicitar = estatus === "borrador" && (esOC ? enviarOC : enviarBase)` (quitar la restricción `esOC &&`).
  - `puedeAutorizar` (base) = `estatus === "solicitada" && autorizarBase && !solicitadaPorMi` — reglas iguales a OC.
  - `puedeRechazar` (base) = `estatus === "solicitada" && autorizarBase`.
  - `puedeReabrir` (base) = `estatus === "rechazada" && crearBase`.
- Agregar `enviarBase` a `PresupuestoPerms` y pasarlo desde el módulo (`can("presupuestos.enviar_base")`).
- Copy del header: reemplazar "El residente solicita y el supervisor autoriza" por texto genérico ("Envío a autorización y aprobación según permisos por rol").

## Notas

- Migración de datos: no se requiere. Los presupuestos base ya autorizados quedan como están; los borradores existentes simplemente pasan por el nuevo paso al enviarse.
- Backend ya valida con `requirePermission`; los cambios UI se alinean para no mostrar acciones no permitidas.
- Director conserva bypass total vía `usePermisos.can()` y las validaciones backend.
