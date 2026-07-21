## Diagnóstico

El régimen fiscal **sí se está guardando** en la base de datos. Confirmé consultando `companies` directamente: el valor `"601 — General de Ley Personas Morales"` está persistido correctamente.

El problema real es de **visualización**: al abrir Configuración → Facturación, el dropdown "Régimen fiscal" muestra el placeholder "Selecciona régimen" aunque el valor exista en el estado. Al inspeccionar el DOM en vivo, el `<select>` oculto de Radix sí tiene el valor correcto, pero el trigger visible aparece vacío.

**Causa raíz**: Radix Select solo renderiza los `<SelectItem>` cuando el popover está abierto (o cuando se abre por primera vez). El componente `SelectValue` necesita que el ítem correspondiente esté montado para leer su texto visible; si no lo encuentra y hay un `placeholder`, muestra el placeholder. Los otros Selects de la misma pantalla (Moneda, Zona) "funcionan" solo porque no tienen placeholder y Radix cae al valor como texto por defecto.

Como el usuario ve el campo vacío, asume que no se guardó y lo vuelve a llenar — pero ya estaba guardado.

## Cambio propuesto

Un único ajuste en `src/components/configuracion/FacturacionTab.tsx`, en el `<SelectValue>` de "Régimen fiscal":

```tsx
<SelectValue placeholder="Selecciona régimen">
  {f.regimen_fiscal || undefined}
</SelectValue>
```

Esto hace que el trigger muestre el valor actual aunque el popover nunca se haya abierto, resolviendo la percepción de "no se guardó". No cambia el flujo de guardado (ya funciona).

## Fuera de alcance

- No modifico backend, esquema ni lógica de guardado — todo está correcto.
- No toco los otros Selects de la pantalla (funcionan por casualidad); si conviene, se pueden armonizar después.