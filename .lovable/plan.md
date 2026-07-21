## Problema

En el catálogo de Insumos, la pestaña "Pendientes" solo se renderiza para el Director. Un residente que solicita un insumo no puede ver su solicitud ni las de otros usuarios, lo que puede llevar a solicitudes duplicadas.

## Cambios

### UI — `src/components/insumos/CatalogoInsumosModule.tsx`
- Mostrar la pestaña "Pendientes" a todos los roles (quitar el `{director && ...}` del `<TabsTrigger>` y del `<TabsContent value="pendiente">`).
- En la tabla de pendientes, mantener visible la columna "Solicitado por" para todos (así se ve quién ya pidió qué).
- Los botones **Autorizar / Rechazar** siguen mostrándose solo al director. Para no-directores, mostrar un badge "Pendiente" en la columna de acciones.
- Ajustar `colSpan` del estado vacío según el rol.

### Backend
Sin cambios: `listInsumos` con `estatus: "pendiente"` ya devuelve todas las solicitudes pendientes de la empresa, y las RLS existentes permiten a cualquier miembro de la empresa leerlas.

## Resultado

Cualquier residente/supervisor verá dos pestañas: "Autorizados" y "Pendientes" (todas las solicitudes en curso de la empresa, con quién las solicitó), evitando pedir insumos duplicados. Solo el director conserva las acciones de autorizar/rechazar.
