## Problema real

El widget "DEV Pedro Velazquez" del header **no** es un simulador de rol — es un impersonation de usuario (cambia sesión de auth). Nunca modifica `assumedRole`, por eso el sistema te sigue tratando como Director y aplica el bypass total.

Ya existe la lógica (`switchRole` en `AppShell.tsx` línea 107, `setAssumedRole` en el store, `effectiveRoles` que respeta la simulación), pero **nunca se conectó a un botón visible**.

## Cambio

Agregar un submenú **"Actuar como"** dentro del menú del avatar del usuario (el "PV Pedro Velazquez" del lado derecho), visible solo para Directores reales.

### Contenido del submenú
- **Director (yo mismo)** — resetea `assumedRole = null`
- **Administrativo**
- **Residente**
- **Supervisor**
- **Auxiliar**

Al elegir un rol se llama `setAssumedRole(role)` y navega a `/app`. Un check ✓ marca el rol activo. Cuando hay un rol asumido, mostrar un badge sutil junto al nombre en el header (ej. "Actuando como Administrativo") para que sea evidente.

### Archivo a editar
- `src/components/AppShell.tsx` — el `DropdownMenu` del avatar del usuario.

Nada más. Toda la lógica de gating ya está lista y probada; solo falta la puerta de entrada.
