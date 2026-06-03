## Objetivo

Módulo de **Caja Chica** por obra: el director define un monto base por residente, el residente solicita el fondo inicial al administrativo, captura gastos semanales con evidencia, y solicita reembolsos (semanales o parciales) que el supervisor revisa gasto por gasto y el administrativo repone en efectivo.

---

## Flujo

```text
Director asigna monto base por residente
        │
        ▼
Residente solicita fondo inicial ──► Administrativo entrega efectivo (confirma)
        │
        ▼
Residente captura gastos (borrador) durante la semana
        │
        ▼
Residente solicita reembolso (parcial o semanal completo)
        │
        ▼
Supervisor revisa: aprueba / rechaza por gasto individual
        │
        ▼
Administrativo repone efectivo (monto = suma de gastos aprobados)
        │
        ▼
Reembolso cerrado
```

---

## Base de datos (migración)

### Enums
- `caja_chica_gasto_tipo_comprobante`: `factura`, `nota`, `ninguno`.
- `caja_chica_gasto_estatus`: `borrador`, `solicitado`, `aprobado`, `rechazado`, `reembolsado`.
- `caja_chica_reembolso_estatus`: `solicitado`, `en_revision`, `aprobado_parcial`, `enviado_admin`, `repuesto`, `rechazado`.
- `caja_chica_fondo_estatus`: `pendiente`, `entregado`, `cancelado`.

### Tablas

**`public.caja_chica_asignaciones`** — monto base por residente/obra.
- `obra_id`, `residente_id` (FK profiles), `monto_base` (numeric), `activo` (bool), `asignado_por`, `notas`.
- Unique `(obra_id, residente_id)` cuando `activo = true`.

**`public.caja_chica_fondos`** — solicitudes de fondo inicial (también re-entregas si se incrementa el monto base).
- `obra_id`, `residente_id`, `monto_solicitado`, `monto_entregado`, `estatus` (`fondo_estatus`), `solicitado_por/at`, `entregado_por/at`, `notas`.

**`public.caja_chica_reembolsos`** — un reembolso por solicitud (puede haber varios parciales por semana).
- `folio` (`CC-YYYY-####` por empresa), `obra_id`, `residente_id`, `company_id`.
- `semana_inicio`, `semana_fin` (rango cubierto).
- `estatus` (`reembolso_estatus`).
- `monto_solicitado`, `monto_aprobado`, `monto_reembolsado`.
- `solicitado_por/at`, `revisado_por/at`, `enviado_admin_at`, `repuesto_por/at`, `rechazado_por/at`, `motivo_rechazo`.

**`public.caja_chica_gastos`** — gastos individuales.
- `obra_id`, `residente_id`, `company_id`, `reembolso_id` (nullable mientras es borrador).
- `fecha`, `concepto`, `descripcion`, `monto`, `tipo_comprobante`, `evidencia_url`.
- `estatus` (`gasto_estatus`), `revisado_por/at`, `motivo_rechazo`.
- Estándar: `id`, `created_at`, `updated_at` con trigger.

### Función + folio
- `public.siguiente_folio_caja_chica(_company_id uuid)` con prefijo `CC-YYYY-####`, patrón idéntico a `siguiente_folio_oc`.

### Storage
- Nuevo bucket privado `caja-chica-evidencias` con políticas: solo usuarios de la empresa pueden leer/escribir bajo `{company_id}/{obra_id}/...`.

### RLS
- **SELECT**: todos los usuarios de la empresa (`company_id = current_company_id()`), igual que rentas/gasolinas.
- **INSERT/UPDATE asignaciones**: solo director.
- **INSERT/UPDATE fondos**: residente asignado o director crea; administrativo o director marca entregado.
- **INSERT/UPDATE gastos**: residente solicitante (mientras `borrador`); supervisor/director cambia estatus a `aprobado`/`rechazado`.
- **INSERT/UPDATE reembolsos**: residente crea; supervisor revisa; administrativo marca `repuesto`.
- Lógica fina de transiciones en server functions (RLS como backstop).
- **GRANT**: `authenticated` SELECT/INSERT/UPDATE; `service_role` ALL. Sin DELETE.

### Índices
- `(obra_id, estatus)` en reembolsos y gastos; `(reembolso_id)` en gastos.

### Cambio mínimo en `obras`
- Ningún campo nuevo en `obras` directamente — el monto base vive en `caja_chica_asignaciones` y se captura en el wizard de Nueva Obra como un paso opcional (por cada residente del equipo).

---

## Backend — `src/lib/api/caja-chica.functions.ts`

Server functions (todos con `requireSupabaseAuth`):

- **Asignaciones**
  - `setMontoBaseCajaChica({ obraId, residenteId, monto })` — director.
  - `listAsignacionesCajaChica({ obraId })`.

- **Fondo inicial**
  - `solicitarFondoCajaChica({ obraId, monto, notas? })` — residente. Notifica administrativo.
  - `entregarFondoCajaChica({ fondoId, montoEntregado })` — admin/director. Notifica residente.

- **Gastos**
  - `crearGastoCajaChica({ obraId, fecha, concepto, descripcion, monto, tipoComprobante, evidenciaUrl? })` — residente. Crea como `borrador`.
  - `actualizarGastoCajaChica({ gastoId, ... })` — solo borradores.
  - `eliminarGastoCajaChica({ gastoId })` — solo borradores.
  - `listGastosCajaChica({ obraId, residenteId?, estatus?, reembolsoId? })`.

