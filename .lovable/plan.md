Al completar el onboarding (crear empresa), insertar una notificación de bienvenida para el nuevo director que lo dirige a Configuración de empresa.

## Cambios

- `src/lib/api/auth.functions.ts` (`completeOnboarding` handler):
  - Tras crear la empresa y el rol de director, insertar en `notificaciones` una fila para el nuevo usuario:
    - `user_id`: `userId`
    - `company_id`: `company.id`
    - `tipo`: `"bienvenida"`
    - `titulo`: `"¡Bienvenido a Lovable Constructoras!"` (o similar)
    - `mensaje`: `"Configura los datos de tu empresa para comenzar."`
    - `link`: `"/app/configuracion"`
  - Usar `supabaseAdmin` (mismo cliente que ya crea empresa/rol) para saltar RLS. Si el insert falla, no romper el onboarding — loggear y continuar.

- `src/components/NotificacionesBell.tsx`:
  - Verificar que al hacer click en una notificación con `link`, navega a esa ruta y la marca como leída. Si aún no lo hace, añadir `navigate({ to: item.link })` en el handler de click. (Confirmaré al implementar leyendo el archivo.)

Sin cambios de esquema: la tabla `notificaciones` ya tiene las columnas necesarias (`tipo`, `titulo`, `mensaje`, `link`).
