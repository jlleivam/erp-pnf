
## Objetivo

Dejar el proyecto como recién instalado: sin obras, sin catálogos, sin movimientos, sin contabilidad, sin empresa, sin usuarios y sin archivos. El siguiente `signup` deberá disparar el onboarding desde cero.

## Advertencia

Esta acción es **irreversible**. Antes de aprobar el plan, considera exportar cualquier dato que quieras conservar desde Cloud → Advanced settings → Export data.

## Alcance

**Se conserva:**
- El esquema completo (tablas, funciones, triggers, políticas RLS, enums).
- Los buckets de storage (vacíos).
- La configuración de auth y de Cloud.

**Se borra todo el contenido de:**

1. **Tablas de negocio (public):** obras y todo lo que cuelga de ellas (presupuestos, estimaciones, órdenes de cambio, requisiciones, cotizaciones, órdenes de compra, almacén, destajos, subcontratos, nóminas, rentas, tareas, caja chica, vales de gasolina, gastos de oficina, cuentas por pagar, pagos, cuentas y movimientos, asientos contables, notificaciones), catálogos (clientes, terceros y sus docs, trabajadores y sus docs, insumos, categorías, unidades, unidades de negocio), roles, membresías de obra, profiles y companies.

2. **Auth:** todos los usuarios de `auth.users` (esto cascadea a `profiles`, `user_roles`, `obra_team`, etc. gracias a los FKs existentes).

3. **Storage:** todos los objetos de los buckets `presupuestos`, `clientes-docs`, `trabajadores-docs`, `terceros-docs`, `caja-chica-evidencias`, `company-logos`. Los buckets se conservan.

## Ejecución

Un solo migration con `TRUNCATE ... RESTART IDENTITY CASCADE` sobre todas las tablas de negocio del esquema `public`, seguido de `DELETE FROM storage.objects` y `DELETE FROM auth.users`.

### Detalle técnico

```sql
-- 1) Vaciar contenido de storage (metadata; los blobs quedarán huérfanos
--    en el backend pero inaccesibles y serán limpiados por el GC de Storage).
DELETE FROM storage.objects
 WHERE bucket_id IN (
   'presupuestos','clientes-docs','trabajadores-docs',
   'terceros-docs','caja-chica-evidencias','company-logos'
 );

-- 2) Vaciar todas las tablas de public en un solo TRUNCATE con CASCADE.
--    Se listan explícitamente para no depender del orden de FKs.
TRUNCATE TABLE
  public.asientos_contables,
  public.pagos,
  public.cuenta_movimientos,
  public.cuentas,
  public.cuentas_por_pagar,
  public.notificaciones,
  public.gastos_oficina,
  public.vales_gasolina,
  public.caja_chica_gastos,
  public.caja_chica_reembolsos,
  public.caja_chica_asignaciones,
  public.caja_chica_fondos,
  public.obra_renta_eventos,
  public.obra_renta_pagos,
  public.obra_renta_renovaciones,
  public.obra_rentas,
  public.obra_tareas,
  public.obra_nomina_asistencias,
  public.obra_nomina_renglones,
  public.obra_nominas,
  public.obra_subcontrato_estimacion_renglones,
  public.obra_subcontrato_estimaciones,
  public.obra_subcontrato_anticipos,
  public.obra_subcontrato_renglones,
  public.obra_subcontrato_presupuestos,
  public.obra_subcontratos,
  public.obra_destajo_estimacion_renglones,
  public.obra_destajo_estimaciones,
  public.obra_destajo_anticipos,
  public.obra_destajo_trabajadores,
  public.obra_destajo_renglones,
  public.obra_destajo_presupuestos,
  public.obra_destajos,
  public.obra_estimacion_renglones,
  public.obra_estimaciones,
  public.obra_presupuesto_renglones,
  public.obra_presupuestos,
  public.obra_comisiones,
  public.obra_team,
  public.ordenes_compra,
  public.almacen_movimientos_semana,
  public.almacen_recepcion_partidas,
  public.almacen_recepciones,
  public.almacen_semana_desbloqueo_solicitudes,
  public.almacen_semanas,
  public.cotizacion_paquete_insumos,
  public.cotizacion_paquetes,
  public.cotizacion_solicitud_insumos,
  public.cotizacion_solicitudes,
  public.requisicion_insumos,
  public.requisiciones,
  public.obras,
  public.trabajadores_documentos,
  public.trabajadores,
  public.terceros_documentos,
  public.terceros,
  public.clientes,
  public.insumos_historial_precios,
  public.insumos,
  public.insumo_categorias,
  public.insumo_unidades,
  public.unidades_negocio,
  public.user_roles,
  public.profiles,
  public.companies
RESTART IDENTITY CASCADE;

-- 3) Borrar todos los usuarios de auth.
--    Esto además dispara los ON DELETE CASCADE de profiles y demás.
DELETE FROM auth.users;
```

### Notas

- `TRUNCATE ... CASCADE` respeta la integridad y reinicia los contadores de folio de facto porque las secuencias que alimentan los folios (`REQ-YYYY-###`, `CxP-…`, etc.) se recalculan por año desde las tablas vacías.
- Los blobs físicos en Storage pueden quedar unos días como huérfanos antes de que el garbage collector de Supabase los elimine, pero ya no son accesibles.
- Al terminar, el primer usuario que haga signup entrará al flujo de `onboarding` normal y creará una nueva `company` y su rol de director.

## Fuera de alcance

- No se toca el esquema, funciones, triggers, políticas RLS ni buckets.
- No se modifican secretos ni configuración de auth (proveedores, plantillas de correo).
