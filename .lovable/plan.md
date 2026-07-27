Agregar un botón "Volver al inicio" en la página de onboarding (`src/routes/onboarding.tsx`) que navegue a `/`.

## Detalles

- Añadir un `Link` de `@tanstack/react-router` (con `ChevronLeft`) arriba del `Card`, o como botón secundario dentro del `CardHeader`.
- Estilo discreto (variant ghost / texto muted) para no competir con el flujo principal.
- Visible en ambos pasos (1 y 2).