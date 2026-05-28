Cambiar el campo `regimen_fiscal` del formulario de clientes de texto libre a un menú desplegable (Select) con opciones oficiales del SAT filtradas según el tipo de persona seleccionado. Aplicar el mismo comportamiento en la vista de detalle.

### Cambios en `ClienteFormDialog.tsx`
1. Definir dos listas de regímenes fiscales:
   - Moral: 601, 603, 620, 622, 623, 626
   - Física: 605, 606, 607, 608, 612, 616, 621, 626
2. Reemplazar el `<Input>` de régimen fiscal por un componente `<Select>` del shadcn.
3. El `<Select>` se llena dinámicamente con la lista correspondiente al valor actual de `tipo_persona`.
4. Al cambiar `tipo_persona`, si `regimen_fiscal` ya tenía un valor seleccionado, limpiarlo automáticamente (setear a `null`).
5. Las opciones del Select muestran el texto completo (clave + descripción) y guardan el mismo texto completo en el estado.
6. El placeholder del Select dirá "Selecciona un régimen fiscal".

### Cambios en `ClienteDetalle.tsx`
1. En la pestaña "Generales", el campo "Régimen fiscal" ya se muestra como texto. No se requiere cambio visual adicional, ya que el valor guardado incluye clave y descripción.

### Archivos afectados
- `src/components/clientes/ClienteFormDialog.tsx`
- `src/components/clientes/ClienteDetalle.tsx` (solo verificar que renderice correctamente el nuevo formato; no requiere modificación estructural)