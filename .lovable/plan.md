## Objetivo
Corregir la UI de nómina para que el perfil administrativo no vea acciones de creación/edición cuando no tiene facultad sobre la nómina de obra.

## Qué voy a cambiar
1. **Exponer el permiso real de nómina por obra**
   - Agregar una lectura ligera en `src/lib/api/nominas.functions.ts` que reutilice la lógica actual de acceso (`director` o `residente` de esa obra).
   - No cambiaré las reglas del backend de escritura; solo las reutilizaré para la UI.

2. **Ocultar el botón `Nueva semana` para usuarios sin permiso**
   - En `src/components/nomina/NominaModule.tsx`, dejar de mostrar el botón cuando `canEdit` sea falso.
   - Así la vista ya no invitará al administrativo a iniciar una nómina que de todos modos no puede crear.

3. **Alinear la pantalla con el mismo permiso**
   - Usar ese mismo `canEdit` para que las acciones visibles no contradigan el backend.
   - En la lista, los usuarios sin permiso verán la nómina en modo consulta en lugar de una acción que sugiera edición.

4. **Validación**
   - Verificar que:
     - **Administrativo**: no vea `Nueva semana` ni acciones de edición.
     - **Residente de la obra**: sí vea `Nueva semana`.
     - **Director**: sí vea `Nueva semana`.

## Resultado esperado
La UI quedará consistente con la regla acordada: **solo residente de la obra y director pueden crear o modificar nóminas**; el administrativo solo podrá consultarlas.

## Detalles técnicos
- Archivos previstos:
  - `src/lib/api/nominas.functions.ts`
  - `src/components/nomina/NominaModule.tsx`
- No se tocarán tablas, permisos de base de datos ni otras áreas del módulo.