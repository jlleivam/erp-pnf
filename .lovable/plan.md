## Cambios en `CapturaEstimacionDestajoSheet.tsx`

Compactar para dar protagonismo a la tabla de conceptos. Todo en frontend.

### 1. Header más compacto
- Eliminar `SheetDescription` ("Captura la cantidad ejecutada…").
- `SheetTitle` con `text-base` y rango de semana inline.

### 2. StatCards condensados
- Reducir padding (`p-2` en vez del default) y tipografía: label `text-[10px]`, value `text-sm font-semibold`.
- Margen superior `mt-3` en lugar de `mt-6`.

### 3. Buscador compacto
- `h-8`, `mt-3`.

### 4. Tabla — protagonista, una fila por concepto
- Reducir paddings de celdas y header a `py-1.5 px-2`, fuente `text-[13px]`.
- Header: `text-[10px]`.
- Forzar **una sola línea por concepto**: en `<table>` agregar `table-fixed`; ajustar anchos: clave `w-16`, un. `w-12`, cant. vig. `w-20`, acum. prev. `w-20`, esta semana `w-24`, importe sem. `w-28`, % acum. `w-16`. Columna concepto toma el resto.
- Celda Concepto: `truncate` con `Tooltip` envolviendo el texto para mostrar el concepto completo on hover. Importar `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider` de `@/components/ui/tooltip`. Envolver la tabla (o el componente raíz) en un `TooltipProvider`.
- **Centrar todas las columnas excepto Concepto y Clave (jerárquica con indent)**: cambiar `text-right`/`text-left` por `text-center` en headers y celdas de Un., Cant. vig., Acum. prev., Esta semana, Importe sem., % Acum.  
  - Clave permanece alineada a la izquierda (mantiene su `paddingLeft` jerárquico).
  - Concepto permanece a la izquierda.
  - Input de "Esta semana": `text-center` en lugar de `text-right`, alto `h-7`.

### 5. Card de cálculo de pago
- `p-2` en vez de `p-3`, `text-xs`, `mt-3`.

### 6. Footer
- `py-2` y botones `size="sm"`.

Sin cambios de lógica de negocio ni de tipado.
