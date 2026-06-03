## Contexto
El dashboard de obra muestra un `MobileBottomBar` (menú inferior) cuando el usuario está dentro de una obra (`isInsideObra`). Actualmente la lista de módulos en ese menú incluye: Presupuesto, Requisiciones, Nómina, Destajos, Subcontratos, Almacén, Rentas, Gasolinas, Caja chica y Tareas. Falta el módulo de **Estimaciones**.

## Cambio
Agregar el módulo **Estimaciones** al menú inferior de obra en `AppShell.tsx`.

### Archivo a modificar
- `src/components/AppShell.tsx`

### Detalle técnico
1. Importar el icono `BarChart3` (o similar) de `lucide-react` junto a los demás imports.
2. Agregar al array `items` del `MobileBottomBar` contextual (dentro de `isInsideObra`) una nueva entrada:
   - `to: /app/obras/${obraId}/estimaciones`
   - `label: "Estimaciones"`
   - `icon: BarChart3`

No se requieren cambios en rutas ni en otros componentes; la ruta `/app/obras/$obraId/estimaciones` ya está registrada y el componente `EstimacionesModule` ya existe y funciona.