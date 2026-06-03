## Objetivo

Módulo de **Gasolinas**: el residente solicita un vale (monto, tipo de combustible, descripción y obra opcional), el supervisor lo autoriza/rechaza/ajusta, el administrativo lo liga a un código físico de vale, y el residente confirma la recepción del vale.

---

## Flujo y estatus

```text
pendiente_autorizacion → autorizado → entregado → confirmado
       │                     │
       └──► rechazado        └──► (residente puede cancelar mientras esté pendiente)
```

- **pendiente_autorizacion**: lo creó el residente.
- **autorizado**: el supervisor lo aprobó (con monto autorizado, que puede ser distinto al solicitado).
- **rechazado**: el supervisor lo rechazó con motivo.
- **cancelado**: el residente lo canceló en `pendiente_autorizacion`.
- **entregado**: el administrativo ligó el código físico del vale.
- **confirmado**: el residente confirmó la recepción del vale físico.

---

## Base de datos (migración)

### Enums
- `vale_gasolina_tipo`: `magna`, `premium`, `diesel`.
- `vale_gasolina_estatus`: `pendiente_autorizacion`, `autorizado`, `rechazado`, `cancelado`, `entregado`, `confirmado`.

### Tabla `public.vales_gasolina`
Campos de dominio:
- `folio` (text, autogenerado tipo `VG-YYYY-####`, único por empresa).
- `company_id`, `obra_id` (nullable — permite vales generales).
- `tipo_combustible` (vale_gasolina_tipo).
- `monto_solicitado` (numeric, >0).
- `descripcion` (text, en qué se usará).
- `estatus`.
- `solicitado_por`, `solicitado_at`.
- `autorizado_por`, `autorizado_at`, `monto_autorizado` (puede diferir del solicitado).
- `rechazado_por`, `rechazado_at`, `motivo_rechazo`.
- `cancelado_por`, `cancelado_at`.
- `codigo_vale` (text, el código físico) + `ligado_por`, `ligado_at`.
- `confirmado_por`, `confirmado_at`.
- Estándar: `id`, `created_at`, `updated_at` con trigger.

### Función + secuencia de folio
- Función `public.siguiente_folio_vale_gasolina(_company_id uuid)` siguiendo el mismo patrón que `siguiente_folio_oc` (prefijo `VG-YYYY-###`).

### RLS
- **SELECT**: cualquier usuario de la misma empresa puede ver los vales (`company_id = current_company_id()`), igual que rentas/requisiciones.
- **INSERT**: director, administrativo o miembro de la obra (cuando hay `obra_id`); director/administrativo siempre para vales generales.
- **UPDATE**: director siempre; supervisor para transición autorizar/rechazar/editar monto; administrativo para ligar código; residente para cancelar (mientras esté pendiente) y para confirmar recepción.
- La autorización fina de cada transición vive en los server functions (las RLS son el backstop). Esto evita políticas con lógica de estatus difíciles de mantener.
- **GRANT**: `authenticated` SELECT/INSERT/UPDATE; `service_role` ALL. Sin DELETE (auditoría).

### Índices
- `(company_id, estatus)` y `(obra_id, estatus)` para listados.

---

## Backend — `src/lib/api/vales-gasolina.functions.ts`

Server functions (todos con `requireSupabaseAuth`):

- `crearValeGasolina({ obraId?, tipoCombustible, monto, descripcion })`
  - Valida que el usuario tenga acceso a la obra (si hay obra) o que sea director/administrativo (si es general).
  - Genera folio, inserta con estatus `pendiente_autorizacion`.
  - Notifica a los supervisores de la empresa.

- `autorizarValeGasolina({ valeId, montoAutorizado })`
  - Solo director o supervisor. Estatus debe ser `pendiente_autorizacion`.
  - Marca `autorizado`, guarda `monto_autorizado` (default = solicitado), notifica al administrativo.

