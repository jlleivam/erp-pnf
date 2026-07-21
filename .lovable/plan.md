## Problema

En `src/routes/_authenticated/app.configuracion.tsx`, `handleSaveAndClose` solo guarda la pestaña activa:

```ts
if (tab === "facturacion") await facturacionRef.current?.submitAsync();
else if (tab === "configuracion") await configRef.current?.submitAsync();
```

Como `forceMount` mantiene el estado de todas las pestañas, el usuario puede editar Facturación, cambiar a General y perder los cambios al guardar (nunca se envía Facturación).

## Fix

En `handleSaveAndClose`, invocar `submitAsync()` de **todas** las pestañas con estado editable en paralelo, sin importar la pestaña activa:

```ts
await Promise.all([
  facturacionRef.current?.submitAsync(),
  configRef.current?.submitAsync(),
]);
navigate({ to: "/app" });
```

Cada `submitAsync` ya hace `mutateAsync` con el estado actual del formulario y muestra toast en error. Si ninguna pestaña cambió, simplemente re-envía los mismos valores (idempotente contra `companies`).

Opcional menor: si se quiere evitar el UPDATE innecesario, cada tab podría exponer un flag `isDirty` y solo enviar cuando aplique — pero no es requerido para arreglar el bug.

## Archivos

- `src/routes/_authenticated/app.configuracion.tsx` — cambiar `handleSaveAndClose` para guardar ambas pestañas en paralelo.
