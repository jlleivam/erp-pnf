## Problema

En el sheet de "Presupuesto base" del subcontrato no se muestra el bloque "Condiciones del subcontrato" (Anticipo % / Fondo de garantía %) que sí aparece en el destajo.

La data ya está disponible: `getSubcontratoPresupuesto` ya devuelve `obra_subcontratos.anticipo_pct`, `anticipo_monto` y `fondo_garantia_pct` junto al presupuesto. Solo falta renderizar el bloque en la UI.

## Cambio

Editar `src/components/subcontratos/CapturaSubcontratoSheet.tsx` y agregar, justo debajo de la `Card` con la tabla de renglones y antes del footer de botones, el mismo bloque que tiene `CapturaDestajoSheet.tsx` (líneas 313–368), adaptado a subcontrato:

- Leer `presupuesto.obra_subcontratos.anticipo_pct` y `presupuesto.obra_subcontratos.fondo_garantia_pct`.
- Calcular montos sobre `calc.montoTotal` cuando no hay errores.
- Si ambos % son 0 → Card con "Sin anticipo ni fondo de garantía."
- Si alguno > 0 → Card con título "Condiciones del subcontrato" y filas de Anticipo y/o Fondo de garantía mostrando %, monto y descripción.

No se tocan server functions, esquema, ni lógica de cálculo — es un cambio puramente de presentación.