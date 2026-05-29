## Problema

`PGRST200`: PostgREST no encuentra relación FK entre `cotizacion_solicitudes` y `terceros`, por lo que los joins anidados (`proveedor:terceros(...)`, `items:cotizacion_solicitud_insumos(..., insumo:insumos(...))`) fallan y el server fn devuelve `SC query: Could not find a relationship...`.

Las tablas `cotizacion_solicitudes` y `cotizacion_solicitud_insumos` se crearon sin `FOREIGN KEY`, así que el schema cache de Supabase no expone embeds.

## Solución

Migración que agrega las claves foráneas faltantes:

```sql
ALTER TABLE public.cotizacion_solicitudes
  ADD CONSTRAINT cotizacion_solicitudes_requisicion_id_fkey
    FOREIGN KEY (requisicion_id) REFERENCES public.requisiciones(id) ON DELETE CASCADE,
  ADD CONSTRAINT cotizacion_solicitudes_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE,
  ADD CONSTRAINT cotizacion_solicitudes_proveedor_id_fkey
    FOREIGN KEY (proveedor_id) REFERENCES public.terceros(id) ON DELETE RESTRICT,
  ADD CONSTRAINT cotizacion_solicitudes_creado_por_fkey
    FOREIGN KEY (creado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.cotizacion_solicitud_insumos
  ADD CONSTRAINT cotizacion_solicitud_insumos_solicitud_id_fkey
    FOREIGN KEY (solicitud_id) REFERENCES public.cotizacion_solicitudes(id) ON DELETE CASCADE,
  ADD CONSTRAINT cotizacion_solicitud_insumos_insumo_id_fkey
    FOREIGN KEY (insumo_id) REFERENCES public.insumos(id) ON DELETE RESTRICT;

NOTIFY pgrst, 'reload schema';
```

Sin cambios de código adicionales — una vez que las FK existen, los embeds `proveedor:terceros(...)` e `items:cotizacion_solicitud_insumos(..., insumo:insumos(...))` resuelven y `getDatosPDF` / `getSolicitudesRequisicion` funcionan.

## QA

1. Crear nueva SC → Guardar y descargar PDF → debe descargar sin error.
2. Abrir tab Solicitudes → debe listar proveedor e insumos.
