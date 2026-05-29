# Fix: bucle infinito al entrar a Requisiciones como residente

## Causa
El helper `useEffectiveRoles` que se agregó en el cambio anterior hace:
```ts
useAuthStore((s) => effectiveRoles(s.roles, s.assumedRole))
```
`effectiveRoles` devuelve un **arreglo nuevo** (`[assumed]`) en cada llamada. Zustand compara con `Object.is`, ve referencia distinta cada render → re-render → llamada nueva → loop. React lo aborta con el error #185 ("Maximum update depth exceeded") y se muestra el `errorComponent` ("No se pudo cargar la página").

Solo truena en las vistas migradas (Requisiciones de obra, Insumos, Clientes, Terceros, Trabajadores, módulo de obra).

## Cambio
`src/stores/auth.ts`: reescribir `useEffectiveRoles` para seleccionar primitivas estables y derivar el arreglo con `useMemo`:

```ts
import { useMemo } from "react";

export function useEffectiveRoles(): AppRole[] {
  const roles = useAuthStore((s) => s.roles);
  const assumed = useAuthStore((s) => s.assumedRole);
  return useMemo(() => effectiveRoles(roles, assumed), [roles, assumed]);
}
```

`s.roles` y `s.assumedRole` solo cambian en `setSession` / `setAssumedRole`, así que las suscripciones son estables y `useMemo` evita crear un arreglo nuevo en cada render.

Ningún otro archivo cambia (firma del hook idéntica).

## Verificación
Entrar a `/app/obras/:obraId/requisiciones` con vista "Residente" — debe cargar el módulo sin el error.
