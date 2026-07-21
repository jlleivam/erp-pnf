## Ocultar sección IMSS al solicitar alta

Cuando un residente (u otro rol sin permiso de gestión) abre "Solicitar alta de trabajador", la sección **IMSS** (Estatus IMSS, Fecha de alta, NSS, SBC, Tipo de trabajador) no debe mostrarse. Esos datos los captura el administrativo/director al registrar el alta.

### Cambios

**`src/components/trabajadores/TrabajadorFormDialog.tsx`**
- Envolver el bloque `<Section title="IMSS">…</Section>` en `{canManage && ( … )}` para que solo lo vean administrativos/directores.
- En `submit()`, cuando `!canManage`, enviar los campos IMSS como `null` / default (`imss_estatus: "sin_alta"`) para no persistir valores del formulario oculto.

No se tocan la BD ni la API; los campos siguen disponibles al editar/registrar desde la ficha con permisos.