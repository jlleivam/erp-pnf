## Objetivo

Nueva pestaña **Notificaciones** en Configuración de empresa, con la misma estructura que **Permisos**: matriz de tipos de notificación × roles con checkboxes y guardado optimista. A diferencia de Permisos, aquí **el Director sí es editable** — puede elegir qué notificaciones recibir.

## Modelo de datos

Migración nueva: tabla `notificacion_preferencias`:

- `company_id uuid` (FK companies)
- `role app_role` (incluye `director`)
- `tipo text` — clave del catálogo (ej. `oc_autorizada`, `requisicion_enviada`)
- `habilitado boolean not null default true`
- PK compuesta `(company_id, role, tipo)`
- RLS: director de la compañía puede leer/escribir; miembros de la compañía pueden leer.
- GRANT `SELECT, INSERT, UPDATE, DELETE ... TO authenticated` y `GRANT ALL ... TO service_role` en la misma migración.

Semántica: si no existe fila para `(company_id, role, tipo)`, se usa el default del catálogo.

## Catálogo de tipos

Nuevo `src/lib/notificaciones/catalogo.ts`, patrón espejo de `src/lib/permisos/catalogo.ts`:

```ts
export type NotifRole = AppRole; // incluye director
export interface TipoNotificacion {
  key: string;
  modulo: string;
  label: string;
  descripcion?: string;
  defaults: Record<NotifRole, boolean>;
}
```

Poblar con los tipos que hoy se insertan en `notificaciones` (barrido en `src/lib/api/**`): requisiciones (enviada/aprobada/rechazada), órdenes de compra (variantes presupuesto/subcontrato/renta: solicitada/autorizada/rechazada), almacén (recepción, solicitud/resolución de desbloqueo), caja chica (fondo, gasto, reembolso), destajos y subcontratos (creación, estimación cerrada/autorizada/rechazada, anticipo solicitado/pagado), rentas, trabajadores (alta solicitada/autorizada), gastos de oficina, vales de gasolina, cotizaciones, bienvenida. Agrupados por módulo.

## Backend

`src/lib/api/notificaciones-prefs.functions.ts`:

- `listNotificacionPreferencias()` → filas de la compañía activa.
- `setNotificacionPreferencia({ role, tipo, habilitado })` → upsert por PK.
- `shouldNotifyRole(companyId, role, tipo)` helper server-only para futuras conexiones desde los insertadores.

## UI

`src/components/configuracion/NotificacionesTab.tsx`, copia estructural de `PermisosTab.tsx`:

- Filas agrupadas por módulo (`Fragment key=modulo` + header row).
- Columnas: tipo | Residente | Auxiliar | Administrativo | Supervisor | **Director** (editable como los demás).
- Checkbox controlado con mutación optimista contra `setNotificacionPreferencia`.
- Banner informativo: "Los cambios se guardan pero aún no aplican a todas las notificaciones existentes; se irán conectando progresivamente." (mismo tono que Permisos, ya que el enforcement en los ~40 puntos de `.from("notificaciones").insert(...)` se hará por separado.)

Integración en `src/routes/_authenticated/app.configuracion.tsx`:

- Nuevo `<TabsTrigger value="notificaciones">Notificaciones</TabsTrigger>` entre Permisos y Documentos.
- Nuevo `<TabsContent value="notificaciones" forceMount className="mt-4 data-[state=inactive]:hidden">` con card + `<NotificacionesTab />`.

## Fuera de alcance

Refactor de los 40+ sitios que insertan en `notificaciones` para consultar `shouldNotifyRole`. Queda para iteración siguiente; este plan entrega catálogo, persistencia, UI y helper listo.

## Archivos

- Migración `notificacion_preferencias` (tabla + RLS + GRANTs)
- Nuevo `src/lib/notificaciones/catalogo.ts`
- Nuevo `src/lib/api/notificaciones-prefs.functions.ts`
- Nuevo `src/components/configuracion/NotificacionesTab.tsx`
- Editar `src/routes/_authenticated/app.configuracion.tsx`
