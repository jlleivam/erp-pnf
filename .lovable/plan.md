Cambiar el `TabsList` de Configuración de empresa para forzar una sola fila con scroll horizontal en pantallas angostas.

En `src/routes/_authenticated/app.configuracion.tsx`:
- Envolver el `TabsList` en un contenedor `overflow-x-auto` (con `-mx-*` opcional para bleed).
- Reemplazar `className="flex-wrap h-auto"` por `className="inline-flex w-max flex-nowrap"` para que las pestañas queden en una única fila y hagan scroll horizontal cuando no caben, en vez de saltar a dos filas.

Sin cambios de contenido ni de estilos individuales de cada pestaña.