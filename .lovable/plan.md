## Problema

Después del fix anterior, la URL llega a `/app/obras/<id>/destajos` pero sin el `?destajo=<id>`. Causa: la ruta splat `/_authenticated/app/obras/$obraId/$` no declara `validateSearch`, así que TanStack Router descarta cualquier search param desconocido en `navigate()`. El `?destajo=` nunca se conserva, y el `useEffect` de `DestajosModule` (que además lee `window.location.search` solo al montar) no encuentra nada.

## Cambios

### 1. `src/routes/_authenticated/app.obras.$obraId.$.tsx`

Agregar `validateSearch` para conservar `destajo`:

```tsx
export const Route = createFileRoute("/_authenticated/app/obras/$obraId/$")({
  validateSearch: (s: Record<string, unknown>) => ({
    destajo: typeof s.destajo === "string" ? s.destajo : undefined,
  }),
  component: ObraModule,
});
```

### 2. `src/components/destajos/DestajosModule.tsx`

Reemplazar la lectura por `window.location.search` por el search tipado del router, para que también reaccione si el parámetro llega después del montaje:

```tsx
import { useSearch, useNavigate } from "@tanstack/react-router";
...
const search = useSearch({ strict: false }) as { destajo?: string };
const navigate = useNavigate();

useEffect(() => {
  if (search.destajo) {
    setViewingId(search.destajo);
    navigate({
      to: ".",
      search: (prev: any) => ({ ...prev, destajo: undefined }),
      replace: true,
    });
  }
}, [search.destajo]);
```

Eliminar el `useEffect` previo basado en `window.location.search`.

No requiere cambios en `NotificacionesBell.tsx`, en `destajos.functions.ts`, ni en la base de datos (las notificaciones existentes ya guardan el link correcto `/app/obras/<obraId>/destajos?destajo=<destajoId>`).
