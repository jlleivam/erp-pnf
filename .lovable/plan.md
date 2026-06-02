
# Almacén por obra

Cada obra tendrá su almacén alimentado por las OC enviadas al proveedor. El residente registra recepciones (con folio de remisión) y captura el material utilizado semana a semana (lunes–sábado). El sistema calcula el inventario final y lo traslada como inicial de la siguiente semana al cerrar.

## Modelo de datos

```text
almacen_recepciones            (cabecera de entrada)
  id, company_id, obra_id, oc_id, folio_remision, fecha, recibido_por, notas, created_at

almacen_recepcion_partidas     (1 fila por insumo recibido)
  id, recepcion_id, insumo_id, cantidad, precio_unitario   -- pu copiado desde la OC

almacen_semanas                (una por obra/semana ISO lun–sáb)
  id, company_id, obra_id, semana_inicio (lunes, date), semana_fin (sábado, date),
  estatus ('abierta'|'cerrada'), cerrada_at, cerrada_por

almacen_movimientos_semana     (1 fila por insumo presente en la semana)
  id, semana_id, insumo_id,
  inv_inicial (numeric, snapshot al abrir),
  recibido    (numeric, suma calculada de recepciones de la semana),
  utilizado   (numeric, captura del residente),
  inv_final   (numeric generado: inicial + recibido - utilizado),
  precio_unitario (numeric, copiado de última recepción)
  UNIQUE(semana_id, insumo_id)
```

Reglas:
- `inv_final` se calcula en cliente; al cerrar la semana se persiste como `inv_inicial` de la siguiente.
- Las recepciones siempre se asocian a la semana abierta de esa obra (se crea on-the-fly si no existe).
- `precio_unitario` mostrado = el de la recepción más reciente que toca ese insumo (última OC recibida).

## Flujo

```text
OC enviada al proveedor
   └─► Pestaña "Por recibir" del almacén de la obra
         └─► Residente abre la OC y captura:
               · folio de remisión / fecha
               · por partida: cantidad recibida (≤ pedida)
            ─► inserta recepción + partidas
            ─► actualiza/inserta filas en almacen_movimientos_semana
                (suma `recibido`, refresca `precio_unitario`)
            ─► si todas las partidas quedan completas → OC pasa a estatus 'recibida'
               si no → 'recibida_parcial' (nuevos valores del enum)

Pestaña "Semana actual"
   └─► Tabla con columnas:
        Insumo | Proveedor (último) | Unidad | PU | Inv inicial | Recibido | Utilizado | Inv final
   └─► Residente edita "Utilizado" inline (autosave)
   └─► Botón "Cerrar semana" (confirm dialog)
         ─► marca semana como cerrada
         ─► crea semana siguiente
         ─► copia inv_final → inv_inicial para cada insumo con saldo ≠ 0

Pestaña "Historial"
   └─► Lista de semanas cerradas, click → vista solo lectura de esa semana
```

## Cambios en BD (migración)

1. Nuevos valores en `oc_estatus`: `'recibida_parcial'`, `'recibida'`.
2. 4 tablas nuevas con sus GRANTs y RLS:
   - SELECT: cualquier miembro de la company de la obra.
   - INSERT/UPDATE recepciones, partidas y movimientos: residentes asignados a la obra (vía `obra_team`) + director + administrativo.
   - UPDATE de `almacen_semanas.estatus`: mismos roles.
3. Nuevo bucket privado `almacen-remisiones` (opcional, fase 2 — por ahora solo guardamos folio de texto).

## Server functions (`src/lib/api/almacen.functions.ts`)

- `listOCsPorRecibir({ obraId })` — OCs con estatus `enviada` o `recibida_parcial`.
- `getOCParaRecepcion({ ocId })` — partidas + cantidades ya recibidas.
- `registrarRecepcion({ ocId, folioRemision, fecha, partidas })` — transacción que inserta cabecera, partidas, actualiza movimientos de la semana abierta (creándola si no existe) y recalcula estatus de la OC.
- `getSemanaActual({ obraId })` — devuelve la semana abierta (la crea si no existe) con sus movimientos.
- `actualizarUtilizado({ movimientoId, utilizado })` — valida que la semana esté abierta.
- `cerrarSemana({ semanaId })` — cierra semana, crea siguiente, traslada saldos.
- `listHistorialSemanas({ obraId })` y `getSemana({ semanaId })`.

## UI

Nueva ruta `src/routes/_authenticated/app.obras.$obraId.almacen.tsx` y módulo `src/components/almacen/AlmacenModule.tsx` con 3 tabs: **Por recibir** · **Semana actual** · **Historial**.

- Diálogo `RecepcionDialog`: tabla editable de partidas (cantidad recibida por insumo + folio remisión + fecha), con validación `≤ pendiente`.
- Tabla `SemanaActualTable`: inputs numéricos solo en columna Utilizado; el resto en solo lectura. Pie con totales valorizados (`recibido·pu`, `utilizado·pu`).
- `CerrarSemanaDialog`: muestra resumen y advierte que es irreversible.
- Entrada al módulo desde `ObraShell` ("Almacén de obra") — ya existe la entrada placeholder, solo se conecta.

## Notificaciones

- Al registrar recepción completa de una OC, notificar al **administrativo** ("OC F-XXX recibida en obra Y").
- (Las notificaciones existentes residente↔admin no cambian.)

## Fuera de alcance (siguientes solicitudes)

- Subida del PDF/foto de la remisión.
- Reporte de gasto de obra (consume el campo `utilizado · pu` de las semanas cerradas).
- Ajustes de inventario (mermas, traspasos entre obras).
- Recepciones sin OC (entradas manuales).
