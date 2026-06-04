# Separar Número Exterior e Interior

## Cambios

1. **Base de datos** (`companies` table)
   - Reemplazar columna `numero` por `numero_exterior` y `numero_interior` (text, nullable)
   - Migración mueve `numero` → `numero_exterior` antes de eliminarla

2. **Backend** (`src/lib/api/company.functions.ts`)
   - Actualizar SELECT y Zod schema: `numero_exterior` (max 50), `numero_interior` (max 50, nullable)

3. **UI** (`src/components/configuracion/FacturacionTab.tsx`)
   - Reemplazar el campo "Número" por dos campos lado a lado: "Número exterior" y "Número interior (opcional)"
   - Layout: grid de 2 columnas dentro de la fila de dirección

4. **Mismo cambio aplicado al formulario de clientes** si tiene el mismo campo (verificar en build mode)

No se tocan obras ni otros módulos.
