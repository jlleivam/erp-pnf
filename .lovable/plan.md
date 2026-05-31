## Problema

En la pestaña Requisiciones no aparece el botón "Nueva" cuando el usuario tiene el rol **Residente**. En `RequisicionesModule.tsx` (línea 23‑25) el cálculo de `puedeCrear` solo incluye `director`, `pm`, `auxiliar` y `administrativo` — el rol `residente` quedó fuera, por eso el residente no puede iniciar una nueva requisición.

## Cambio

Agregar `"residente"` a la lista de roles autorizados a crear requisiciones:

```ts
const puedeCrear = isDirector(roles) || roles.some((r) =>
  ["pm", "auxiliar", "administrativo", "residente"].includes(r as string)
);
```

## Verificación

- Revisar el servidor (`createRequisicion` en `requisiciones.functions.ts`) para confirmar que la validación de rol del backend también acepta `residente`. Si no, ampliarla del mismo modo para evitar un 403 al enviar el formulario.
- No se tocan políticas RLS ni otros componentes.

## Archivos

- `src/components/requisiciones/RequisicionesModule.tsx` (UI del botón)
- Posible ajuste en `src/lib/api/requisiciones.functions.ts` si la validación server-side excluye a residente.
