## Cambio
Renombrar el estatus `cotizada` → `solicitada` en el enum `renta_estatus`. El estado ahora significa "solicitud enviada, pendiente de autorización" (haya sido cotizada por el administrativo o no). El hecho de "estar cotizada" se infiere de tener `proveedor_id` y `tarifa_unitaria` capturados.

Además: eliminar el botón "Guardar borrador" en la creación — la única acción será **Enviar solicitud**, que deja la renta en `solicitada` y notifica al administrativo/director.

## Flujo resultante
`solicitada` → (administrativo cotiza: llena proveedor, tarifa, etc. — sigue en `solicitada`) → `autorizada` (supervisor/director) → `activa` (al marcar llegada) → `devuelta`.
Rama alterna: `rechazada` (re-editable).

## Migración de base de datos
1. Agregar valor `solicitada` al enum `renta_estatus`.
2. `UPDATE obra_rentas SET estatus = 'solicitada' WHERE estatus IN ('cotizada','borrador')` — los borradores existentes se envían también, dado que el flujo de borrador desaparece.
3. Nota: PostgreSQL no permite eliminar valores de enum, así que `cotizada` y `borrador` quedan en el tipo pero sin uso.

## Archivos a modificar

**`src/lib/api/rentas.functions.ts`**
- `crearSolicitudRenta`: quitar el parámetro `enviar`, forzar `estatus: "solicitada"` y siempre notificar administrativos/directores.
- `cotizarRenta`: cambiar validación `renta.estatus !== "borrador" && "rechazada"` → aceptar `solicitada` y `rechazada`; al guardar mantener `estatus: "solicitada"` (sólo actualiza proveedor/tarifa/etc.).
- `autorizarRenta`: aceptar `solicitada` en lugar de `cotizada`.
- `eliminarRenta`: la restricción "solo borrador salvo director" se cambia a "solo solicitada sin cotizar (sin proveedor_id) salvo director".

**`src/components/rentas/NuevaRentaDialog.tsx`**
- Un solo botón **Enviar solicitud**; quitar "Guardar borrador".
- Toast: "Solicitud enviada".

**`src/components/rentas/RentaDetalleSheet.tsx` y `RentasModule.tsx`**
- Reemplazar `"cotizada"` por `"solicitada"` en los tipos y en `ESTATUS_LABEL` / `ESTATUS_VARIANT`. Label: "Solicitada".
- El botón "Cotizar" aparece cuando `estatus === "solicitada"` y el usuario es administrativo/director; se puede re-cotizar hasta que se autorice.
- Botón "Autorizar" cuando `estatus === "solicitada"` y hay `proveedor_id` + `tarifa_unitaria` capturados (evita autorizar sin datos).

**`src/lib/notificaciones/catalogo.ts`**
- Renombrar la clave/label `renta_cotizada` → `renta_solicitada` ("Renta solicitada"). Ajustar la referencia en `rentas.functions.ts`.

**`src/integrations/supabase/types.ts`**
- Se regenera automáticamente al aplicar la migración.

## Fuera de alcance
- No se elimina el valor `cotizada` ni `borrador` del enum (Postgres no lo permite sin recrear el tipo). Sólo dejan de usarse.
- No se toca cotización, autorización, activación ni devolución más allá del rename.
