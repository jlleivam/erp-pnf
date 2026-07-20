Preservar el estado de los formularios de Configuración al cambiar entre pestañas. Al navegar fuera del módulo (o al usar Descartar/Guardar) los cambios no persistidos se descartan como hoy.

## Causa
Radix `TabsContent` desmonta el contenido inactivo, por lo que el estado local (`useState` / `useForm`) de cada pestaña se pierde al cambiar de tab.

## Solución
Montar todas las pestañas simultáneamente y ocultarlas con CSS mientras están inactivas, usando `forceMount` de Radix. Así el estado de los formularios sobrevive al cambio de pestaña, pero se descarta al desmontarse la ruta (navegar a otro módulo, Descartar, Guardar).

## Cambios técnicos
- `src/routes/_authenticated/app.configuracion.tsx`:
  - Agregar `forceMount` a cada `<TabsContent>` y `className="mt-4 data-[state=inactive]:hidden"` para ocultar las inactivas sin desmontarlas.

Sin cambios en las pestañas hijas ni backend.
