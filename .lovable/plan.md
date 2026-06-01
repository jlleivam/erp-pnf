## Vista del Supervisor — Autorización de OCs

### Objetivo
Permitir al supervisor revisar y autorizar/rechazar las OCs pendientes, ya sea entrando por obra o desde un acceso global en el menú lateral.

### 1. Acceso desde la obra
En `RequisicionesModule.tsx`, cuando el usuario tiene rol `supervisor` y una requisición está en estatus `pendiente_autorizacion`:
- Mostrar botón **"Revisar y autorizar"** en la fila/tarjeta de la requisición.
- Al hacer click, abre `CotizacionSheet` con `initialTab="comparativa"` (saltando directamente a la pestaña donde están las tarjetas de pedidos por proveedor).

### 2. Acceso global desde el menú lateral
En `AppShell.tsx`:
- Agregar grupo **"Supervisión"** en el sidebar, visible solo si `effRoles.includes('supervisor')` o `director`.
- Item: **"Por autorizar"** → link a nueva ruta `/app/supervisor/requisiciones`.

### 3. Nueva ruta `/app/supervisor/requisiciones`
- Reusa `listRequisicionesAsignadas` (ya filtra por `obra_team` para supervisor; director ve todo).
- Dos pestañas:
  - **Por autorizar**: filtra `estatus === 'pendiente_autorizacion'`.
  - **Historial**: el resto (autorizadas, rechazadas, completadas).
- Cada fila muestra: folio, obra, fecha, # de OCs pendientes, botón **"Revisar"** → abre `CotizacionSheet` en tab `comparativa`.

### 4. Tarjetas Autorizar/Rechazar en Comparativa
En `ComparativaTable.tsx` → sección "Pedidos por proveedor":
- Para cada OC en estatus `pendiente_autorizacion`, si el usuario es **supervisor** (y no admin), mostrar dos botones:
  - **Autorizar** → llama nueva server fn `autorizarOC({ ocId })` que marca `estatus='autorizada'`, `autorizada_at=now()`, `autorizada_por=auth.uid()`.
  - **Rechazar** → abre dialog para capturar motivo (opcional), llama `rechazarOC({ ocId, motivo })` que marca `estatus='rechazada'`, `rechazada_at`, `rechazada_por`, guarda motivo en `notas_supervisor`.
- Si la OC ya está autorizada/rechazada, mostrar badge de estado + fecha + nombre del supervisor.
- El admin sigue viendo las tarjetas en modo lectura (sin botones de autorizar).

### 5. Pestaña OC
- Las OCs autorizadas ya aparecen ahí (sin cambios de esquema).
- El admin las verá listas para "enviar al proveedor" (se implementa en otro turno como acordamos).

### Archivos a tocar
- `src/lib/cotizaciones.functions.ts` — agregar `autorizarOC`, `rechazarOC`.
- `src/components/requisiciones/ComparativaTable.tsx` — botones Autorizar/Rechazar en tarjetas de pedidos por proveedor según rol.
- `src/components/requisiciones/RequisicionesModule.tsx` — botón "Revisar y autorizar" para supervisor.
- `src/components/requisiciones/CotizacionSheet.tsx` — aceptar prop `initialTab`.
- `src/components/layouts/AppShell.tsx` — grupo "Supervisión" en sidebar.
- `src/routes/app/supervisor/requisiciones.tsx` — nueva ruta con lista global y tabs.

### No incluido en este turno
- Botón "Enviar a proveedor" para admin (queda para próxima iteración con su migración).
