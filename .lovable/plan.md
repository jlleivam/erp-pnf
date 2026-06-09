## Cambios solicitados en la pestaña Nómina

**Archivo único:** `src/components/nomina/NominaModule.tsx` (solo UI, sin tocar base de datos ni server functions)

### 1. Renombrar "Borrador" → "Activa" (solo en la interfaz)
- Badge de la tabla: `"Borrador"` → `"Activa"` (línea 136)
- Etiqueta de la tarjeta resumen: `"Borrador actual"` → `"Nómina activa"` (línea 99)
- Texto de confirmación de eliminación: `"Se eliminará el borrador de la semana…"` → `"Se eliminará la nómina activa de la semana…"` (línea 192)

Nota: el valor `"borrador"` se mantiene tal cual en la base de datos y en las server functions (`nominas.functions.ts`, etc.). Es solo un cambio visual — el enum sigue siendo `"borrador" | "cerrada"` para no romper nada del backend.

### 2. Eliminar el botón "Continuar borrador"
- Quitar el bloque condicional `{borrador ? (<Button>Continuar borrador</Button>) : (<Button>Nueva semana</Button>)}` (líneas 74–86).
- Dejar siempre visible el botón **"Nueva semana"** en el header.
- La edición de la nómina activa se sigue haciendo desde la acción **"Editar"** del renglón en la tabla (ya existente), por lo que el botón es redundante.

### Lo que NO cambia
- Estatus en base de datos (sigue siendo `borrador` / `cerrada`).
- Lógica de creación, edición, cierre y eliminación.
- Permisos ni validaciones del director.
- Otros módulos que usan la palabra "borrador" (estimaciones, OC, caja chica, destajos, rentas) — no se tocan.