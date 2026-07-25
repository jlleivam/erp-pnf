## Objetivo
Replicar el flujo del catálogo de Trabajadores en los catálogos de **Proveedores/Contratistas** (`terceros`) y **Clientes**:
- Cualquier rol autenticado puede **solicitar** el alta.
- El registro queda en `estatus_autorizacion = 'pendiente'` si lo crea alguien distinto a director/administrativo; si lo crea director/admin queda `autorizado` directo.
- Solo **director** o **administrativo** pueden **autorizar**, **rechazar/eliminar** pendientes y **editar** existentes.
- Notificación a director/admin cuando queda pendiente.
- UI con pestañas "Todos" / "Pendientes", botón que dice "Solicitar alta" cuando el rol no puede autorizar, y acciones "Autorizar / Rechazar" en pendientes.

## Cambios de base de datos (una sola migración)
1. `public.terceros`: agregar `estatus_autorizacion tercero_autorizacion NOT NULL DEFAULT 'autorizado'` y `creado_por uuid REFERENCES auth.users(id)`. Crear enum `tercero_autorizacion` (`autorizado`, `pendiente`) — o reutilizar `trabajador_autorizacion` si conviene mantener uno propio; se creará uno dedicado para no acoplar módulos.
2. `public.clientes`: mismos dos campos con enum `cliente_autorizacion`.
3. Backfill: todos los registros existentes quedan `autorizado` (default), `creado_por = NULL`.
4. Índices parciales `WHERE estatus_autorizacion = 'pendiente'` en ambas tablas para el filtro rápido.
5. Ajustar políticas RLS si es necesario para permitir INSERT a residentes/auxiliares/supervisores (hoy solo director/admin). Las de UPDATE/DELETE se dejan restringidas a director/admin.

## Cambios en server functions

### `src/lib/api/terceros.functions.ts`
- Añadir helpers `canRequest` / `canManage` (idéntico patrón a trabajadores).
- `SELECT_LIST` y `SELECT_FULL`: incluir `estatus_autorizacion`, `creado_por`.
- `listTerceros`: aceptar `solo_pendientes?: boolean` y filtrar.
- `crearTercero`:
  - Cambiar `assertCanManage` por `if (!canRequest) throw`.
  - Calcular `estatus_autorizacion` según rol.
  - Si queda `pendiente`, insertar notificación para director/admin con link `/app/catalogos/proveedores?tab=pendientes&id=...` (patrón existente en trabajadores).
- `actualizarTercero`, `eliminarTercero`, upload/delete docs: seguir con `assertCanManage`.
- Nuevas server fns `autorizarTercero({id})` y `rechazarTercero({id})` (`rechazar` = delete + notificación al solicitante).

### `src/lib/api/clientes.functions.ts`
- Mismos cambios equivalentes: `canRequest`/`canManage`, `solo_pendientes`, `crearCliente` con lógica de estatus + notificación, `autorizarCliente`, `rechazarCliente`.
- Ajustar `SELECT_LIST`/`SELECT_FULL`.

## Cambios en UI

### `src/components/terceros/CatalogoTerceroModule.tsx`
- Cargar rol con `useAuthStore` (o el hook usado en trabajadores) para `canManage` / `canRequest`.
- Agregar `Tabs` "Todos" / "Pendientes" con contador (como en trabajadores).
- Botón principal:
  - Muestra "Nuevo" si `canManage`, "Solicitar alta" si solo `canRequest`.
  - Oculto si el rol no puede ni solicitar.
- En la tabla, añadir badge "Pendiente" cuando aplique.
- En filas pendientes y para director/admin: botones inline "Autorizar" / "Rechazar" (mutaciones que invalidan la query).
- `TerceroDetalle`: mostrar badge de estatus y bloquear edición si no `canManage`.

### `src/components/clientes/CatalogoClientesModule.tsx`
- Aplicar exactamente el mismo patrón (tabs, contador, botón dinámico, acciones inline).
- `ClienteDetalle`: badge y bloqueo de edición.

### Formularios (`TerceroFormDialog`, `ClienteFormDialog`)
- Sin cambios estructurales; el guardado ya llama a las server fns actualizadas. Ajustar textos del botón "Guardar" a "Enviar solicitud" cuando el usuario no sea manager (opcional, consistente con trabajadores si aplica).

## Notificaciones
Reutilizar el helper de notificaciones ya empleado por trabajadores (insert directo a `notificaciones` con `tipo = 'catalogo_pendiente'` o el tipo existente) apuntando a los usuarios con rol director/administrativo de la compañía.

## Fuera de alcance
- No se toca la pestaña **Permisos** de configuración (sigue declarativa).
- No se modifican otras entidades del catálogo (insumos, trabajadores).

## Validación
- `tsgo` y flujo manual: crear un proveedor y un cliente como residente → verificar que quedan pendientes, aparecen en tab Pendientes del director, se autorizan/rechazan y la notificación llega correctamente.
