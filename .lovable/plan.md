## Problema

El residente tiene override `requisiciones.ver_oc = true` en `role_permissions`, por lo que `usarVistaTabla` se activa y ve la vista tabla. En esa vista, el botón de acción sólo depende del estatus (no del permiso), así que ve "Cotizar", "Continuar" o "Ver OCs" aunque no tenga `cotizaciones.gestionar` ni `oc.crear`.

## Cambio

En `src/components/requisiciones/RequisicionesModule.tsx`, condicionar cada botón de la columna "Acción" (vista tabla activas e historial) al permiso correspondiente:

- Borrador → sólo el creador (o quien tenga `requisiciones.crear`) ve "Editar" + eliminar; los demás ven "Ver" (detalle).
- `enviada` → botón "Cotizar" sólo si `cotizaciones.gestionar`; si no, "Ver".
- `en_cotizacion` → botón "Continuar" sólo si `cotizaciones.gestionar`; si no, "Ver".
- `pendiente_autorizacion` / `oc_generada` / `completada` → botón "Ver OCs" sólo si `requisiciones.ver_oc` o `oc.autorizar` o `oc.cancelar`; si no, "Ver".
- Otros estatus → "Ver" (abre `RequisicionDetalleSheet`).

El fallback "Ver" abrirá `RequisicionDetalleSheet` (solo lectura), no `CotizacionSheet`, para no exponer acciones de cotización a quien no las puede ejecutar. Lo mismo aplica al click en el Folio.

No se toca lógica de negocio ni el backend (las funciones ya están gateadas por permiso).

## Nota

Podemos dejar `usarVistaTabla` como está (residente sigue viendo tabla porque tiene el override de ver OC), o cambiarlo a que residentes con sólo `ver_oc` sigan viendo la vista tarjeta. ¿Prefieres mantener la tabla para todos los que tengan cualquier permiso de gestión/visualización, o forzar tarjeta cuando el único permiso es `ver_oc`?
