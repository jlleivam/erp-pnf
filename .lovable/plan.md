# Botón "Ver vigente" dentro de la captura de Orden de Cambio

Agregar un botón de solo lectura para consultar el **presupuesto/destajo/subcontrato vigente** mientras se captura una OC, sin tener que cerrar la hoja.

## Alcance

Tres hojas de captura de OC:
1. `CapturaOrdenCambioSheet.tsx` (Presupuesto de obra)
2. `CapturaOrdenCambioDestajoSheet.tsx` (Destajos)
3. `CapturaOrdenCambioSubcontratoSheet.tsx` (Subcontratos)

## UI

- Agregar un botón **"Ver vigente"** (icono `Eye`, variante `outline`, tamaño `sm`) en la barra superior de acciones, junto a "Agregar movimiento" / badge de errores.
- Al hacer clic, abre un **Dialog** (no Sheet, para evitar apilar Sheets) ancho con la tabla del vigente en modo solo-lectura: Clave, Concepto, Unidad, Cantidad, PU, Importe + total al pie. Mismo render que `VerVigenteSheet` (jerarquía con padding por nivel, badges Mod/Nuevo).
- Los datos del vigente ya se cargan en cada captura sheet (`vigQ`), así que solo se reusa esa query — sin llamadas extra al servidor.

## Implementación técnica

1. **Nuevo componente** `src/components/presupuesto/VigenteViewerDialog.tsx`
   - Props: `open`, `onClose`, `vigente: any[]`, `total: number`, `title?: string`.
   - Render genérico (sirve para los 3 módulos; las filas tienen la misma forma).
2. En cada uno de los 3 sheets:
   - Agregar estado `const [showVigente, setShowVigente] = useState(false)`.
   - Botón "Ver vigente" antes del badge de errores.
   - Renderizar `<VigenteViewerDialog />` pasándole `vigente` y total calculado (`sum importe` o `montoTotal` cuando esté disponible).
3. Sin cambios en backend, RLS, ni lógica de cálculo.

## Out of scope

- No se permite editar desde la vista.
- No se agrega navegación al presupuesto completo (solo el vigente consolidado).
