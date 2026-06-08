# Garantizar que "Vista: <Rol>" se comporte exactamente como ese rol

## Estado actual

El toggle ya está conectado a `useEffectiveRoles()`, que devuelve **solo el rol simulado** cuando un director está actuando como otro perfil. Casi todos los módulos (`RequisicionesModule`, `ComparativaTable`, `CajaChicaModule`, `GasolinasModule`, `RentasModule`, `CatalogoInsumosModule`) ya gatean su UI con esos roles efectivos, así que respetan la simulación.

La única fuga que existía era el botón **Registrar recepción** en `CotizacionSheet`, que se gateaba con `oc.puede_recibir` calculado en el backend con los roles **reales** del usuario. Eso ya quedó corregido en el cambio anterior — ahora usa `roles.includes("director") || roles.includes("residente")` desde `useEffectiveRoles`.

## Limpieza pendiente para evitar reincidencias

1. **`src/lib/api/cotizaciones.functions.ts`**: ya no se consume `puede_recibir` desde el cliente, pero sigue siendo enviado en la respuesta de `getCotizacionRequisicion`. Eliminar:
   - El cálculo de `puedeRecibir` (consulta a `user_roles` + `obra_team` para residente).
   - El campo `puede_recibir` del objeto de cada OC.

   El backend `registrarRecepcion` en `almacen.functions.ts` mantiene su validación estricta con roles reales (director o residente de la obra), así que la seguridad no se debilita: la simulación afecta solo a la UI, y si por error un administrativo simulado intentara invocar el endpoint, seguiría siendo rechazado.

2. **Auditoría rápida (sin cambios)**: confirmar que ningún otro componente lee flags de permiso devueltos por el backend para mostrar/ocultar acciones. Ya verifiqué que `puede_recibir` era el único; el resto del gating se hace en el cliente con `useEffectiveRoles`.

## Fuera de alcance

- No se altera la lógica de `assumedRole` ni el componente del toggle.
- No se cambian las validaciones de seguridad del backend (siguen usando roles reales — esto es intencional, defensa en profundidad).
- No se elimina aún el toggle de la app; el usuario lo retirará más adelante.
