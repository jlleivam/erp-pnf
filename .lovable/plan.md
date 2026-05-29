## Problema

En el paso 3 de Nueva Obra, al hacer clic en "Crear obra", el server fn falla con `Invalid uuid` en `team[2].user_id` porque hay filas de equipo (y/o comisiones) cuyo select de usuario quedó vacío (`user_id === ""`) y se están enviando al backend.

## Cambios en `src/routes/_authenticated/app.obras.nueva.tsx`

### 1. Estado de error inline

Agregar `const [teamError, setTeamError] = useState<string | null>(null)` para mostrar el mensaje debajo de la sección "Equipo asignado".

### 2. Derivar validez del equipo

Calcular en cada render:

```ts
const teamValido = team.length > 0 && team.every((t) => !!t.user_id);
const comisionesValidas = comisiones.every((c) => !!c.user_id);
const puedeCrear = teamValido && comisionesValidas;
```

### 3. Deshabilitar "Crear obra"

Cambiar el botón a:

```tsx
<Button onClick={handleSubmit} disabled={createObraM.isPending || !puedeCrear}>
```

### 4. Mensaje inline

Bajo la lista de team:

```tsx
{teamError && <p className="text-xs text-destructive mt-2">{teamError}</p>}
```

### 5. Sanitizar en `handleSubmit`

Antes del `mutate`:

```ts
const teamLimpio = team.filter((t) => !!t.user_id);
const comisionesLimpias = comisiones.filter((c) => !!c.user_id);

if (teamLimpio.length !== team.length || comisionesLimpias.length !== comisiones.length) {
  setTeamError("Selecciona un usuario para cada miembro del equipo");
  return;
}
setTeamError(null);

const rs = new Set(teamLimpio.map((t) => t.role));
// ...validación de roles mínimos sobre teamLimpio...

createObraM.mutate({ data: { ..., team: teamLimpio, comisiones: comisionesLimpias } });
```

Esto cubre además el caso del Auxiliar opcional: si el director agrega la fila pero no selecciona usuario, la UI bloquea el envío y el mensaje le indica seleccionar o eliminar la fila (botón papelera ya existente).

## Fuera de alcance

No se toca la server fn `crearObra` ni el schema Zod del backend — la validación uuid sigue siendo la red de seguridad correcta. Solo se corrige el frontend para no enviar filas inválidas.
