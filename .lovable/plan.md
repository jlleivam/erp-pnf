## Objetivo

En el diálogo **Nuevo destajo**, agregar un botón **"Solicitar alta"** (o **"Nuevo"** si el usuario tiene permisos) a la derecha del selector de Destajista, con el mismo comportamiento que el que ya existe en Captura de Nómina.

## Cambios

**Archivo:** `src/components/destajos/NuevoDestajoDialog.tsx`

1. Reestructurar el campo "Destajista" en un layout flex: el Select ocupa el ancho disponible y a la derecha se agrega un botón con ícono `+` ("Nuevo" para roles que pueden gestionar trabajadores, "Solicitar alta" para residentes).
2. Importar y montar `TrabajadorFormDialog` (mismo componente usado en `CapturaNominaSheet`), controlado por un estado local `trabajadorDialogOpen`.
3. Determinar `canManage` con la misma lógica de roles que se usa en nómina (admin/supervisor pueden crear directo; residente envía solicitud de alta).
4. Tras crear/solicitar exitosamente:
   - Invalidar/recargar la lista de trabajadores que alimenta el dropdown.
   - Si fue alta directa (canManage), preseleccionar al trabajador recién creado en el campo Destajista.
   - Si fue solicitud, mostrar toast y mantener el flujo (el destajista aparecerá cuando se apruebe).

## Notas

- No se modifica lógica de negocio del destajo ni el esquema de BD.
- Solo cambia el diálogo `NuevoDestajoDialog.tsx`; se reutiliza `TrabajadorFormDialog` tal cual.
