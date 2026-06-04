# Mejoras al formulario de Datos de facturación

## 1) Redirigir al dashboard tras guardar
En `FacturacionTab.tsx`, al `onSuccess` de la mutación `save`, navegar a `/app` con `useNavigate` de TanStack Router (además del toast e invalidación de la query).

## 2) Estado como dropdown
Reemplazar el `<Input>` del campo "Estado" por un `<Select>` con las 32 entidades federativas de México (incluye CDMX). Lista hard-coded en el mismo archivo:

Aguascalientes, Baja California, Baja California Sur, Campeche, Chiapas, Chihuahua, Ciudad de México, Coahuila, Colima, Durango, Estado de México, Guanajuato, Guerrero, Hidalgo, Jalisco, Michoacán, Morelos, Nayarit, Nuevo León, Oaxaca, Puebla, Querétaro, Quintana Roo, San Luis Potosí, Sinaloa, Sonora, Tabasco, Tamaulipas, Tlaxcala, Veracruz, Yucatán, Zacatecas.

Solo se toca `src/components/configuracion/FacturacionTab.tsx`.
