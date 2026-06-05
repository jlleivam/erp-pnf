En `src/components/requisiciones/NuevaRequisicionSheet.tsx`, modificar el componente `InsumoPicker` para que el `CommandInput` reciba foco automáticamente cuando el `Popover` se abre.

Opciones a evaluar:
- Pasar `autoFocus` directamente al `CommandInput` (prop nativa de cmdk).
- Si `autoFocus` no funciona con el render de shadcn, usar `useRef` + `useEffect` que detecte `open === true` y llame `.focus()` al input subyacente.

Resultado esperado: el usuario abre el popover y el cursor ya está en el campo "Buscar insumo…", listo para escribir sin clic adicional.