# Problema

Al hacer click en la notificación "OC autorizada" navega a `/app/obras/{id}/presupuesto`, pero no abre directamente la OC autorizada. El usuario debe encontrarla manualmente en la pestaña de Órdenes de cambio.

# Cambios

**1. `src/lib/api/presupuestos.functions.ts`** — incluir el id de la OC y el tab en el `link` de las notificaciones de OC autorizada/rechazada para que la UI pueda abrir el sheet directamente:

- En `autorizarPresupuesto` (≈ línea 289):  
  `link: \`/app/obras/${pres.obra_id}/presupuesto?tab=adendas&ver=${data.id}\``
- En `rechazarPresupuesto` (≈ línea 393): mismo formato.

**2. `src/components/presupuesto/PresupuestoModule.tsx`** — leer los search params `tab` y `ver` al montar y aplicar:

- Importar `useSearch` y `useNavigate` de `@tanstack/react-router`.
- Cambiar `<Tabs defaultValue="base">` por un Tabs controlado con `value={tab}` y `onValueChange` que actualice el search param.
- Al detectar `ver` en los search params, hacer `setViewing(ver)` en un `useEffect` y luego limpiar el param (`navigate({ search: (prev) => ({ ...prev, ver: undefined }) })`) para que cerrar el sheet no lo vuelva a abrir.
- Inicializar `tab` desde el search param (default `"base"`).

Como la ruta es un splat (`app.obras.$obraId.$.tsx`) sin `validateSearch`, usar `useSearch({ strict: false })` para leer y `useNavigate()` para escribir; los valores se tipan como `string | undefined`.

# Sin cambios

- No se tocan tablas ni notificaciones ya existentes (los nuevos enlaces aplican a notificaciones creadas a partir de este cambio).
- El comportamiento al entrar al módulo sin search params permanece igual.
