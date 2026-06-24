## Causa

La barra inferior móvil del admin en `src/components/AppShell.tsx` (líneas 281-294) tiene una lista **fija** de accesos rápidos — no usa `ADMIN_MODULES`. Por eso el nuevo módulo "Condensado semanal" aparece en el sidebar/menú "Más" pero no en la barra inferior.

## Cambio propuesto

Agregar una entrada para Condensado semanal en el arreglo de `items` del `MobileBottomBar` para admin, usando el icono `CalendarRange` (ya importable desde `lucide-react`).

```tsx
{ to: "/app/admin/condensado-semanal", label: "Condensado", icon: CalendarRange },
```

Posición sugerida: justo después de "Obras" (entre `Obras` y `Catálogos`) para que quede visible sin tener que desplazar tanto el scroll horizontal. Si prefieres otra posición (primero, último, etc.), dilo y lo ajusto.

No se tocan permisos ni la lógica de roles: el bloque ya está dentro de `showAdmin` (director o administrativo), que coincide con quien tiene acceso al módulo.

### Archivos

- `src/components/AppShell.tsx` — añadir el item + import de `CalendarRange` si no está ya.
