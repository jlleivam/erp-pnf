## Objetivo

Que el estatus del destajo en la lista refleje el del presupuesto base (Borrador → Pendiente autorización → Autorizado / Rechazado), y que **solo se pueda eliminar un destajo cuando el presupuesto base está en borrador** (no enviado todavía).

## Contexto

Hoy `obra_destajos.estatus` se queda en `'borrador'` para siempre — nunca se actualiza al enviar/autorizar el presupuesto base. Por eso en la tabla siempre aparece "Borrador" y siempre aparece el botón eliminar (mientras no haya pagos), aun cuando el residente ya envió el presupuesto al supervisor.

El flujo real de estatus vive en `obra_destajo_presupuestos` (tipo `base`): `borrador → enviado → autorizado | rechazado`.

## Cambios

### 1. `src/lib/api/destajos.functions.ts` — `listDestajos`
Cargar también el estatus del presupuesto **base** de cada destajo y devolverlo como `estatus_base` en cada fila:

```ts
const { data: bases } = await supabase
  .from("obra_destajo_presupuestos")
  .select("destajo_id, estatus")
  .in("destajo_id", ids)
  .eq("tipo", "base");
const baseMap = new Map(bases?.map(b => [b.destajo_id, b.estatus]));
// ...
return dst.map(d => ({
  ...d,
  estatus_base: baseMap.get(d.id) ?? "borrador",
  ...
}));
```

### 2. `src/lib/api/destajos.functions.ts` — `eliminarDestajo`
Endurecer la regla: además de no permitir eliminar con estimaciones cerradas, **rechazar si el presupuesto base ya no está en `borrador`** (`enviado | autorizado | rechazado`):

```ts
const { data: base } = await supabase
  .from("obra_destajo_presupuestos")
  .select("estatus").eq("destajo_id", data.id).eq("tipo", "base").maybeSingle();
if (base && base.estatus !== "borrador") {
  throw new Error("No se puede eliminar: el presupuesto ya fue enviado a autorización");
}
```

### 3. `src/components/destajos/DestajosModule.tsx`
- Extender el tipo `Destajo` con `estatus_base: "borrador" | "enviado" | "autorizado" | "rechazado"`.
- Usar `d.estatus_base` (en lugar de `d.estatus`) para el `Badge` de la columna **Estatus**, reutilizando `ESTATUS_LABEL` / `ESTATUS_VARIANT` que ya mapean `enviado → "Pendiente autorización"`.
- Mostrar el botón Eliminar solo cuando `director && d.estatus_base === "borrador" && d.pagado_acumulado === 0`.
- Para el cálculo de "Contratado vigente" y "Destajos activos", seguir usando `d.estatus_base === "autorizado"` (más consistente con el flujo real).

## Resultado

- En la lista: un destajo nuevo aparece como **Borrador** y puede eliminarse.
- Al hacer click en "Enviar a autorización" del presupuesto base, su badge cambia a **Pendiente autorización** y el botón eliminar desaparece.
- Si el supervisor lo autoriza/rechaza, el badge sigue al estado del presupuesto base.
- Sin cambios de esquema; solo lectura derivada del presupuesto base.
