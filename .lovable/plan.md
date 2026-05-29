## Objetivo

Dentro del panel de cotización (`CotizacionSheet`), agregar una nueva primera pestaña llamada **Requisición** que muestre la requisición original en modo lectura, antes de la pestaña de Cotizaciones.

## Cambios

### `src/components/requisiciones/CotizacionSheet.tsx`

1. Extender el tipo:
   ```ts
   export type CotizacionTab = "requisicion" | "solicitudes" | "comparativa" | "ocs";
   ```
   y cambiar `initialTab` por defecto a `"requisicion"`.

2. En `TabsList`: pasar de `grid-cols-3` a `grid-cols-4` y agregar como primer trigger:
   ```
   <TabsTrigger value="requisicion">Requisición</TabsTrigger>
   ```

3. Agregar un nuevo `TabsContent value="requisicion"` con:
   - Encabezado: folio, estatus (badge), solicitante, fecha de creación / envío.
   - Notas de la requisición (si existen).
   - Tabla de insumos pedidos: Insumo, Unidad, Cantidad, Fecha requerida, Nota.
   - Todo en modo lectura (sin acciones), usando los datos ya disponibles en `req` y `reqItems` que ya devuelve `getCotizacionRequisicion`.

### Resto de la app

- Ningún otro componente abre el sheet con `initialTab` específico que se rompa: los call sites siguen funcionando porque los valores existentes (`solicitudes`, `comparativa`, `ocs`) permanecen válidos.
- No hay cambios en server functions ni en la base de datos: la requisición y sus items ya vienen en el query `getCotizacionRequisicion`.

## Riesgos

Bajo. Es solo UI dentro de un componente, reutilizando datos ya cargados.
