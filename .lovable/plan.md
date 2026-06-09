# Plan para corregir el empalme en Nómina

## Objetivo
Evitar que el botón de cerrar del módulo se monte encima de los botones de acción de Nómina, en particular `Nueva semana` y `Cerrar semana`.

## Qué voy a cambiar
1. Ajustar el layout del contenedor de módulos de obra para que el botón `Cerrar módulo` deje de estar posicionado de forma absoluta sobre el contenido.
2. Mantener ese botón visible y accesible, pero integrado al flujo normal del encabezado del módulo.
3. Verificar que el cambio no altere la lógica de permisos ni el comportamiento interno de Nómina.

## Resultado esperado
- El botón `Nueva semana` ya no quedará tapado o cruzado por la `X`.
- El botón `Cerrar semana` dentro de la captura tampoco se verá invadido por controles externos.
- La navegación de cierre del módulo seguirá funcionando igual.

## Detalle técnico
- Archivo principal a ajustar: `src/routes/_authenticated/app.obras.$obraId.$.tsx`
- Cambio previsto: reemplazar el posicionamiento `absolute top-0 right-0` del botón de cierre por una disposición en layout normal con separación propia.
- No se requieren cambios en backend, permisos, consultas ni funciones del servidor.
- No se modificarán las reglas de quién puede crear, editar o cerrar nóminas.