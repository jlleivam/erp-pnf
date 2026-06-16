## Notificaciones de rentas

Agregar notificaciones in-app en los tres pasos del flujo, siguiendo el patrón ya usado en cotizaciones/OC (insert directo a `public.notificaciones` con `supabaseAdmin`, dentro de un `try/catch` para no romper la operación principal).

### Cambios — `src/lib/api/rentas.functions.ts`

**1. `crearRenta` (residente envía solicitud)**
Después del insert exitoso, notificar a todos los usuarios con rol `administrativo` o `director` de la compañía:
- `tipo`: `renta_solicitada`
- `titulo`: `Nueva solicitud de renta #<numero>`
- `mensaje`: `<equipo> · obra <nombre> — pendiente de cotizar`
- `link`: `/app/obras/<obraId>/rentas`
- `obra_id`: la obra

**2. `cotizarRenta` (admin cotiza)**
Después del update a `cotizada`, notificar a supervisores + directores de la compañía (excluyendo al propio admin):
- `tipo`: `renta_cotizada`
- `titulo`: `Renta #<numero> pendiente de autorizar`
- `mensaje`: `<equipo> — cotizada por <admin>, requiere tu autorización`
- `link`: `/app/obras/<obraId>/rentas`

**3. `autorizarRenta` (supervisor autoriza)**
Después del update a `autorizada`, notificar a:
- el `creado_por` (residente que solicitó)
- todos los administrativos + directores de la compañía
Excluyendo al propio supervisor; deduplicar por `user_id`.
- `tipo`: `renta_autorizada`
- `titulo`: `Renta #<numero> autorizada`
- `mensaje`: `<equipo> autorizada — lista para gestionar llegada`
- `link`: `/app/obras/<obraId>/rentas`

### Detalles técnicos

- Cargar `obraId`, `numero`, `equipo` y `creado_por` en cada handler (en `cotizar`/`autorizar` se hace un `select` extra a `obra_rentas` para traer los campos faltantes).
- Usar el helper inline ya existente en el archivo (no hay helper extraído; replicar el patrón de `cotizaciones.functions.ts` con `await import("@/integrations/supabase/client.server")`).
- Envolver cada bloque de notificación en `try/catch` con `console.error("[notificaciones] …")` para no fallar la transición de estado si la inserción de notificación falla.
- Deduplicar destinatarios y excluir al `userId` que ejecuta la acción.

### Fuera de alcance

- Rechazos, renovaciones, llegada y devolución (puedo agregarlos después si lo pides).
- Notificaciones por email (sólo in-app, igual que el resto del sistema).
- Realtime push (las notificaciones aparecen al refrescar el badge ya existente).
