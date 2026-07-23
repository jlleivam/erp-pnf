## Diagnóstico

El código sí está en `CapturaPresupuestoSheet.tsx` (state `activeRowId`, `addRow` insertando en `idx + 1`, y estilo `esActivo`), pero `handleRowClick` ignora el evento cuando el target está dentro de un `input, button, textarea, select, label`:

```ts
if ((e.target as HTMLElement).closest("input, button, textarea, select, label")) return;
```

Como cada celda del renglón está ocupada por un `<Input>`, cualquier clic dentro del renglón cae sobre un input y el guard sale antes de setear `activeRowId`. Resultado: nunca se resalta ni cambia el punto de inserción. Solo funcionaría si se diera clic en el borde/padding de la fila, cosa prácticamente imposible.

## Corrección

Detectar el renglón activo por **foco** en lugar de por clic, así los inputs sí lo activan al hacer clic o tabular hacia ellos.

### Cambios en `src/components/presupuesto/CapturaPresupuestoSheet.tsx`

1. Reemplazar `handleRowClick` por un handler basado en focus que se aplica en el `<tr>`:
   ```tsx
   const handleRowFocus = (id: string) => () => setActiveRowId(id);
   ```
2. En el `<tr>`, quitar `onClick={handleRowClick(...)}` y usar:
   ```tsx
   onFocus={handleRowFocus(r._id)}
   onMouseDown={() => setActiveRowId(r._id)}
   ```
   - `onFocus` burbujea desde cualquier input hijo → cubre clic en inputs y navegación por teclado.
   - `onMouseDown` cubre clic en zonas no interactivas del renglón (padding, celda de importe, etc.) para renglones "padre" cuyos inputs están deshabilitados.
3. Mantener el estilo `esActivo` con `bg-muted/60` + ring y `transition-colors` que ya existe.

Nada más se toca; `addRow` ya inserta correctamente después de `activeRowId`.

## Verificación

- Playwright: abrir el sheet de presupuesto, hacer clic dentro del input "Concepto" del renglón 2 de 3, confirmar highlight; presionar "Agregar renglón" y verificar que aparece en posición 3 (no al final).
- Screenshot del renglón resaltado.
