# Ubicación clickeable en dashboard y PDF de OC

El campo `obras.ubicacion` ya acepta cualquier texto (string hasta 500 caracteres), así que **no hay cambios de base de datos ni de validación**. Solo cambia cómo se renderiza.

## 1. Helper compartido

Crear `src/lib/ubicacion.ts`:

```ts
export function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function buildMapsHref(ubicacion: string | null | undefined): string | null {
  if (!ubicacion) return null;
  const v = ubicacion.trim();
  if (!v) return null;
  return isUrl(v)
    ? v
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}`;
}
```

Esto resuelve el doble-wrap actual: si pegas `https://maps.app.goo.gl/...`, se usa tal cual; si es texto plano ("Av. Reforma 123, CDMX") se arma la búsqueda en Google Maps.

## 2. Dashboard de obra (`app.obras.$obraId.index.tsx`)

Reemplazar la construcción manual de `mapsHref` por `buildMapsHref(obra.ubicacion)`. El render visual no cambia: sigue mostrando el texto + botones "Abrir mapa" y "Copiar". Si lo que está guardado es un URL largo, mostrar texto truncado tipo "Link de Google Maps" en lugar de la URL completa para mantener la UI limpia.

## 3. PDF de OC a proveedores (`src/lib/pdf/solicitud-cotizacion-pdf.ts`)

Hoy (línea 85-86) imprime `Ubicación: <texto>` como texto plano. Cambiar a:

- Imprimir `Ubicación: <texto>` (o "Ver en Google Maps" si es URL).
- Agregar un enlace clickeable usando `doc.textWithLink(...)` de jsPDF apuntando a `buildMapsHref(ubicacion)`, con estilo subrayado/color azul para que el proveedor identifique que es clickeable.

Resultado: cuando el proveedor abra el PDF de la OC en cualquier visor moderno (Adobe, Preview, navegador, móvil), puede hacer click directo y se abre el mapa.

## 4. Pantalla de configuración (`app.obras.$obraId.configuracion.tsx`) y alta de obra (`app.obras.nueva.tsx`)

Ajustes menores en el input para guiar al director:
- Label: "Ubicación de la obra"
- Placeholder: "Dirección o link de Google Maps"
- Helper text debajo: "Puedes pegar un enlace de Google Maps; aparecerá clickeable en las órdenes de compra a proveedores."

## Detalles técnicos

- No se toca la base de datos, ni el schema Zod, ni RLS.
- `jsPDF.textWithLink(text, x, y, { url })` ya está disponible (la librería ya se usa para generar el PDF de cotización).
- El helper `buildMapsHref` se reutiliza entre componente React y generador de PDF, ambos lado cliente.

## Archivos a modificar

- `src/lib/ubicacion.ts` (nuevo)
- `src/routes/_authenticated/app.obras.$obraId.index.tsx`
- `src/lib/pdf/solicitud-cotizacion-pdf.ts`
- `src/routes/_authenticated/app.obras.$obraId.configuracion.tsx`
- `src/routes/_authenticated/app.obras.nueva.tsx`