- **Reembolsos**
  - `solicitarReembolsoCajaChica({ obraId, semanaInicio, semanaFin, gastoIds })` — residente. Marca gastos `solicitado`, los liga al reembolso, calcula `monto_solicitado`. Notifica supervisor.
  - `revisarGastoReembolso({ gastoId, decision: "aprobado"|"rechazado", motivo? })` — supervisor/director. Recalcula `monto_aprobado` del reembolso.
  - `cerrarRevisionReembolso({ reembolsoId })` — supervisor envía al administrativo. Estatus `enviado_admin`. Notifica admin.
  - `reponerReembolsoCajaChica({ reembolsoId, montoReembolsado })` — admin/director. Marca `repuesto`, gastos aprobados pasan a `reembolsado`. Notifica residente.
  - `rechazarReembolsoCajaChica({ reembolsoId, motivo })` — supervisor/director (cuando aún no se envió al admin).
  - `listReembolsosCajaChica({ obraId?, estatus? })`.
  - `getReembolsoCajaChica({ reembolsoId })` — detalle + gastos + timeline.

- **Saldo** (helper)
  - `getSaldoCajaChica({ obraId, residenteId })` — `monto_base + entregado - sum(gastos sin reembolsar) - sum(gastos rechazados pendientes)`.

---

## UI

### Componentes nuevos en `src/components/caja-chica/`
- `CajaChicaModule.tsx` — vista por obra. Header con saldo del residente actual, tabs:
  - **Mis gastos** (borrador del residente, botón "Nuevo gasto", botón "Solicitar reembolso" sobre selección).
  - **Reembolsos** (lista con estatus, badges, click → sheet).
  - **Asignaciones** (solo director: tabla residente → monto base, editar).
  - **Fondos** (solicitudes de fondo inicial, estatus, acción "Confirmar entrega" para admin).
- `CajaChicaAdminPanel.tsx` — vista global del administrativo (todos los reembolsos `enviado_admin`, todos los fondos `pendiente`, foco en "Por reponer").
- `NuevoGastoDialog.tsx` — form: fecha, concepto, descripción, monto, select tipo comprobante (Factura/Nota/Ninguno), uploader de evidencia (foto, sube a `caja-chica-evidencias`).
- `EditarGastoDialog.tsx` — mismo form, solo borradores.
- `SolicitarReembolsoDialog.tsx` — confirma rango de semana, lista de gastos seleccionados con total.
- `SolicitarFondoDialog.tsx` — monto + notas.
- `EntregarFondoDialog.tsx` — admin: monto entregado.
- `RevisarReembolsoSheet.tsx` — supervisor: lista de gastos con preview de evidencia, botones aprobar/rechazar por renglón, motivo en rechazo, botón final "Enviar a administrativo".
- `ReponerReembolsoDialog.tsx` — admin: monto + confirmar.
- `AsignarMontoBaseDialog.tsx` — director: residente + monto.
- `ReembolsoDetalleSheet.tsx` — detalle + timeline.

### Estilo
- Mismos patrones que `RentasModule`/`GasolinasModule` (badges semánticos por estatus, sheets de detalle, tabla con acciones por rol).
- Badges de comprobante: Factura (verde), Nota (ámbar), Ninguno (muted).
- Saldo destacado arriba (card con `monto_base`, `disponible`, `gastos pendientes`).

### Rutas
- Por obra: `app.obras.$obraId.$.tsx` — `if (slug === "caja-chica") return <CajaChicaModule obraId={obraId} />;`
- Admin: `app.admin.$.tsx` — `if (slug === "caja-chica") return <CajaChicaAdminPanel />;`

### Wizard de Nueva Obra
- Agregar paso opcional "Caja chica" en `app.obras.nueva.tsx`: por cada residente del equipo, input de monto base. Al guardar, crea las `caja_chica_asignaciones`.

### Configuración de obra
- En el dashboard de obra (`app.obras.$obraId.index.tsx` o un settings sheet) — director puede ver/editar asignaciones desde la tab "Asignaciones" del módulo (no se duplica UI).

### Notificaciones (tabla `notificaciones` existente)
Tipos nuevos:
- `caja_chica_fondo_solicitado` → administrativo.
- `caja_chica_fondo_entregado` → residente.
- `caja_chica_reembolso_solicitado` → supervisor.
- `caja_chica_reembolso_enviado_admin` → administrativo.
- `caja_chica_reembolso_repuesto` → residente.
- `caja_chica_reembolso_rechazado` → residente.

---

## Permisos por rol

| Acción | Residente | Supervisor | Administrativo | Director |
| --- | --- | --- | --- | --- |
| Definir/editar monto base | ❌ | ❌ | ❌ | ✅ |
| Solicitar fondo inicial | ✅ (su asignación) | ❌ | ❌ | ✅ |
| Confirmar entrega fondo | ❌ | ❌ | ✅ | ✅ |
| Capturar/editar gasto borrador | ✅ (sus gastos) | ❌ | ❌ | ✅ |
| Solicitar reembolso | ✅ (sus gastos) | ❌ | ❌ | ✅ |
| Aprobar/rechazar gastos | ❌ | ✅ | ❌ | ✅ |
| Enviar reembolso al admin | ❌ | ✅ | ❌ | ✅ |
| Reponer efectivo | ❌ | ❌ | ✅ | ✅ |
| Ver | ✅ | ✅ | ✅ | ✅ |

---

## Fuera de alcance

- OCR de tickets / extracción automática de monto desde la foto.
- Conciliación bancaria de las reposiciones.
- Múltiples cajas chicas simultáneas por residente en la misma obra.
- Reportes consolidados de gastos por categoría/mes (futuro).
- Cierre/devolución de caja chica al terminar la obra (futuro).
