Agregar botón "Descartar" y renombrar "Guardar cambios" a "Guardar" en el encabezado de Configuración de empresa, visibles en todas las pestañas.

## Comportamiento
- **Descartar**: cierra la ventana y regresa a `/app` sin persistir cambios. No dispara mutaciones.
- **Guardar**: mantiene la lógica actual (`handleSaveAndClose` → guarda la pestaña activa y cierra).
- Ambos botones se deshabilitan mientras el guardado está en curso.

## Cambios técnicos
- `src/routes/_authenticated/app.configuracion.tsx`:
  - Cambiar el texto del botón actual de "Guardar cambios" a "Guardar".
  - Añadir `<Button variant="outline" onClick={handleDiscard}>Descartar</Button>` a su izquierda.
  - `handleDiscard` → `navigate({ to: '/app' })`.

Sin cambios en pestañas hijas ni backend.
