## Cambio (solo para perfil administrativo)

Archivo: `src/components/requisiciones/RequisicionesModule.tsx`, pestaña **Historial** (líneas 258–275).

Actualmente para todos los roles, el folio y el botón ojo del Historial abren `RequisicionDetalleSheet` (vista simple sin pestañas).

Ajuste: cuando `isAdministrativo === true`, esos clicks deben abrir `CotizacionSheet` (módulo completo con pestañas Requisición / Cotizaciones / Comparativa / OCs) en vez del detalle simple.

1. Folio (`TableCell`): si `isAdministrativo`, hacerlo clickeable → `setCotizacion({ id: r.id, tab: "requisicion" })`. Para los demás roles, mantener comportamiento actual (sin click en el folio).
2. Botón ojo en columna Acción: si `isAdministrativo`, `onClick` → `setCotizacion({ id: r.id, tab: "ocs" })`. Para los demás roles, mantener `setDetalleId(r.id)` actual.

Esto complementa el cambio previo en la tabla de **Activas** del administrativo, dejando consistente que el administrativo siempre acceda al módulo completo (Activas e Historial). No se modifica el comportamiento para residente, supervisor, director ni otros roles. No se cambia `CotizacionSheet` ni lógica de negocio.
