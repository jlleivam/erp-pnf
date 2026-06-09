## Cambio

En `src/components/nomina/CapturaNominaSheet.tsx`, celda de Trabajador (líneas ~223–241):

Reorganizar el contenido en este orden vertical:
1. **Nombre** del trabajador (`font-medium`, como hoy).
2. **Puesto** (texto pequeño, muted — como hoy).
3. **Badge de destajo** (si aplica): sin el ícono `Lock`, con texto en color rojo (`text-destructive`). Mantener el `Badge variant="outline"` y el `title` informativo.

No se quita la importación de `Lock` si se usa en otro lugar del archivo (verificar; si solo se usaba aquí, se remueve del `import`).

Sin cambios de lógica ni en otros archivos.
