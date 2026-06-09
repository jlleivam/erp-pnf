# Mostrar trabajadores pendientes (bloqueados) en el diálogo de asignación semanal

## Comportamiento

En el diálogo "Asignar trabajadores a la semana":
- Los trabajadores con `estatus_autorizacion = 'pendiente'` aparecen en la lista junto a los autorizados.
- Su fila se renderiza deshabilitada: checkbox `disabled`, opacidad reducida, cursor `not-allowed`.
- Se muestra una badge "Pendiente de autorización" a la derecha del nombre para que el residente entienda por qué no puede seleccionarlo.
- Los pendientes nunca entran en `seleccionados`, ni siquiera al hacer "seleccionar todos"/buscar.
- El contador "X seleccionado(s)" sigue contando solo los autorizados marcados.

## Cambios

**`src/lib/api/nominas.functions.ts`** — `listTrabajadoresDisponibles`:
- Quitar el filtro `.eq("estatus_autorizacion", "autorizado")` para que la consulta también devuelva los `pendiente`.
- Incluir `estatus_autorizacion` en el `select` para que el cliente pueda distinguirlos.
- Mantener el filtro de `baja` (los dados de baja siguen excluidos).

**`src/components/nomina/CapturaNominaSheet.tsx`** (el componente que renderiza el diálogo de la imagen):
- En la lista de trabajadores, si `t.estatus_autorizacion === "pendiente"`:
  - `<Checkbox disabled checked={false} />`
  - Fila con `opacity-60 cursor-not-allowed`, sin handler de click.
  - Badge `<Badge variant="secondary">Pendiente de autorización</Badge>` junto al nombre/categoría.
- Asegurar que el toggle handler ignora a los pendientes (early return si `estatus_autorizacion !== "autorizado"`).

**Sin cambios:** schema, RLS, server fns de nómina más allá del filtro mencionado, flujo de creación/aprobación de trabajadores, otros componentes.

¿Procedo?
