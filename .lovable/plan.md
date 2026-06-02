## Objetivo

Permitir dar de alta un nuevo trabajador directamente desde la pantalla de captura de nómina, sin tener que ir al catálogo.

## Flujo propuesto

En el diálogo **"Asignar trabajadores"** del `CapturaNominaSheet`, agregar un botón **"+ Nuevo trabajador"** en el encabezado, junto al buscador.

Al pulsarlo se abre el `TrabajadorFormDialog` existente (mismo formulario del catálogo) en modo creación. Al guardar:

1. Se invalida la query `["trabajadores-disponibles", obraId]` para refrescar la lista.
2. Si el usuario es Director o Administrativo (`canManage = true`), el trabajador queda **autorizado** automáticamente y aparece de inmediato en la lista; lo dejamos **pre-seleccionado** para que el residente sólo confirme.
3. Si el usuario es Residente (`canManage = false`), el trabajador queda en estatus **pendiente** y NO aparece todavía en la lista de disponibles (que sólo muestra autorizados). Se muestra el toast existente: *"Solicitud enviada. Pendiente de autorización."* — comportamiento idéntico al del catálogo.

## Cambios técnicos

- **`src/components/nomina/CapturaNominaSheet.tsx`**
  - Importar `TrabajadorFormDialog` y el hook de rol (ya disponible vía `useAuth`/`useRoles` que use el catálogo) para calcular `canManage`.
  - Agregar estado `nuevoTrabajadorOpen` y un estado opcional `pendienteSeleccion` (id del último creado autorizado) para pre-marcarlo en el set de seleccionados al refrescar la lista.
  - Header del diálogo de asignación: layout flex con buscador a la izquierda y botón **"+ Nuevo"** a la derecha.
  - Al cerrar el form con éxito: invalidar `trabajadores-disponibles` y, si `canManage`, agregar el id devuelto al set de seleccionados.

- **`src/lib/api/nominas.functions.ts`** — sin cambios; la lista sigue filtrando por `autorizado`, que es el comportamiento correcto (no se asignan pendientes a nómina).

- **Sin migración** ni cambios de RLS: `crearTrabajador` ya respeta el rol y aplica el estatus correcto.

## Fuera de alcance

- Cambiar el flujo de autorización de trabajadores pendientes.
- Permitir asignar trabajadores pendientes a la nómina (siguen requiriendo autorización del Director/Administrativo).
- Edición del trabajador desde la nómina (sólo alta).
