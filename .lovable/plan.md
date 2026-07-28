## Objetivo
Hacer más visual la tabla de captura de nómina coloreando los botones de jornada (0, ½, 1) para identificar rápidamente asistencias, medios días y ausencias.

## Cambios (archivo único: `src/components/nomina/CapturaNominaSheet.tsx`, componente `DiaCell`)

Reemplazar el estilo actual donde solo la opción seleccionada usa `bg-primary`. Nuevo esquema:

- **Opción seleccionada (estado activo):**
  - `0` (·, ausencia) → fondo rojo (`bg-destructive text-destructive-foreground`)
  - `½` (medio día) → fondo ámbar (`bg-amber-500 text-white`)
  - `1` (día completo) → fondo verde (`bg-emerald-600 text-white`)
- **Opción no seleccionada:** fondo neutro (`bg-background`) con un hover tintado suave del color correspondiente (`hover:bg-destructive/10`, `hover:bg-amber-500/10`, `hover:bg-emerald-500/10`) para dar pista visual sin saturar.
- Mantener bordes, tamaño y layout actuales (mismo `inline-flex rounded-md border`). Sin cambios en lógica de guardado, en `+h`, ni en columnas de la tabla.

## Detalles técnicos
- Añadir un mapa `{ v, label, activeClass, hoverClass }` dentro del `.map` de opciones y componer clases con `cn(...)`.
- Los colores rojo/verde se toman de tokens semánticos (`destructive`) y utilidades Tailwind (`amber-500`, `emerald-600`) para evitar tener que añadir nuevos tokens al design system. Si prefieres tokens semánticos (`--success`, `--warning`) puedo agregarlos en `src/styles.css`; dime si lo hago.
- No cambia el comportamiento de HE ni el header "HE".

## Fuera de alcance
- Colorear filas por total de días trabajados.
- Cambios en otras pestañas o en la vista de nómina cerrada (se aplica también ahí porque usa el mismo `DiaCell`, lo cual es deseable).