- `rechazarValeGasolina({ valeId, motivo })`
  - Solo director o supervisor. Estatus debe ser `pendiente_autorizacion`.
  - Marca `rechazado`, notifica al residente solicitante.

- `cancelarValeGasolina({ valeId })`
  - Solo el solicitante o el director, y solo si está `pendiente_autorizacion`.

- `ligarCodigoVale({ valeId, codigoVale })`
  - Solo director o administrativo. Estatus debe ser `autorizado`.
  - Guarda el `codigo_vale`, marca `entregado`, notifica al residente solicitante para que confirme.

- `confirmarRecepcionVale({ valeId })`
  - Solo el solicitante o el director. Estatus debe ser `entregado`.
  - Marca `confirmado`.

- `listValesGasolina({ obraId?, estatus? })`
  - Lista con join a obra/solicitante/autorizó/ligó.
  - Si se pasa `obraId`: solo de esa obra. Sin `obraId`: todos los de la empresa accesibles (admin/director).

- `getValeGasolina({ valeId })` — detalle completo + timeline.

---

## UI

### Componentes nuevos en `src/components/gasolinas/`
- `GasolinasModule.tsx` — vista por obra (tabs por estatus: Pendientes / Autorizados / Entregados / Histórico).
- `GasolinasAdminPanel.tsx` — vista global del administrativo (mismas tabs pero a nivel empresa, con foco en "Por ligar código").
- `NuevoValeDialog.tsx` — formulario del residente (tipo, monto, descripción, obra opcional cuando se abre desde admin).
- `AutorizarValeDialog.tsx` — para supervisor: muestra detalle, permite editar `montoAutorizado`, autorizar o rechazar (con motivo).
- `LigarCodigoDialog.tsx` — para administrativo: input del código físico.
- `ValeDetalleSheet.tsx` — detalle + timeline + acciones disponibles según rol y estatus (cancelar, confirmar recepción, etc.).

### Estilo
- Sigue el mismo patrón visual y de tablas que `RentasModule`/`requisiciones` (badges por estatus, sheets de detalle, botones de acción según rol).
- Tipo de combustible se muestra con badge de color (Magna verde, Premium roja, Diésel ámbar) usando tokens semánticos del design system.

### Rutas
- Por obra: el slug `gasolinas` ya está mapeado en `LABELS`; agregar el render `if (slug === "gasolinas") return <GasolinasModule obraId={obraId} />;` en `app.obras.$obraId.$.tsx`.
- Admin: en `app.admin.$.tsx` agregar `if (slug === "gasolinas") return <GasolinasAdminPanel />;`.

### Notificaciones
Se reutiliza la tabla `notificaciones` existente. Tipos nuevos:
- `vale_gasolina_solicitud` → a supervisores.
- `vale_gasolina_autorizado` → al administrativo.
- `vale_gasolina_rechazado` → al residente solicitante.
- `vale_gasolina_entregado` → al residente solicitante (debe confirmar).

---

## Permisos por rol (resumen)

| Acción | Residente (de la obra) | Supervisor | Administrativo | Director |
| --- | --- | --- | --- | --- |
| Crear vale (obra) | ✅ | ✅ | ✅ | ✅ |
| Crear vale general | ❌ | ❌ | ✅ | ✅ |
| Autorizar / rechazar / editar monto | ❌ | ✅ | ❌ | ✅ |
| Cancelar (pendiente) | ✅ (solo el suyo) | ❌ | ❌ | ✅ |
| Ligar código físico | ❌ | ❌ | ✅ | ✅ |
| Confirmar recepción | ✅ (solo el suyo) | ❌ | ❌ | ✅ |
| Ver | ✅ (su empresa) | ✅ | ✅ | ✅ |

---

## Fuera de alcance

- Subir foto/ticket del consumo posterior.
- Catálogo configurable de tipos de combustible (queda fijo).
- Pagos/conciliación bancaria — los vales son comprobante de entrega, no de pago.
- Reportes consolidados de consumo por obra/mes (puede venir después).
