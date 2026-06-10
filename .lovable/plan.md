## Problema

`NotificacionesBell.handleOpen` hace `navigate({ to: n.link })` con `n.link = "/app/obras/<id>/destajos?destajo=<id>"`. TanStack Router trata `to` como pathname; el `?destajo=...` no se interpreta como search params y se pierde (o el path queda como literal y no matchea la ruta). Por eso al hacer clic se navega a destajos pero sin el query `?destajo=` que `DestajosModule` necesita para abrir el `DestajoDetalleSheet`.

Esto también explica por qué (silenciosamente) las otras notificaciones de destajo solicitado/autorizado/rechazado tampoco abren el detalle pese a usar el mismo patrón.

## Cambio

En `src/components/NotificacionesBell.tsx`, dentro de `handleOpen`, separar pathname y search antes de navegar:

```tsx
const handleOpen = (n: any) => {
  if (!n.leida_at) markOne.mutate(n.id);
  if (!n.link) return;
  const url = new URL(n.link, window.location.origin);
  const search = Object.fromEntries(url.searchParams.entries());
  navigate({ to: url.pathname as any, search: search as any });
};
```

Con esto, al abrir una notificación cuyo link incluye `?destajo=<id>`, el query llega a la URL, `DestajosModule` lo lee en su `useEffect` de montaje y abre automáticamente el `DestajoDetalleSheet` correspondiente.

No requiere cambios en `destajos.functions.ts` ni en `DestajosModule.tsx`.
