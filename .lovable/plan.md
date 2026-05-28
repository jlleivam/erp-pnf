# Catálogo de Trabajadores

Reemplazar el placeholder en `/app/catalogos/trabajadores` por un módulo completo, siguiendo el mismo patrón visual y arquitectónico que Clientes e Insumos (paleta `#0f1e3d`, Card + Table, Sheet lateral, server functions con `requireSupabaseAuth`).

## 1. Base de datos (migración)

**Enums nuevos**
- `trabajador_sexo`: `masculino | femenino`
- `trabajador_tipo_contrato`: `eventual_urbano | eventual_campo | permanente`
- `trabajador_imss_estatus`: `alta_activa | sin_alta | en_tramite | baja`
- `trabajador_autorizacion`: `autorizado | pendiente`
- `trabajador_doc_tipo`: `ine | curp | domicilio | contrato`

**Tabla `public.trabajadores`**
Campos solicitados (nombre_completo, telefono, correo, direccion, curp, nss, rfc, fecha_nacimiento, sexo, estado_civil, puesto, sueldo_diario, tipo_contrato, fecha_ingreso, fecha_baja, imss_estatus default `sin_alta`, imss_fecha_alta, imss_nss, imss_sbc, imss_tipo_trabajador, estatus_autorizacion default `pendiente`, creado_por, company_id, created_at).
- Índice único `(company_id, curp)` cuando `curp is not null`.

**Tabla `public.trabajadores_documentos`**
- `trabajador_id` FK, `tipo`, `url`, `fecha_vencimiento` (nullable, solo INE), `created_at`.

**GRANT + RLS** (mismo patrón que clientes):
- `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated; GRANT ALL ... TO service_role;`
- Policy SELECT: `company_id = current_company_id()` (en documentos via EXISTS sobre trabajadores).
- Policy ALL gestión: `is_director_of(company_id) OR has_role(auth.uid(), company_id, 'administrativo')`.
- Policy INSERT para PM/Auxiliar: pueden insertar si `company_id = current_company_id() AND estatus_autorizacion = 'pendiente' AND creado_por = auth.uid()`.

**Bucket de storage** `trabajadores-docs` (privado) con policies por `company_id` derivado del path `{company_id}/{trabajador_id}/...`.

## 2. Server functions (`src/lib/api/trabajadores.functions.ts`)

Todas con `requireSupabaseAuth` + helper `getMyContext` reutilizando el patrón de clientes.

- `listTrabajadores({ search?, imss_estatus?, puesto?, solo_pendientes? })` — devuelve filas con join de documentos para calcular `documentos_estado` (`al_dia | por_vencer | vencido_o_faltante`) y máscara parcial de CURP.
- `getTrabajador({ id })` — datos completos + array de documentos.
- `crearTrabajador(datos)` — valida con Zod, CURP único por empresa. Si rol = PM/auxiliar → `estatus_autorizacion = 'pendiente'`; si director/administrativo → `'autorizado'`. `creado_por = userId`.
- `actualizarTrabajador({ id, ...datos })` — solo director/administrativo.
- `autorizarTrabajador({ id })` — solo director/administrativo, set `autorizado`.
- `subirDocumentoTrabajador({ trabajador_id, tipo, path, fecha_vencimiento? })` — upsert por `(trabajador_id, tipo)`.
- `eliminarTrabajador({ id })` — solo director.

Cálculo de `documentos_estado`: requeridos = `ine, curp, domicilio, contrato`. Si falta alguno → `vencido_o_faltante`. Si INE vence en ≤30 días → `por_vencer`; vencida → `vencido_o_faltante`. Resto → `al_dia`.

## 3. UI

**Reemplazar** `src/routes/_authenticated/app.catalogos.trabajadores.tsx` para renderizar `<CatalogoTrabajadoresModule />`.

**Nuevos componentes en `src/components/trabajadores/`:**

- `CatalogoTrabajadoresModule.tsx` — vista principal
  - Header con título, descripción y botón "Nuevo trabajador" (`bg-[#0f1e3d]`). PM/Auxiliar lo abren como "Solicitar alta".
  - Banner rojo si hay trabajadores con `imss_estatus = 'sin_alta'`.
  - 4 MetricCards: Total, Alta activa, Sin alta IMSS, Pendientes de autorización.
  - Tabs: `Todos` / `Pendientes de autorización` (esta tab solo visible para director/administrativo).
  - Card de filtros: buscador (nombre/CURP/NSS), Select estatus IMSS, Select puesto (poblado desde los datos).
  - Tabla con columnas: Trabajador (avatar inicial + nombre + CURP parcial `ABCD••••••HDFXYZ02`), Puesto, IMSS (badge color por estatus), Documentos (badge verde/amarillo/rojo), Estatus (Autorizado/Pendiente), Acciones (editar, autorizar si pendiente y permisos).
  - Click en fila abre la ficha lateral.

- `TrabajadorFormDialog.tsx` — Dialog con campos personales, laborales e IMSS. Validación Zod. Para PM/Auxiliar muestra aviso "Quedará pendiente de autorización".

- `TrabajadorDetalle.tsx` — `Sheet` lateral (mismo tamaño que ClienteDetalle) con 4 tabs:
  1. **General**: datos personales + datos laborales (Field grid 2 columnas).
  2. **IMSS**: card grande con badge de semáforo, NSS, fecha alta, SBC, tipo trabajador. Botón "Editar IMSS".
  3. **Documentos**: 4 filas (INE con fecha vencimiento + alerta, CURP, Domicilio, Contrato), cada una con `DocumentoTrabajadorUploader` reutilizando patrón de `DocumentoUploader`.
  4. **Asignación**: placeholder "Disponible cuando los módulos de Nómina y Destajos estén activos".

- `DocumentoTrabajadorUploader.tsx` — análogo a `DocumentoUploader` actual, sube a bucket `trabajadores-docs` y llama `subirDocumentoTrabajador`.

**Semáforo IMSS** (helper local):
- `alta_activa` → badge verde
- `sin_alta` → badge rojo
- `en_tramite` → badge amarillo
- `baja` → badge gris

## 4. Permisos en UI

Usar `useAuthStore(s => s.roles)`:
- `director | administrativo` → todo (crear directo, editar, autorizar, eliminar, ver tab pendientes).
- `pm | auxiliar` → ver catálogo, abrir form como "Solicitar alta" (queda pendiente).
- `supervisor` → solo lectura, botones de edición ocultos.

## 5. Sin cambios al sidebar ni a rutas (`Trabajadores` ya está enlazado dentro de `/app/catalogos`).

## Detalles técnicos clave

- Migración debe seguir el orden: enums → CREATE TABLE → GRANT → ENABLE RLS → POLICIES → bucket + storage policies.
- `crearTrabajador` rechaza si `curp` ya existe en la empresa (consulta previa).
- `listTrabajadores` hace un único `select` con `trabajadores_documentos(*)` embebido y calcula estado en server para no traer lógica al cliente.
- Reusar `formatDate`, `formatMXN` de `@/lib/format` y añadir helper `mascararCurp(curp)` en el mismo archivo.
- No tocar `src/integrations/supabase/*` ni `routeTree.gen.ts`.
