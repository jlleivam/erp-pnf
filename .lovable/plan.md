## Problema

El diálogo "Solicitar insumo" (`SolicitarDialog` en `CatalogoInsumosModule.tsx`) es genérico para todos los roles: solo pide nombre, unidad y categoría, y el server function `solicitarInsumo` siempre inserta el insumo como `estatus: "pendiente"` sin tocar `disponible_renta`. Por eso, aun siendo Director, no aparece el checkbox al crear — actualmente solo se ofrece al editar (`EditarInsumoDialog`).

## Cambios

### 1. UI — `src/components/insumos/CatalogoInsumosModule.tsx`
- En `SolicitarDialog`, recibir `isDirector` como prop (ya disponible en el módulo padre).
- Si `isDirector`, mostrar un `Checkbox` "Disponible para rentas" (default: `false`), con la misma copy/ayuda que en `EditarInsumoDialog`.
- Cambiar el título/CTA dinámicamente según el rol:
  - Director: "Nuevo insumo" / botón "Crear"
  - No-director: "Solicitar insumo" / botón "Solicitar" (comportamiento actual sin cambios)
- Enviar `disponibleRenta` en la mutación solo cuando el usuario es Director.

### 2. Backend — `src/lib/api/insumos.functions.ts`
- Ampliar `solicitarInsumo`:
  - Agregar al schema `disponibleRenta: z.boolean().optional()`.
  - En el handler, leer `isDirector` desde `getUserCompanyAndDirector`.
  - Si `isDirector`: ignorar el flujo de solicitud y crear el insumo directamente como `estatus: "autorizado"`, con `autorizado_por = userId`, `autorizado_at = now()`, y `disponible_renta = data.disponibleRenta ?? false`.
  - Si no es Director: mantener comportamiento actual (pendiente, ignorar `disponibleRenta`).
- No requiere migración: las columnas `disponible_renta`, `autorizado_por`, `autorizado_at` y `estatus` ya existen.

### Fuera de alcance
- Categorías, unidades, importación masiva y módulo de rentas — sin cambios.
- Permisos RLS — sin cambios (Director ya puede insertar autorizados).

## Resultado esperado
Cuando el Director abra el diálogo desde el catálogo, verá el checkbox "Disponible para rentas" y el insumo quedará creado y autorizado en un solo paso, ya marcado (o no) para rentas según su selección.