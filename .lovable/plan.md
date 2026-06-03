# Dashboard de obra — 3 paneles

Reemplazar el contenido actual de `src/routes/_authenticated/app.obras.$obraId.index.tsx` por un layout responsivo de 3 paneles. Aplica a **todos los roles que entran a una obra** (residente, supervisor, director, etc.) — todos verán el mismo dashboard.

## Panel 1 — Info general

Card con:
- **Nombre de la obra** + badge de tipo (ya existe).
- **Cliente**: razón social + RFC.
- **Ubicación**: texto + dos botones pequeños:
  - 🗺️ Abrir en Google Maps (`https://www.google.com/maps/search/?api=1&query=<ubicacion>`, target `_blank`).
  - 📋 Copiar (usa `navigator.clipboard.writeText` + toast de confirmación).
- **Fecha de inicio** y **fecha de terminación** (formato `formatDate` ya existente).
- **Equipo asignado**: lista compacta de nombre + rol (ya existe en el query actual).

## Panel 2 — Estado de resultados (semana en curso)

Card que consume `getEstadoResultadosSemana({ obraId, semanaInicio })` donde `semanaInicio` se calcula como el lunes de la semana actual (helper local, formato `YYYY-MM-DD`).

Muestra:
- Rango de la semana (ej. "10 – 16 nov").
- **Producción** (monto MXN).
- **Gasto / costo total** (monto MXN).
- **Utilidad / pérdida**: `produccion - costo_total`, con color verde si positivo, rojo si negativo, y badge con `margen %`.
- Botón **"Ver detalle completo →"** que navega a `/app/obras/$obraId/estado-resultados` (ruta existente del módulo).

Estado loading con skeleton; si no hay datos, muestra ceros y el link al módulo.

## Panel 3 — Tareas pendientes

Card con título "Mis tareas pendientes" + botón "+ Nueva tarea".

Lista las tareas donde `obra_id = $obraId AND asignado_a = auth.uid() AND estatus != 'completada'`, ordenadas por `fecha_limite` (nulls last) y luego `created_at`. Cada item muestra: checkbox para marcar completa, título, fecha límite con color de urgencia (vencida=rojo, ≤3 días=ámbar, resto=neutro).

Empty state: "No tienes tareas pendientes en esta obra."

### Backend: nueva tabla `obra_tareas` + módulo CRUD básico

**Migración** (`supabase--migration`):

```sql
CREATE TABLE public.obra_tareas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  obra_id uuid NOT NULL,
  titulo text NOT NULL,
  descripcion text,
  asignado_a uuid NOT NULL,        -- profiles.id / auth.users.id
  creado_por uuid NOT NULL,
  fecha_limite date,
  estatus text NOT NULL DEFAULT 'pendiente'
    CHECK (estatus IN ('pendiente','en_progreso','completada','cancelada')),
  completada_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.obra_tareas (obra_id, asignado_a, estatus);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_tareas TO authenticated;
GRANT ALL ON public.obra_tareas TO service_role;

ALTER TABLE public.obra_tareas ENABLE ROW LEVEL SECURITY;

-- Ver: miembros de la obra + director + admin de la company
CREATE POLICY "Ver tareas de obra" ON public.obra_tareas FOR SELECT TO authenticated
USING (company_id = current_company_id()
  AND (is_director_of(company_id) OR is_member_of_obra(obra_id)));

-- Crear: director o miembro de obra (asigna a sí mismo u otros miembros)
CREATE POLICY "Crear tareas" ON public.obra_tareas FOR INSERT TO authenticated
WITH CHECK (company_id = current_company_id()
  AND (is_director_of(company_id) OR is_member_of_obra(obra_id))
  AND creado_por = auth.uid());

-- Actualizar: asignado, creador, director, miembro de obra
CREATE POLICY "Actualizar tareas" ON public.obra_tareas FOR UPDATE TO authenticated
USING (company_id = current_company_id()
  AND (is_director_of(company_id) OR is_member_of_obra(obra_id) OR asignado_a = auth.uid()))
WITH CHECK (company_id = current_company_id());

-- Borrar: solo director o creador
CREATE POLICY "Borrar tareas" ON public.obra_tareas FOR DELETE TO authenticated
USING (is_director_of(company_id) OR creado_por = auth.uid());

CREATE TRIGGER update_obra_tareas_updated_at
  BEFORE UPDATE ON public.obra_tareas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

**Server functions** (`src/lib/api/tareas.functions.ts`):
- `listMisTareasObra({ obraId })` → tareas del usuario actual no completadas en esa obra (con join a profile del creador).
- `listTareasObra({ obraId })` → todas las tareas de la obra (para el módulo completo).
- `crearTarea({ obraId, titulo, descripcion?, asignado_a, fecha_limite? })`.
- `actualizarTareaEstatus({ id, estatus })` — setea `completada_at = now()` cuando pasa a `completada`.
- `eliminarTarea({ id })`.

**Módulo de tareas** (`/app/obras/$obraId/tareas`):
- Ya está enrutado por el catch-all `app.obras.$obraId.$.tsx` + el bottom bar (ítem "Tareas").
- Crear `src/components/tareas/TareasModule.tsx`: tabla con título, asignado, fecha límite, estatus; filtros por estatus y por asignado; botón "Nueva tarea" abre un `Dialog` con form (titulo, descripcion, asignado_a desde `listCompanyUsers`, fecha_limite).
- Acciones por fila: marcar completa, cancelar, eliminar (según permisos).
- Registrar el componente donde se mapean los módulos de obra (mismo patrón que `AlmacenModule`, `CajaChicaModule`, etc.).

## Archivos a tocar

- **Editar**: `src/routes/_authenticated/app.obras.$obraId.index.tsx` (rediseño completo).
- **Crear**: `src/lib/api/tareas.functions.ts`.
- **Crear**: `src/components/tareas/TareasModule.tsx` + `NuevaTareaDialog.tsx`.
- **Editar**: el archivo donde el catch-all (`app.obras.$obraId.$.tsx`) renderiza los módulos por slug, para añadir `tareas → <TareasModule />`.
- **Migración**: tabla `obra_tareas` + políticas.

## Notas técnicas

- La semana en curso usa lunes como inicio (consistente con el resto del sistema basado en `semana_inicio` tipo `date`).
- En el panel 2 se muestra el `monto` ya calculado por `getEstadoResultadosSemana` — no recalculamos en cliente.
- El query `getObraDashboard` ya devuelve `obra + team`; no necesita cambios.
- Cargas en paralelo con tres `useQuery` independientes para que cada panel tenga su propio loading/error.
