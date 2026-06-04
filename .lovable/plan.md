1. Backend — `src/lib/api/obras.functions.ts`
   - Update `crearObraSchema.comisiones[].base_calculo` enum from `["monto_contratado", "monto_cobrado"]` to include `"utilidad"`.
   - Update `actualizarObraComisionesSchema.comisiones[].base_calculo` enum the same way.
   - No DB migration needed: `obra_comisiones.base_calculo` is `TEXT`.

2. Frontend — `src/routes/_authenticated/app.obras.$obraId.configuracion.tsx`
   - Update `ComisionRow.base_calculo` type to include `"utilidad"`.
   - Add `"utilidad"` as a dropdown option in the comisiones Select (label: "Utilidad").
   - Change the default `base_calculo` on the "Agregar" button from `"monto_contratado"` to `"utilidad"`.

3. Frontend — `src/routes/_authenticated/app.obras.nueva.tsx`
   - Update `ComisionRow.base_calculo` type to include `"utilidad"`.
   - Add `"utilidad"` as a dropdown option in the comisiones Select (label: "Utilidad").
   - Change the default `base_calculo` on the "Agregar" button from `"monto_contratado"` to `"utilidad"`.