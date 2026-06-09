## Objetivo

En la pestaña "Presupuesto" del `DestajoDetalleSheet`, mostrar **inline y en solo vista** los conceptos (renglones WBS) del presupuesto base —y de cada orden de cambio— sin tener que abrir el editor. Imita el estilo del presupuesto base del módulo Presupuesto (tabla agrupada por clave, padres en negritas, importe por renglón, total).

## Cambios

### Nuevo componente: `src/components/destajos/RenglonesDestajoView.tsx`

Componente de solo lectura que:

- Recibe `presupuestoDestajoId: string` y opcional `tipo: "base" | "adenda"`.
- Llama a `getDestajoPresupuesto` (ya existente) vía `useServerFn` + `useQuery`.
- Procesa los renglones con `procesarRenglones` (de `@/lib/presupuesto-utils`) para que los grupos padre sumen automáticamente, igual que en `CapturaDestajoSheet`.
- Renderiza una `Card` con tabla compacta (sin inputs, sin botón eliminar):
  - Columnas: Clave, Concepto, Unidad, Cantidad, PU, Importe.
  - Filas padre con `bg-accent/40 font-medium` y `—` en unidad/cantidad/PU (mismo patrón que la captura).
  - Para OC (`tipo === "adenda"`) muestra una columna extra "Tipo" con badge `modificación / adición / eliminación` y formatea importes negativos en `text-destructive`.
- Pie de la tabla: Total alineado a la derecha.
- Estados:
  - `isLoading`: skeleton/línea "Cargando…".
  - Sin renglones: card vacía "Aún no hay renglones capturados."

### Integración en `DestajoDetalleSheet.tsx`

En `PresupuestoCard`:

- Aceptar nueva prop opcional `children?: ReactNode` y renderizarla después de los botones de acción, dentro de la misma `Card`, separada por un `border-t` con padding superior.

En el `TabsContent value="presupuesto"`:

- Debajo del `PresupuestoCard` del base (dentro de él como `children`) montar `<RenglonesDestajoView presupuestoDestajoId={base.id} tipo="base" />`.
- Igual para cada adenda: pasar `<RenglonesDestajoView presupuestoDestajoId={oc.id} tipo="adenda" />` como `children`.

Sin cambios al backend, ni a la edición. Los botones "Editar / Solicitar autorización / Autorizar / Rechazar / Reabrir / Ver detalle" siguen funcionando igual.

## Notas técnicas

- Para evitar duplicar lógica de presentación, el componente nuevo es muy ligero (≈80 líneas) y reutiliza `procesarRenglones` y `calcularClavesPadre` ya disponibles.
- No se reabre el `CapturaDestajoSheet` por defecto; el usuario sigue pudiendo entrar a editar con el botón "Editar" / "Ver detalle".
- El total se toma de `procesarRenglones(...).montoTotal` (consistente con la captura) y debe coincidir con `p.monto_total` ya mostrado en el header de la tarjeta.
