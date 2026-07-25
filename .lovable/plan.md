## Objetivo

Mantener siempre visible la columna **Solicitante** en la tabla de requisiciones administrativas (`/app/admin/requisiciones`), sin reintroducir scroll horizontal.

## Cambios en `src/routes/_authenticated/app.admin.requisiciones.tsx`

1. **Quitar el `hidden md:table-cell`** de la columna Solicitante (header y celda) para que se muestre en todos los tamaños.

2. **Recuperar espacio** compactando otras columnas:
   - Ocultar la columna **Insumos** por completo (o dejarla solo en `xl:`), ya que es información secundaria.
   - Reducir el ancho de **Folio** a `w-[64px]` y de **Solicitante** a `w-[110px]` con truncate + tooltip (ya se mostrará el nombre completo al hacer hover).
   - Mantener Obra como columna flexible (sin ancho fijo) para que absorba el espacio restante.

3. **Conservar tooltips** en Folio, Obra y Solicitante para no perder información al truncar.

## Resultado esperado

Solicitante visible en todo momento; la tabla sigue cabiendo en viewport de ~750px sin scroll horizontal.
