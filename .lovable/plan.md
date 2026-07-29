## Objetivo

Eliminar la pantalla actual de "detalle simple" (imagen 1) y hacer que al abrir cualquier requisición se muestre siempre `CotizacionSheet` (imagen 2), con sus 5 pestañas (Requisición, Cotizaciones, Comparativa, OCs, Recepciones). Si el usuario no tiene permisos para actuar, el sheet se abre en modo **solo lectura**: se ven los datos y pestañas, pero sin botones de acción.

## Cambios

### 1. `src/components/requisiciones/CotizacionSheet.tsx`
- Agregar prop `readOnly?: boolean`.
- Cuando `readOnly` sea `true`, ocultar todos los botones y controles de acción del sheet y sus subcomponentes:
  - Botón "Enviar solicitud a proveedores", "Nueva cotización", "Editar respuesta", "Descartar" (tab Cotizaciones/Solicitudes).
  - Botón "Generar OC" y controles de la Comparativa.
  - Botones "Autorizar/Rechazar OC", "Cancelar OC", "Registrar pago" (tab OCs / `OCPagosPanel`).
  - Cualquier input editable de la comparativa (dejarlo como lectura).
- Propagar `readOnly` a `SolicitudesTab`, `ComparativaTable`, `OCPagosPanel` y `RecepcionesTab` (esta última ya es solo lectura).
- Los permisos siguen aplicando además de `readOnly` (defensa en profundidad); `readOnly` fuerza el mínimo.

### 2. `src/components/requisiciones/RequisicionesModule.tsx`
- Reemplazar todos los puntos donde hoy se abre `RequisicionDetalleSheet` (fallback "Ver" cuando el usuario no tiene permisos) por `CotizacionSheet` con `readOnly`.
- Unificar el estado: eliminar `detalleId` y usar solo `cotizacion = { id, tab, readOnly }`.
- La lógica de decisión al hacer click en el folio/botón "Ver":
  - Si el usuario tiene `cotizaciones.gestionar` → abrir en tab "solicitudes", editable.
  - Si tiene `oc.crear` / `oc.autorizar` / `oc.cancelar` / `requisiciones.ver_oc` → abrir en tab "ocs", editable (los botones se ocultan según cada permiso puntual como hoy).
  - En cualquier otro caso → abrir `CotizacionSheet` con `readOnly={true}` en tab "requisicion".
- Borrar la importación y uso de `RequisicionDetalleSheet`.

### 3. `src/components/requisiciones/RequisicionDetalleSheet.tsx`
- Eliminar el archivo (ya no se usa).

## Notas técnicas
- Los permisos existentes (`can("cotizaciones.gestionar")`, `can("oc.*")`, etc.) siguen siendo la fuente de verdad para mostrar cada botón. `readOnly` es un "gran interruptor" adicional que apaga todo.
- No se cambia backend ni permisos; es un ajuste puramente de UI.
- Las tabs de Recepciones y Requisición ya son informativas — se ven igual en ambos modos.
