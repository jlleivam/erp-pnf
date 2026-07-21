**Diagnóstico confirmado**
- El valor sí está guardado en la base de datos: `601 — General de Ley Personas Morales`.
- El problema está en el render del dropdown: el componente `SelectValue` de régimen fiscal está recibiendo texto manual como children, lo que provoca el warning de React/Radix y evita que el valor seleccionado se pinte correctamente.

**Plan de implementación**
1. Corregir `FacturacionTab` para que `SelectValue` sea usado de forma compatible con Radix, sin children manuales.
2. Mantener el `Select` controlado con `value={f.regimen_fiscal}` y los `SelectItem` existentes para que Radix muestre automáticamente el texto seleccionado.
3. Agregar una protección pequeña para que, si por alguna razón el régimen guardado no está dentro de la lista actual, se incluya como opción visible y no aparezca vacío.
4. Verificar en la pantalla de Configuración de empresa que el campo muestre `601 — General de Ley Personas Morales` al cargar.