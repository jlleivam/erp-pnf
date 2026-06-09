# Compactar el módulo Nómina

## Cambios

1. **Quitar la `X`** de cerrar módulo en `src/routes/_authenticated/app.obras.$obraId.$.tsx`. El header superior con el nombre de la obra (y la flecha de regreso) ya permite salir.
2. **Subir el header de Nómina**: al desaparecer la fila de la `X`, el título "Nómina" queda pegado arriba sin espacio muerto.
3. **Compactar el módulo** (`src/components/nomina/NominaModule.tsx`):
   - Reducir el `space-y` del contenedor.
   - Achicar tipografías del header y descripción.
   - Reducir padding de las tarjetas resumen.
   - La tabla de nóminas queda como protagonista visual.
4. **Agregar columna "Trabajadores"** con la cantidad de trabajadores asignados a la nómina de esa semana:
   - Backend: `listNominas` devolverá adicionalmente `trabajadores_count` por nómina (consulta a `obra_nomina_renglones` agrupando por `nomina_id`).
   - Frontend: nueva columna en la tabla, alineada a la derecha, con valor tabular.
5. Se mantiene **un solo renglón por nómina** (ya es así).

## Detalle técnico

- `src/lib/api/nominas.functions.ts > listNominas`: tras obtener las nóminas, hacer un segundo query a `obra_nomina_renglones` con `in("nomina_id", ids)` y contar en JS por `nomina_id`. Adjuntar `trabajadores_count` a cada fila.
- `NominaModule.tsx`:
  - Tipo `Nomina` agrega `trabajadores_count: number`.
  - Nueva `<th>` "Trabajadores" entre "Estatus" y "Monto".
  - Header: pasar de `text-2xl` a `text-xl`, eliminar margen extra; `space-y-6` → `space-y-4`; cards resumen con `p-3` en lugar de `p-4`.
- `app.obras.$obraId.$.tsx`: eliminar el bloque del `<Link>` con la `X` y el wrapper `flex justify-end`. Dejar solo `{content}`.

No hay cambios de permisos ni de RLS.