## Objetivo

Reemplazar el campo único "Dirección fiscal" del cliente por los mismos campos estructurados que usa Configuración de empresa: Calle, Núm. exterior, Núm. interior, Colonia, Municipio / Alcaldía, Estado (dropdown de 32 estados) y Código postal.

## Cambios

### 1. Base de datos (migración)
En `public.clientes` agregar columnas de texto (nullable):
- `calle`, `numero_exterior`, `numero_interior`, `colonia`, `municipio`, `estado`, `codigo_postal`

El campo actual `direccion_fiscal` se conserva en la tabla por compatibilidad histórica pero deja de escribirse/leerse desde la UI. No hay datos productivos que migrar (el usuario ya limpió la BD).

### 2. Backend — `src/lib/api/clientes.functions.ts`
- Agregar los 7 campos al `clienteFieldsSchema` (todos `string.trim().nullable().optional()`; `codigo_postal` con `max(5)`).
- Incluirlos en `SELECT_FULL`.
- Persistirlos en `crearCliente` y `actualizarCliente`.
- Quitar `direccion_fiscal` del schema y de los payloads insert/update.

### 3. UI — `src/components/clientes/ClienteFormDialog.tsx`
Reemplazar el textarea "Dirección fiscal" por el mismo bloque de "Dirección fiscal" que usa `FacturacionTab` (mismos labels, mismo grid `sm:grid-cols-4` + `sm:grid-cols-3`, mismo `Select` de estados usando la lista `ESTADOS_MX`). Se extrae la lista de estados a un módulo compartido pequeño (`src/lib/mx-estados.ts`) e importado tanto por `FacturacionTab` como por el formulario de cliente para evitar duplicar.

### 4. UI — `src/components/clientes/ClienteDetalle.tsx`
Sustituir el renglón `<Field label="Dirección fiscal" value={cliente.direccion_fiscal} />` por una dirección compuesta legible (una sola línea con Calle Núm. ext Int, Colonia, Municipio, Estado, C.P.), usando los nuevos campos.

## Fuera de alcance
- Proveedores/Subcontratistas/Trabajadores (catálogo de terceros): no se tocan en este cambio, aunque también podrían migrarse después si se pide.
- No se borra la columna `direccion_fiscal` de la BD en esta iteración.
