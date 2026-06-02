## Presupuesto autorizado por obra (WBS hasta 5 niveles)

Cada obra tendrá un **presupuesto base** + **adendas aditivas**. La estructura se interpreta a partir de la clave WBS (ej. `1`, `1.1`, `1.1.3`) — el nivel se infiere por la cantidad de puntos. Captura manual o importación desde plantilla Excel con previsualización.

### 1. Modelo de datos (Cloud)

**`obra_presupuestos`** — encabezado por obra/adenda
- `obra_id`, `company_id`
- `tipo`: `base` | `adenda`
- `numero`: 0 para base, 1..N para adendas
- `nombre`, `descripcion`
- `estatus`: `borrador` | `autorizado`
- `autorizado_por`, `autorizado_at`
- `monto_total` (calculado, almacenado)
- `created_by`, timestamps
- Constraint: un solo `base` autorizado por obra.

**`obra_presupuesto_renglones`** — los conceptos del WBS
- `presupuesto_id` → `obra_presupuestos`
- `clave`: text (ej. `1.2.3`) — único por presupuesto
- `nivel`: int (1-5) — calculado desde la clave al guardar
- `parent_clave`: text nullable (ej. `1.2` para `1.2.3`) — para construir el árbol
- `concepto`: text
- `unidad`: text nullable (solo en hojas)
- `cantidad`: numeric nullable
- `precio_unitario`: numeric nullable
- `importe`: numeric — para grupos = suma de hijos; para hojas = cantidad * PU
- `es_grupo`: boolean — true si tiene hijos
- `orden`: int — para preservar secuencia

RLS: lectura por miembros de la `company`, escritura/autorización solo Director (consistente con `obras`).

### 2. Reglas de cálculo

- Niveles 1-4 normalmente son agrupadores (`es_grupo=true`, sin unidad/cantidad/PU): su importe = suma de hijos directos.
- Nivel hoja (cualquier nivel 1-5 sin hijos): importe = `cantidad * precio_unitario`.
- Al guardar/importar se recalcula en cascada: hojas → padres por longitud descendente de clave.
- Validación: claves bien formadas (`^\d+(\.\d+)*$`), máximo 5 segmentos, sin duplicados, todo padre referenciado existe.

### 3. UI — Módulo "Presupuesto" dentro de la obra

Nueva entrada en el sidebar de obra: **Presupuesto**, ruta `/_authenticated/app/obras/$obraId/presupuesto`.

**Vista principal:**
- Header: monto base + suma de adendas autorizadas = **total vigente**, fecha autorización base.
- Tabs: **Base** | **Adendas** | **Vista consolidada**.
- Cada tab muestra una tabla jerárquica colapsable (árbol) con columnas: Clave · Concepto · Unidad · Cantidad · PU · Importe.
  - Indentación por nivel, filas de grupo en negritas, totales por grupo.
  - Toggle expandir/colapsar por nivel.
- Botones (solo Director): "Capturar manualmente", "Importar desde Excel", "Agregar adenda".
- Estado `borrador` muestra banner "Pendiente de autorizar" + botón **Autorizar**. Una vez autorizado, queda de solo lectura (las correcciones se hacen con adenda).

**Captura manual:**
- Sheet/dialog grande con una tabla editable.
- Filas con columnas: Clave · Concepto · Unidad · Cantidad · PU · Importe (calculado).
- Botones: agregar fila, eliminar fila, duplicar.
- Importe y nivel se calculan en vivo conforme se escribe la clave.
- Validación inline (clave duplicada, padre faltante, formato inválido).
- Guardar como borrador en cualquier momento; "Autorizar" requiere validación completa.

**Importación desde Excel:**
- Paso 1: descargar plantilla `.xlsx` con encabezados fijos: `Clave | Concepto | Unidad | Cantidad | PU` (importe se calcula).
- Paso 2: subir archivo, parsear en servidor con `xlsx`/`exceljs`.
- Paso 3: previsualización en el mismo sheet de captura, ya editable, con errores marcados en rojo.
- Paso 4: usuario corrige si hace falta y guarda como borrador.

**Adendas:**
- Igual flujo (manual o Excel) pero los renglones se suman al consolidado.
- Pueden tener importes negativos para reducciones/cancelaciones.
- Cada adenda se autoriza individualmente.

### 4. Server functions (`src/lib/api/presupuestos.functions.ts`)

- `listPresupuestos({ obraId })` — base + adendas con totales.
- `getPresupuesto({ id })` — con todos los renglones ordenados.
- `crearPresupuesto({ obraId, tipo, nombre })` — crea encabezado borrador.
- `guardarRenglones({ presupuestoId, renglones[] })` — reemplaza todos los renglones; valida claves, calcula niveles e importes en cascada, actualiza `monto_total`.
- `autorizarPresupuesto({ id })` — valida estructura completa, marca autorizado (solo Director).
- `eliminarPresupuesto({ id })` — solo si está en borrador.
- `parsearExcelPresupuesto({ fileBase64 })` — server fn que recibe el .xlsx, devuelve renglones parseados + lista de errores (sin persistir).
- `descargarPlantillaPresupuesto()` — genera el .xlsx con encabezados y una fila de ejemplo.

### 5. Componentes nuevos

- `src/components/presupuesto/PresupuestoModule.tsx` — vista principal con tabs.
- `src/components/presupuesto/ArbolPresupuestoTable.tsx` — tabla jerárquica de solo lectura.
- `src/components/presupuesto/CapturaPresupuestoSheet.tsx` — captura/edición de renglones.
- `src/components/presupuesto/ImportarExcelDialog.tsx` — wizard descarga + sube + previsualiza.
- `src/components/presupuesto/AdendaDialog.tsx` — alta de nueva adenda.

### 6. Integraciones futuras (no en esta iteración, pero el modelo las soporta)

- Vincular renglones del presupuesto con insumos al gastar (almacén/OC) para comparativo presupuestado vs ejercido.
- Avance de obra por partida.

### Archivos a crear/editar

- **Migración**: `obra_presupuestos` + `obra_presupuesto_renglones` con RLS y GRANTs.
- **Crear**: 5 componentes en `src/components/presupuesto/`.
- **Crear**: `src/lib/api/presupuestos.functions.ts` + `presupuestos.server.ts` (parseo Excel).
- **Crear**: ruta `src/routes/_authenticated/app.obras.$obraId.presupuesto.tsx`.
- **Editar**: `ObraShell.tsx` (sidebar) y `src/lib/modules.ts` para agregar la entrada.
- **Dependencia**: agregar `exceljs` (compatible con Worker runtime).
