# Editar configuración de obra (Director)

Agregar un acceso "Configuración" dentro de la navegación de la obra (visible solo para el Director) que abra una pantalla para editar la obra ya creada.

## 1. Nueva ruta
- Archivo: `src/routes/_authenticated/app.obras.$obraId.configuracion.tsx`
- Componente: `ConfiguracionObra` que reusa el formulario de `app.obras.nueva.tsx` adaptado a modo edición, con 4 secciones en pestañas (Tabs):
  1. **Datos generales** — nombre, unidad de negocio, cliente, número de contrato, ubicación, fechas, monto contratado.
  2. **Presupuesto** — reemplazar archivo (sube a bucket `presupuestos`, actualiza `presupuesto_url`).
  3. **Equipo** — agregar/quitar miembros (`obra_team`), respetando la regla de mínimo 1 Residente + 1 Administrativo + 1 Supervisor.
  4. **Comisiones** — editar filas de `obra_comisiones` (usuario, %, base de cálculo).
- Acceso restringido: si `useEffectiveIsDirector()` es falso → `redirect` a `/app/obras/$obraId`.

## 2. Server functions nuevas en `src/lib/api/obras.functions.ts`
- `getObraConfiguracion({ obraId })` — devuelve obra completa + team + comisiones para precargar el formulario.
- `actualizarObra({ obraId, ...campos })` — UPDATE de campos generales y `presupuesto_url`. Valida con Zod (mismo shape que `crearObraSchema` pero todos opcionales salvo `obraId`).
- `actualizarObraTeam({ obraId, team })` — reemplaza `obra_team` (delete + insert en transacción lógica) y valida los 3 roles mínimos.
- `actualizarObraComisiones({ obraId, comisiones })` — reemplaza filas de `obra_comisiones`.

Todas con `requireSupabaseAuth` + chequeo de que el usuario es Director de la `company_id` de la obra (`is_director_of`).

## 3. Navegación
- En `src/components/AppShell.tsx`, dentro de `obraNavItems` (solo cuando el usuario efectivo es Director), agregar:
  ```ts
  { to: `/app/obras/${obraId}/configuracion`, label: "Configuración", icon: Settings }
  ```
  Esto lo muestra tanto en la barra inferior móvil (scroll) como en cualquier futura barra lateral de obra.

## 4. UX al guardar
- Cada pestaña tiene su propio botón "Guardar cambios" (igual patrón que tabs de configuración global).
- Tras éxito: `toast.success` + `queryClient.invalidateQueries(["obra-dashboard", obraId])` para refrescar header del dashboard. Permanecer en la pestaña (no redirigir).

## Notas técnicas
- Reusar componentes existentes de `app.obras.nueva.tsx` extrayéndolos a `src/components/obras/ObraForm*.tsx` (DatosGenerales, EquipoEditor, ComisionesEditor, PresupuestoUploader) para evitar duplicación.
- No se tocan tablas ni RLS: las políticas existentes de `obras`, `obra_team`, `obra_comisiones` ya permiten al director de la company.
