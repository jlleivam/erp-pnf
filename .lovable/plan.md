# Agregar checkboxes al login

Modificar `src/routes/login.tsx`:

1. **Importar** `Checkbox` de `@/components/ui/checkbox`.
2. **Nuevos estados**:
   - `rememberEmail` (bool, inicial: leer `localStorage.getItem("login:remember-email")` para prellenar checked + email).
   - `keepSession` (bool, inicial: `true` por defecto — Supabase ya persiste sesión por defecto).
3. **Prellenar email** al montar: si hay email guardado en `localStorage`, ponerlo en el campo y marcar el checkbox.
4. **Dos checkboxes** debajo del campo de contraseña, antes del botón:
   - "Recuerda mi cuenta" → al hacer submit, si está marcado guarda `email` en `localStorage`; si no, lo borra.
   - "Mantén mi sesión abierta" → controla persistencia de Supabase.
5. **En `handleSubmit`**:
   - Antes de `signInWithPassword`, ajustar el storage de Supabase Auth según `keepSession`:
     - Si `keepSession` está marcado: usar `localStorage` (sesión persiste al cerrar el navegador) — comportamiento actual por defecto.
     - Si NO está marcado: cambiar a `sessionStorage` para que la sesión expire al cerrar el navegador. Implementación: llamar `supabase.auth.signOut({ scope: 'local' })` previo no aplica; en su lugar, tras login exitoso, mover el token de `localStorage` a `sessionStorage` manualmente (key `sb-<project>-auth-token`), o re-configurar antes. La opción más limpia: tras login, si `!keepSession`, copiar el item de `localStorage` a `sessionStorage` y borrar del `localStorage`. El cliente Supabase preconfigurado usa `localStorage`; al recargar leerá de ahí. Como no podemos editar el cliente, alternativa práctica: registrar un listener `beforeunload` que limpie `localStorage` del token si `!keepSession` — pero eso cierra la sesión al cerrar pestaña.
   - Guardar/borrar email recordado en `localStorage` clave `login:remember-email`.

## Nota técnica
El cliente Supabase de este proyecto (`src/integrations/supabase/client.ts`) está auto-generado y siempre usa `localStorage`. Para "no mantener sesión" implementaremos un workaround: tras login, si el usuario NO marcó "Mantén mi sesión abierta", se registra un handler `window.addEventListener("beforeunload")` que llama `supabase.auth.signOut()` al cerrar pestaña/navegador. Esto cumple la intención sin tocar el cliente generado.

## Resultado UI
```
[ Correo electrónico ]
[ Contraseña         ]
[x] Recuerda mi cuenta
[x] Mantén mi sesión abierta
[       Ingresar      ]
```

Solo se modifica `src/routes/login.tsx`. Sin cambios de backend.