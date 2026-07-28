## Problema

En `CapturaNominaSheet.tsx` (línea 127) se calcula:

```ts
const isClosed = readOnly || nomina?.estatus === "cerrada";
```

Y el badge "Cerrada" se muestra cuando `isClosed` es true (línea 142-146).

El supervisor no es director ni residente de la obra, por lo que en `NominaModule.tsx` (línea 158) recibe `readOnly: true` aunque el estatus real sea `borrador`. Resultado: ve el badge "Cerrada" aunque la nómina esté activa.

## Fix

En `src/components/nomina/CapturaNominaSheet.tsx`:

1. Separar los dos conceptos:
   - `isClosed = nomina?.estatus === "cerrada"` → controla el badge "Cerrada" y bloquea el botón de cerrar semana.
   - `isReadOnly = readOnly || isClosed` → controla que los inputs de asistencia/HE, "Asignar trabajadores" y demás acciones queden deshabilitados.
2. Reemplazar los usos actuales de `isClosed` que en realidad significan "no editable" por `isReadOnly`, y dejar `isClosed` sólo para el badge y la lógica de cierre.

Así el supervisor ve la nómina en modo consulta con badge "Activa" (o sin badge) en lugar de "Cerrada", igual que en la lista del módulo.