
# Catálogo de Proveedores y Contratistas

Reemplaza el placeholder en `/app/catalogos/proveedores` con un módulo completo de "terceros" (proveedores, contratistas o ambos), siguiendo el patrón visual y arquitectónico ya usado en Clientes y Trabajadores.

## 1. Base de datos (migración Supabase)

Enums nuevos:
- `tercero_tipo_persona`: `moral`, `fisica`
- `tercero_categoria`: `proveedor`, `contratista`, `ambos`
- `tercero_documento_tipo`: `constancia_fiscal`, `opinion_sat`, `domicilio_fiscal`, `repse`

Tabla `public.terceros`:
- id, company_id, tipo_persona, razon_social, rfc, curp, regimen_fiscal, direccion_fiscal, telefono, correo, contacto_nombre, contacto_telefono
- categoria (enum), categoria_productos text
- credito_disponible numeric, dias_credito int, requiere_factura bool
- banco, clabe, beneficiario
- retencion_iva bool, retencion_iva_pct numeric, retencion_isr bool, retencion_isr_pct numeric
- tipo_trabajos text, fondo_garantia bool, fondo_garantia_pct numeric
- created_at, creado_por
- UNIQUE (company_id, rfc)

Tabla `public.terceros_documentos`:
- id, tercero_id (FK → terceros), tipo (enum), url, fecha_vencimiento date, created_at

GRANTs a `authenticated` y `service_role` en ambas (mismo patrón que `trabajadores`).

RLS:
- `terceros`: SELECT por `company_id = current_company_id()`; ALL para Director o Administrativo.
- `terceros_documentos`: SELECT/ALL via EXISTS sobre `terceros` con misma regla.

Bucket de storage `terceros-docs` (privado) con policies estilo `trabajadores-docs`.

## 2. Server functions — `src/lib/api/terceros.functions.ts`

Validación Zod, todas con `requireSupabaseAuth`:

- `listTerceros({ search?, categoria?, tipoPersona?, estatusDocs? })` — devuelve filas + documentos para calcular estatus (`al_dia` | `por_vencer` | `vencido`) usando `estadoVencimiento` ya existente en `src/lib/format`. Filtros aplicados en SQL y/o en memoria.
- `getTercero(id)` — detalle + array de documentos.
- `crearTercero(datos)` — valida RFC único por `company_id`. Restringe a Director/Administrativo.
- `actualizarTercero(id, datos)` — Director/Administrativo.
- `eliminarTercero(id)` — Director/Administrativo. Por ahora valida sólo que no exista; las verificaciones de OC/contratos quedan como TODO documentado (no hay tablas aún).
- `subirDocumentoTercero(id, tipo, url, fecha_vencimiento?)` y `eliminarDocumentoTercero(docId)` — Director/Administrativo.

Permisos para Supervisor/PM: solo lectura (las mutaciones lanzan error 403; UI esconde botones).

## 3. Constantes compartidas — `src/components/terceros/constants.ts`

- `CATEGORIAS = [proveedor, contratista, ambos]` con labels.
- `TIPO_PERSONA` labels.
- Catálogo de regímenes fiscales reutilizado del módulo Clientes (extraído a helper compartido si hace falta).
- Tipos TS para fila lista, detalle y documento.

## 4. UI — componentes nuevos en `src/components/terceros/`

### `CatalogoTerceroModule.tsx` (vista principal)
Mismo layout que `CatalogoClientesModule`:
- Toolbar: buscador (nombre/RFC), selects de categoría, tipo persona, estatus de documentos, botón "Nuevo tercero".
- 5 cards de métricas: total, proveedores, contratistas, ambos, docs por vencer.
- Tabla con columnas: Nombre/Razón social, RFC, Tipo (badge persona), Categoría (badge), Días crédito, Documentos (badge calculado), Acciones (ver, editar, eliminar).
- Badges de categoría:
  - proveedor → `bg-blue-600`
  - contratista → `bg-teal-600`
  - ambos → `bg-slate-700`
- Badge documentos: verde `Al día`, amarillo `Por vencer`, rojo `Vencido o faltante` (faltante = no tiene constancia_fiscal u opinion_sat; para contratista además repse).
- Acciones gated por `canEdit = roles.includes("director" | "administrativo")`.

### `TerceroFormDialog.tsx`
Dialog crear/editar con campos del enum/columnas básicas (general + comercial mínimo). Selects:
- tipo_persona, categoria, regimen_fiscal (filtrado por tipo_persona como en Clientes).
- CURP visible sólo si `tipo_persona === "fisica"`.
- Contacto solo si `moral`.
- categoria_productos visible si `categoria` ∈ {proveedor, ambos}.

### `TerceroDetalle.tsx`
`Sheet` lateral con `Tabs`:
1. **General** — datos fiscales/contacto/categoría (chips Proveedor/Contratista que se traducen a enum proveedor/contratista/ambos).
2. **Comercial** — días crédito, crédito disponible, requiere factura, retención IVA/ISR (switch + %), banco/CLABE/beneficiario.
3. **Documentos** — uploader por tipo (constancia_fiscal, opinion_sat, domicilio_fiscal, y repse cuando categoría incluye contratista). Reusa patrón `DocumentoTrabajadorUploader`/`DocumentoUploader` (bucket `terceros-docs`).
4. **Contratista** — siempre visible; si la categoría no incluye contratista muestra `Alert` informativo. Campos: tipo_trabajos, fondo_garantia (+%), retencion_iva/isr específicos.
5. **Historial** — placeholder según categoría:
   - Proveedor: card "Órdenes de compra recientes" + "Historial de precios" con mensaje "Se alimenta automáticamente desde órdenes de compra".
   - Contratista: card "Contratos" con mensaje "Se alimenta automáticamente desde subcontratos".
   - Ambos: ambas secciones.

### `DocumentoTerceroUploader.tsx`
Copia adaptada de `DocumentoTrabajadorUploader` (bucket `terceros-docs`, tipos del enum `terceros_documento_tipo`, soporta fecha de vencimiento opcional). Director/Administrativo pueden subir/eliminar; resto solo descarga.

## 5. Ruta

`src/routes/_authenticated/app.catalogos.proveedores.tsx`:
- Reemplazar `ModulePlaceholder` por `<CatalogoTerceroModule />`.

## 6. Estilo

Mismo lenguaje visual que clientes/trabajadores: primario `#0f1e3d`, tablas con `Card` blanco, badges semánticos. Desktop-first; tabla con scroll horizontal en mobile (igual que clientes).

## 7. Fuera de alcance

- Tablas de órdenes de compra y subcontratos (sólo placeholders en pestaña Historial).
- Validación real de "no eliminar si tiene OC/contratos" — TODO en código.

```text
src/
  routes/_authenticated/app.catalogos.proveedores.tsx   (edit)
  lib/api/terceros.functions.ts                          (new)
  components/terceros/
    CatalogoTerceroModule.tsx                            (new)
    TerceroFormDialog.tsx                                (new)
    TerceroDetalle.tsx                                   (new)
    DocumentoTerceroUploader.tsx                         (new)
    constants.ts                                         (new)
supabase/migrations/<timestamp>_terceros.sql             (new)
```
