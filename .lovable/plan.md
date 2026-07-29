## Objetivo
Unificar los permisos de orden de cambio: quien tenga **"Crear/editar orden de cambio"** también podrá enviarla a autorización. Se elimina el permiso separado `presupuestos.enviar_oc`.

## Cambios

### 1. Catálogo (`src/lib/permisos/catalogo.ts`)
- Eliminar la entrada `presupuestos.enviar_oc`.

### 2. Backend (`src/lib/api/presupuestos.functions.ts`)
- En `solicitarAutorizacionPresupuesto`: cambiar el gate para adendas de `presupuestos.enviar_oc` a `presupuestos.crear_oc`.

### 3. UI captura (`src/components/presupuesto/CapturaPresupuestoSheet.tsx`)
- Reemplazar `enviar_oc` por `crear_oc` en el cálculo de `puedeEnviar`.

### 4. UI módulo (`src/components/presupuesto/PresupuestoModule.tsx`)
- Actualizar el flag derivado `enviarOC` para usar `crear_oc` (reutilizando `puedeCrearOC`).

### 5. Datos
- `DELETE FROM role_permissions WHERE action_key = 'presupuestos.enviar_oc'` para limpiar overrides.

## Resultado
Un solo renglón "Crear/editar orden de cambio" concentra la capacidad de crearla, editarla y enviarla a autorización.
