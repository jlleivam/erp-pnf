## Causa del error

El mensaje "new row violates row-level security policy for table insumos" viene de Postgres: la única política `INSERT` existente en `insumos` exige `estatus = 'pendiente'`. Cuando ahora el Director crea un insumo desde "Nuevo insumo", el backend lo inserta como `estatus = 'autorizado'` (con `autorizado_por`, `autorizado_at` y `disponible_renta`), y RLS lo rechaza porque ninguna política autoriza ese caso.

```text
Política actual (INSERT):
  company_id = current_company_id()
  AND estatus = 'pendiente'
  AND solicitado_por = auth.uid()
```

## Solución

Agregar una segunda política `INSERT` que permita al Director crear insumos en su empresa con cualquier `estatus` (incluyendo `autorizado`). La política existente se conserva para que el resto de usuarios siga creando solicitudes pendientes.

### Migración

```sql
CREATE POLICY "Director inserts insumos"
ON public.insumos
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = public.current_company_id()
  AND public.is_director_of(company_id)
);
```

No hay cambios de UI ni de server functions — el código ya envía los campos correctos; solo faltaba el permiso a nivel base de datos.