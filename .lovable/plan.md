# Badge de Nómina: aclarar su significado

## Diagnóstico (verificado)

El globo del ícono de Nómina para el administrativo **no cuenta duplicados**. Cuenta nóminas de obra con estatus `cerrada`, es decir, cerradas por el residente y **pendientes de pagar**.

Datos actuales de la semana 27-jul – 02-ago 2026:

- Canalización Larmex La Pila: nómina **cerrada** (aún no pagada) → cuenta 1
- Highly 57: nómina en **borrador** → no cuenta

Por eso el badge sigue en 1 aunque los duplicados ya estén cuadrados: se apagará cuando la semana se pague desde CxP.

## Decisión

Mantener el criterio actual y solo dejar claro qué significa el número.

## Qué se hará

- Agregar un tooltip al ícono de Nómina (sidebar y barra inferior móvil) que explique: "Nóminas cerradas pendientes de pago".
- Mostrar la misma leyenda en el panel de Nómina admin, junto al encabezado de la semana, para que se entienda que el badge no depende de los duplicados.
- Sin cambios en la lógica de conteo ni en la base de datos.

## Detalles técnicos

- Conteo actual: `src/lib/api/pendientes.functions.ts`, bloque `admin.nomina` (`obra_nominas` con `estatus = 'cerrada'`).
- Cambios sólo de UI en el componente del sidebar / barra inferior que renderiza los globos y en `src/components/nomina/NominaAdminPanel.tsx`.
