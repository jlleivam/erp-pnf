## Objetivo

La pestaña "Presupuesto" dentro de la configuración de la obra hoy solo permite subir/reemplazar un archivo `.xlsx`. Debe tener las mismas funciones del módulo de Presupuesto del dashboard de la obra: crear el presupuesto base, capturar renglones (manual o por Excel), autorizar, crear órdenes de cambio, ver vigente, etc.

## Cambio

En `src/routes/_authenticated/app.obras.$obraId.configuracion.tsx`:

1. Reemplazar el cuerpo del `<TabsContent value="presupuesto">` por:
   ```tsx
   <PresupuestoModule obraId={obraId} />
   ```
2. Importar `PresupuestoModule` desde `@/components/presupuesto/PresupuestoModule`.
3. Eliminar la función `PresupuestoTab` y su mutation/upload — ya no se usa.
4. Eliminar el import de `Check` si queda huérfano (lo usaba solo `PresupuestoTab`).

No se requieren cambios en server functions ni en la base de datos: el `PresupuestoModule` ya invoca `listPresupuestos`, `crearPresupuesto`, `autorizarPresupuesto`, etc., y al autorizar dispara el recálculo de `monto_contratado` que ya existe.

## Archivo a modificar

- `src/routes/_authenticated/app.obras.$obraId.configuracion.tsx`

## Resultado

Desde **Configuración de la obra → Presupuesto** el director puede crear el presupuesto base, capturar/importar renglones, autorizarlo y gestionar órdenes de cambio, con la misma UX del módulo Presupuesto del dashboard.
