
# Eliminar paso "Presupuesto" del wizard Nueva obra

El presupuesto ya no se captura durante la creación de la obra. Se cargará después desde el módulo Presupuesto de la obra.

## Cambios

**`src/routes/_authenticated/app.obras.nueva.tsx`**
- Quitar el paso 2 (subida de archivo, extracción por IA, preview de partidas).
- Renumerar: el actual paso 3 (Equipo/comisiones) pasa a ser paso 2. Indicador cambia de "Paso X de 3" a "Paso X de 2".
- Eliminar estado y lógica asociada: `presupuestoUrl`, `uploading`, `parsingPdf`, `partidasExtraidas`, `usarPartidas`, `handleUpload`, imports de `parsearPdfPresupuesto`, `crearPresupuesto`, `guardarRenglones`, `supabase.storage`, `Switch`, `Loader2`/`Check` si quedan sin uso.
- En `crearObra` ya no se envía `presupuesto_url` ni se dispara la creación de presupuesto/renglones tras `onSuccess`; solo navegar a la obra creada.
- Botones de navegación: en paso 1 "Continuar" va directo a paso 2 (equipo); en paso 2 "Atrás" regresa a paso 1.

**Backend**
- No se toca `crearObra` ni `parsearPdfPresupuesto` (queda disponible por si luego se usa desde el módulo Presupuesto). El campo `presupuesto_url` en `obras` se conserva; simplemente no se llena en la creación.

## Fuera de alcance
- Módulo Presupuesto de la obra (ya existe y permite capturar/subir presupuesto).
- Migraciones de BD.
