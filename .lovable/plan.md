# Badge de Nómina: por qué sigue encendido

## Diagnóstico (verificado)

El globo del ícono de Nómina para el administrativo **no cuenta duplicados**. Cuenta nóminas de obra con estatus `cerrada` (es decir, cerradas por el residente y **pendientes de pagar**).

Datos actuales de la semana 27-jul – 02-ago 2026:

- Canalización Larmex La Pila: nómina **cerrada** (aún no pagada) → cuenta 1
- Highly 57: nómina en **borrador** → no cuenta

Por eso el badge muestra 1 aunque ya hayas cuadrado los duplicados: seguirá encendido hasta que la semana se pague desde CxP.

## Opciones

1. **Dejarlo como está** y solo aclarar el significado: el badge = "nóminas cerradas por pagar". Agregar tooltip/leyenda en el ícono.
2. **Cambiar el criterio** para que el badge cuente únicamente lo que requiere acción de cuadre (trabajadores con días duplicados en la semana) y no las cerradas pendientes de pago.
3. **Separar señales**: badge de Nómina = duplicados por cuadrar; badge de CxP = nóminas cerradas por pagar (que ya es donde se ejecuta el pago).

Recomendación: opción 3, porque el pago vive en CxP y el panel de Nómina admin es el de cuadre.

## Detalles técnicos

- Origen del conteo: `src/lib/api/pendientes.functions.ts`, bloque `admin.nomina` (`obra_nominas` con `estatus = 'cerrada'`).
- Para la opción 2/3 habría que calcular duplicados a nivel semana (trabajador con asistencia en más de una obra el mismo día) en ese mismo server fn, y mover/duplicar el conteo de cerradas al módulo `cuentas-por-pagar`.
