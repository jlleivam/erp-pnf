## Objetivo
Mover el botón "Guardar cambios" del interior de `FacturacionTab` y `ConfiguracionTab` al componente padre `app.configuracion.tsx`, de modo que siempre esté visible sin importar qué pestaña esté activa. Al hacer clic, guardará los datos de la pestaña actualmente visible.

## Cambios necesarios

### 1. `FacturacionTab.tsx` — Exponer método de guardado
- Eliminar el botón "Guardar cambios" del final del formulario.
- Convertir el componente a `forwardRef`.
- Usar `useImperativeHandle` para exponer un método `submit()` que llame `formRef.current?.requestSubmit()`.
- Crear un `useRef<HTMLFormElement>(null)` para referenciar el `<form>`.
- El formulario sigue manejando `onSubmit` con la mutación existente; solo se quita el botón interno.

### 2. `ConfiguracionTab.tsx` — Exponer método de guardado
- Eliminar el botón "Guardar" de la sección General.
- Convertir el componente a `forwardRef`.
- Usar `useImperativeHandle` para exponer un método `save()` que invoque `save.mutate({ data: { moneda, zona_horaria: zona } })`.

### 3. `IdentidadTab.tsx`
- No requiere cambios: el logo se guarda automáticamente al subir el archivo.

### 4. `app.configuracion.tsx` — Agregar botón global de guardado
- Importar `useRef` y `useState`.
- Mantener un objeto `tabsRef = useRef<Record<string, any>>({})` para guardar las referencias de cada pestaña.
- Leer el valor activo del Tabs mediante `value` controlado (`activeTab`, `setActiveTab`).
- Agregar un botón "Guardar cambios" fijo (por ejemplo, en la parte superior derecha del header o debajo del `TabsList`).
- Al hacer clic, llamar `tabsRef.current[activeTab]?.save()` o `.submit()` según la pestaña activa.
- Agregar feedback con `toast` (ya disponible en el padre o en los hijos).

## Notas técnicas
- `FacturacionTab` usa un `<form>` nativo; `requestSubmit()` dispara el `onSubmit` sin necesidad de un botón `type="submit"` dentro del formulario.
- `ConfiguracionTab` guarda con un `onClick` manual; su ref expone directamente el trigger.
- Si la pestaña activa no expone un método de guardado (como Identidad o Documentación), el botón puede deshabilitarse o mostrar un mensaje informativo.
- Se mantiene el `navigate({ to: "/app" })` al guardar exitosamente.