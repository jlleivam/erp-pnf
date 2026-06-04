## Reset completo de datos

Borrar todos los registros de la base de datos y los usuarios de autenticación, manteniendo intacta la estructura (tablas, RLS, funciones, buckets). Al terminar podrás entrar a `/onboarding` y crear una empresa nueva desde cero.

### Qué se borra

**Auth**
- Todos los usuarios de `auth.users` (esto dispara cascada en `profiles`, `user_roles`, etc.)

**Datos de aplicación** (todas las tablas en `public`, en orden seguro por dependencias):
- Operación: `almacen_movimientos_semana`, `almacen_recepcion_partidas`, `almacen_recepciones`, `almacen_semanas`
- Caja chica: `caja_chica_gastos`, `caja_chica_reembolsos`, `caja_chica_fondos`, `caja_chica_asignaciones`
- Cotizaciones / requisiciones / OC: `cotizacion_paquete_insumos`, `cotizacion_paquetes`, `cotizacion_solicitud_insumos`, `cotizacion_solicitudes`, y las relacionadas de requisiciones / órdenes de compra
- Destajos: `obra_destajo_estimacion_renglones`, `obra_destajo_estimaciones`, `obra_destajo_renglones`, `obra_destajo_presupuestos`, `obra_destajo_trabajadores`, `obra_destajos`
- Estimaciones / nómina: `obra_estimacion_renglones`, `obra_estimaciones`, `obra_nomina_asistencias`, `obra_nomina_renglones`, y demás de nómina/subcontratos/rentas/vales
- Catálogos por empresa: `insumos_historial_precios`, `insumos`, `insumo_categorias`, `insumo_unidades`, `clientes`, terceros, trabajadores
- Obras: `obra_comisiones`, `obra_team`, `obras`
- Notificaciones: `notificaciones`
- Empresa y perfiles: `user_roles`, `profiles`, `companies`

**Storage**
- Vaciar los buckets: `presupuestos`, `clientes-docs`, `trabajadores-docs`, `terceros-docs`, `caja-chica-evidencias`

### Qué NO se toca

- Estructura de tablas, enums, RLS, funciones, triggers
- Buckets (solo se vacía su contenido, no se eliminan)
- Secrets ni configuración de auth

### Cómo se ejecuta

1. Una sola migración SQL con `TRUNCATE ... RESTART IDENTITY CASCADE` sobre todas las tablas de `public`, más `DELETE FROM auth.users`.
2. Un script para listar y borrar los objetos de cada bucket de storage.

### Confirmación

Esto es **irreversible**. Cuando apruebes el plan procedo. ¿Confirmas que quieres borrar absolutamente todo (incluyendo tu usuario actual y la empresa)?
