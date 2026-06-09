## Objetivo

En el módulo de Estimaciones:
- Quitar el botón **Continuar borrador** del header (y la tarjeta de KPI "Borrador actual" queda como informativa).
- Mantener todas las acciones por fila en la tabla.
- Solo permitir **Editar** el borrador cuya semana coincide con la semana en curso. Borradores de semanas pasadas quedan en solo lectura (Ver + Eliminar para director).

## Cambios

### `src/components/estimaciones/EstimacionesModule.tsx`

1. **Header**: quitar el bloque `borrador ? Continuar borrador : Nueva estimación`. Dejar siempre el botón **Nueva estimación**. (`NuevaEstimacionDialog` ya detecta si la semana actual ya tiene estimación y reusa el borrador existente, así que el flujo sigue funcionando.)

2. **Calcular la semana vigente** una sola vez con `const semanaActual = calcularSemana(new Date()).inicio;`.

3. **Acciones por fila** en la tabla:
   - **Ver** siempre.
   - **Editar**: solo si `e.estatus === "borrador" && e.semana_inicio === semanaActual`.
   - **Eliminar** (director): solo si `e.estatus === "borrador"` (cualquier semana — sigue como hoy).
   - Para borradores de semanas pasadas, junto al badge "Borrador" mostrar tooltip / texto pequeño "Semana cerrada — no editable" o simplemente omitir el botón Editar.

4. **KPI "Borrador actual"**: se mantiene tal cual (sigue mostrando el borrador si existe). No es accionable.

5. **Sin cambios** en server functions ni en `CapturaEstimacionSheet` ni en validaciones del backend (el bloqueo es solo de UI; si el usuario tuviera una URL directa, el backend sigue aceptando ediciones — el usuario solicitó solo cambiar la UI).

## Detalles técnicos

```tsx
const semanaActual = calcularSemana(new Date()).inicio;
const esEditable = (e: Estimacion) =>
  e.estatus === "borrador" && e.semana_inicio === semanaActual;

// en la celda Acciones:
<Button size="sm" variant="outline" onClick={() => setViewing(e.id)}>
  <FileText className="size-4 mr-1" /> Ver
</Button>
{esEditable(e) && (
  <Button size="sm" onClick={() => setEditing(e.semana_inicio)}>Editar</Button>
)}
{e.estatus === "borrador" && director && (
  <Button size="sm" variant="ghost" onClick={() => setToDelete(e)}>
    <Trash2 className="size-4" />
  </Button>
)}
```

Sin cambios de schema, datos o backend.
