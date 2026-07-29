## Objetivo
Unificar los permisos de presupuesto base: quien tenga **"Crear/editar presupuesto base"** podrá también enviarlo a autorización. Se elimina el permiso separado `presupuestos.enviar_base`.

## Cambios

### 1. Catálogo de permisos (`src/lib/permisos/catalogo.ts`)
- Eliminar la entrada `presupuestos.enviar_base` de la sección PRESUPUESTOS.
- Dejar únicamente `presupuestos.crear_base` (con su etiqueta actual) y los permisos de autorización.

### 2. Backend (`src/lib/api/presupuestos.functions.ts`)
- En `solicitarAutorizacionPresupuesto`: cambiar el gate de `presupuestos.enviar_base` a `presupuestos.crear_base` para presupuestos base (las adendas siguen con su permiso actual).

### 3. UI captura (`src/components/presupuesto/CapturaPresupuestoSheet.tsx`)
- Reemplazar `puedeEnviar` (que consultaba `enviar_base`) por reutilizar `puedeEditar` (`crear_base`) para mostrar "Guardar y enviar a autorización" en presupuestos base.

### 4. UI módulo (`src/components/presupuesto/PresupuestoModule.tsx`)
- Actualizar cualquier flag derivado que use `enviar_base` para usar `crear_base`.

### 5. Migración de datos
- Migración SQL: `DELETE FROM role_permissions WHERE permiso = 'presupuestos.enviar_base'` para limpiar overrides guardados.

## Resultado
La matriz de permisos muestra un solo renglón "Crear/editar presupuesto base"; cualquier rol con ese check podrá crear, editar y enviar a autorización.
