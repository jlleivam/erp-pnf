El bug: en `TrabajadorFormDialog.tsx` la validación de `sexo`, `puesto` y `sueldo_diario` está dentro de `if (!isEdit && !canManage)`, por lo que se omite cuando el usuario tiene permisos de administrar (admin/director). Se permite guardar sin puesto ni sueldo.

## Cambios

1. **`src/components/trabajadores/TrabajadorFormDialog.tsx`**
   - Sacar las validaciones de `puesto` y `sueldo_diario` (>0) del bloque condicional para que apliquen siempre (crear y editar, con o sin permisos).
   - `sexo` se mantiene como requerido solo en modo solicitud (no aplica al editar/admin), salvo indicación contraria.
   - Añadir asteriscos rojos permanentes (`<Req />`) a las labels de "Puesto" y "Sueldo semanal (MXN)" para que sean obligatorios siempre visualmente.

2. **`src/lib/api/trabajadores.functions.ts`**
   - Ajustar el schema Zod: `puesto` requerido (no nullable) y `sueldo_diario` requerido con `min` > 0, aplicando tanto en creación como en actualización.
