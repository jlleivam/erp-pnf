# Problema

En los sheets con clave WBS (presupuesto, OC presupuesto, subcontrato, OC subcontrato, destajo, OC destajo, estimación), aunque el sistema detecta los renglones padre y suma sus hijos, los inputs de Unidad, Cantidad y PU siguen visibles y editables en los renglones padre. Esto confunde y permite capturar datos que serán ignorados.

# Cambios

**1. `src/lib/presupuesto-utils.ts`** — exponer un helper puro para que la UI pueda saber, en tiempo real (sin necesidad de pasar la validación completa), qué claves son padre:

```ts
export function calcularClavesPadre(claves: string[]): Set<string> {
  const set = new Set<string>();
  for (const c of claves) {
    const p = parentDeClave(c.trim());
    if (p) set.add(p);
  }
  return set;
}
```

**2. En cada sheet de captura WBS**, calcular `clavesPadre` con `useMemo` a partir de las filas actuales y, para cada fila cuya `clave` esté en ese set:

- Renderizar los inputs de **Unidad**, **Cantidad** y **PU** como celdas de sólo lectura (texto "—" centrado en muted-foreground), no como `<Input disabled>`.
- Aplicar una clase de fila distintiva: `bg-muted/40 font-medium` para diferenciarla de los conceptos hoja.
- Mantener editables Clave y Concepto, y el botón de eliminar.
- La columna Importe sigue mostrando la suma de hijos como hoy.

Archivos a modificar (misma lógica, copy-paste del patrón):

- `src/components/presupuesto/CapturaPresupuestoSheet.tsx`
- `src/components/presupuesto/CapturaOrdenCambioSheet.tsx`
- `src/components/subcontratos/CapturaSubcontratoSheet.tsx`
- `src/components/subcontratos/CapturaOrdenCambioSubcontratoSheet.tsx`
- `src/components/destajos/CapturaDestajoSheet.tsx`
- `src/components/destajos/CapturaOrdenCambioDestajoSheet.tsx`
- `src/components/estimaciones/CapturaEstimacionSheet.tsx` (sólo si la fila padre permite capturar cantidad estimada — la cantidad de un padre también es la suma de sus hijos)
- `src/components/destajos/CapturaEstimacionDestajoSheet.tsx`
- `src/components/subcontratos/CapturaEstimacionSubcontratoSheet.tsx`

En las estimaciones (donde el usuario sólo captura cantidad ejecutada de la semana, no PU), la regla es: si la clave es padre, mostrar la cantidad como suma de hijos en sólo lectura y no permitir captura.

# Sin cambios

- Validación, cálculo de importes y persistencia en backend no cambian (ya soportan `es_grupo`).
- No se tocan tablas ni migraciones.
- Los inputs de Clave y Concepto siguen editables para poder convertir una partida en hoja simplemente borrando sus hijos.
