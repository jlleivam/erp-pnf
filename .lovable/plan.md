Hacer obligatorio el campo "Apellido materno" en la solicitud de alta de trabajador.

## Cambios

1. **`src/components/trabajadores/TrabajadorFormDialog.tsx`**
   - Agregar el asterisco rojo (`<Req />`) al label de "Apellido materno" en modo solicitud.
   - Incluir validación en `submit`: si está vacío en modo solicitud, mostrar toast de error.

2. **`src/lib/api/trabajadores.functions.ts`**
   - Añadir validación de `apellido_materno` requerido (mismo criterio que `apellido_paterno`) al crear/solicitar alta.
