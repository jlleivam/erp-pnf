## Marcar campos obligatorios en formulario de trabajador

En `src/components/trabajadores/TrabajadorFormDialog.tsx`, agregar un asterisco rojo (`*`) junto a las etiquetas de los campos requeridos según el modo del formulario.

### Campos a marcar

**Siempre obligatorio:**
- Nombre completo

**Obligatorios solo cuando es solicitud de alta** (`!canManage && !isEdit`):
- Sexo
- Puesto

### Implementación

- Crear un pequeño helper/componente `RequiredMark` que renderice `<span className="text-destructive ml-0.5">*</span>`.
- Añadirlo condicionalmente en los `<Label>` correspondientes.
- Agregar una nota discreta arriba del formulario (solo en modo solicitud) tipo: *"Los campos marcados con \* son obligatorios."*

No se modifica lógica de validación (ya implementada previamente) ni backend.