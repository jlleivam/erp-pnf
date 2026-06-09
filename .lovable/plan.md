## Objetivo

Simplificar el estado de las estimaciones para que sea **derivado de la semana**, no manual:

- **Activa** → la estimación de la semana en curso (se puede editar).
- **Cerrada** → cualquier estimación de una semana anterior (solo lectura).

Eliminar de la UI el concepto de "Borrador" y el botón manual de "Cerrar semana": el cierre ocurre automáticamente cuando la semana termina.

El esquema de la base de datos (`estatus borrador|cerrada`, `cerrada_at`) se mantiene tal cual — solo se cambia la presentación. La columna `estatus` deja de mostrarse al usuario, y los registros con `estatus = "borrador"` que correspondan a semanas pasadas se renderizarán como "Cerrada".

## Cambios

### 1. `src/components/estimaciones/EstimacionesModule.tsx`

- Calcular `const semanaActual = calcularSemana(new Date()).inicio;` (ya existe).
- Helper: `const esActiva = (e) => e.semana_inicio === semanaActual;`
- **Badge en la tabla**: `esActiva(e) ? "Activa" : "Cerrada"` (con variantes consistentes — `secondary` para activa, `default` para cerrada, igual que hoy).
- **Editar**: solo si `esActiva(e)` (ya no exige `estatus === "borrador"`).
- **Eliminar (director)**: solo si `esActiva(e)`.
- **KPIs**:
  - "Producción acumulada": suma de `monto_total` de las estimaciones **cerradas (semanas pasadas)** — `!esActiva(e)`.
  - "Semanas cerradas": `estimaciones.filter((e) => !esActiva(e)).length`.
  - "Borrador actual" → renombrar a **"Semana activa"** y mostrar la estimación cuya `semana_inicio === semanaActual` (si existe). Sin cambios visuales más allá del título.

### 2. `src/components/estimaciones/VerEstimacionSheet.tsx`

- Calcular estado derivado a partir de `est.semana_inicio` vs semana actual.
- Badge: "Activa" / "Cerrada".
- Quitar la línea "Cerrada el {cerrada_at}" del SheetDescription (ya no aplica con el nuevo modelo: el cierre es automático).

### 3. `src/components/estimaciones/CapturaEstimacionSheet.tsx`

- Quitar el botón "Guardar y cerrar semana", el `AlertDialog` de confirmación y el `useServerFn(cerrarEstimacion)` / `cerrarM` asociados.
- Quitar el import de `cerrarEstimacion`.
- Mantener únicamente el botón "Guardar" (sigue usando el mismo `guardarEstimacion` que ya graba como borrador).
- Renombrar `isCerrada` → `soloLectura` y derivarlo de la semana: `soloLectura = semanaInicio !== semanaActual`. Los inputs siguen deshabilitados cuando es solo lectura.
- Header del sheet: el badge muestra "Activa" / "Cerrada" según la semana, ya no según `estatus`.

### 4. Backend

- **Sin cambios.** `cerrarEstimacion` deja de invocarse desde la UI; se conserva el server fn en el archivo por si se necesita en migraciones, pero la app ya no lo usa. (Si más adelante el usuario pide quitarlo del todo, se elimina en otra iteración.)

## Detalles técnicos

```tsx
// EstimacionesModule.tsx
const semanaActual = calcularSemana(new Date()).inicio;
const esActiva = (e: Estimacion) => e.semana_inicio === semanaActual;

const cerradas = estimaciones.filter((e) => !esActiva(e));
const totalProduccion = cerradas.reduce((s, e) => s + Number(e.monto_total), 0);
const activa = estimaciones.find(esActiva);

// Badge
<Badge variant={esActiva(e) ? "secondary" : "default"}>
  {esActiva(e) ? "Activa" : "Cerrada"}
</Badge>

// Acciones
{esActiva(e) && <Button onClick={() => setEditing(e.semana_inicio)}>Editar</Button>}
{esActiva(e) && director && <Button variant="ghost" onClick={() => setToDelete(e)}><Trash2 .../></Button>}
```

```tsx
// CapturaEstimacionSheet.tsx
const soloLectura = semanaInicio !== calcularSemana(new Date()).inicio;
// reemplaza todos los usos de isCerrada
```

No hay cambios de schema, datos ni de RLS.
