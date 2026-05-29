## Diagnóstico

El preview muestra:
```
Failed to fetch dynamically imported module: /@id/virtual:tanstack-start-client-entry
```

En los logs del dev server veo:
```
✨ new dependencies optimized: @tanstack/router-core/ssr/client, seroval, h3-v2, ...
✨ optimized dependencies changed. reloading
```

Vite detectó dependencias nuevas (introducidas por `date-fns` y los nuevos imports del módulo de Requisiciones), las re-optimizó, y disparó un reload. El navegador quedó con referencias a módulos viejos que ya no existen → error de import dinámico. No es un bug en el código; es un estado transitorio del dev server.

## Acción

Reiniciar el dev server de Vite para limpiar el estado y forzar una recarga limpia. No requiere cambios en código.

Si después del reinicio el error persiste, investigaré más a fondo (revisaría imports nuevos en `RequisicionesModule`, `NuevaRequisicionSheet`, `RequisicionDetalleSheet`).