En el formulario de 3 pasos de Nueva obra (`/app/obras/nueva`), agregar un botón **Cancelar** junto a los botones de acción en cada paso. Al hacer clic, navega de vuelta a `/app` sin guardar cambios.

**Técnico**
- `src/routes/_authenticated/app.obras.nueva.tsx`:
  - Step 1: reemplazar el botón "Continuar" solitario por un grupo con "Cancelar" (variant outline) a la izquierda y "Continuar" a la derecha. Cancelar usa `navigate({ to: "/app" })`.
  - Step 2: el grupo inferior ya tiene "Atrás" y "Continuar"; agregar "Cancelar" a la izquierda del todo.
  - Step 3: igual que step 2, agregar "Cancelar" a la izquierda del grupo inferior.
- Usar `useNavigate` que ya está importado. No se requieren cambios de backend ni schema.
