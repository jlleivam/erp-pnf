## Objetivo

Que el botón **Guardar cambios** aparezca en todas las pestañas de `/app/configuracion` y que al hacer click guarde los cambios de la pestaña activa y regrese a `/app` (cerrando la ventana de configuración).

## Estado actual

- El botón hoy sólo se muestra en las pestañas *Datos de facturación* y *Configuración* (`savable = tab === "facturacion" || tab === "configuracion"`).
- Las demás pestañas guardan de forma inmediata en sus propias acciones:
  - **Identidad**: el logo se guarda al subir/eliminar el archivo.
  - **Equipo**, **Cuentas**: cada alta/edición/baja se guarda al confirmar su diálogo.
  - **Documentación**: placeholder, no guarda nada.

Por eso solo *Facturación* y *Configuración* tenían acciones pendientes que un botón global pudiera disparar.

## Cambios

### `src/routes/_authenticated/app.configuracion.tsx`
1. Mostrar el botón **Guardar cambios** siempre (quitar el gate `savable`).
2. Nuevo handler `handleSaveAndClose`:
   - Si la pestaña activa es `facturacion` → `facturacionRef.current?.submitAsync()` y esperar.
   - Si es `configuracion` → `configRef.current?.submitAsync()` y esperar.
   - En cualquier otra pestaña, no hay nada que guardar (los cambios ya están persistidos).
   - Tras completar exitosamente, `navigate({ to: "/app" })`.
3. Deshabilitar el botón mientras `isSaving` de la pestaña activa esté en true (para facturación/configuración).

### `src/components/configuracion/FacturacionTab.tsx` y `ConfiguracionTab.tsx`
- Extender el `useImperativeHandle` para exponer `submitAsync: () => Promise<void>` (usando `save.mutateAsync()`), además del `submit` actual. Esto permite al route esperar el guardado antes de navegar.
- Mantener `isSaving` como está.

### Comportamiento por pestaña al presionar "Guardar cambios"

| Pestaña | Acción |
|---|---|
| Datos de facturación | Guarda el formulario y navega a `/app` |
| Configuración | Guarda moneda/zona/capital y navega a `/app` |
| Identidad | Solo navega a `/app` (logo ya se guarda al subir) |
| Equipo | Solo navega a `/app` |
| Cuentas | Solo navega a `/app` |
| Documentación | Solo navega a `/app` |

Si el guardado falla (toast de error), no se cierra la ventana.

## Fuera de alcance

- No se convierte la página en modal — la "ventana de configuración" es la ruta `/app/configuracion`; "cerrar" = regresar a `/app`. Si prefieres otro destino (por ejemplo la ruta previa via `router.history.back()`), dímelo antes de implementar.
