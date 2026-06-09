### Cambios en menú inferior administrativo

1. **Renombrar "Cuentas" → "CXP"**
   - Archivo: `src/components/AppShell.tsx`
   - Cambiar el label del item de navegación de `"Cuentas"` a `"CXP"`.

2. **Distribución proporcional al ancho**
   - Archivo: `src/components/AppShell.tsx`
   - Cambiar `variant="scroll"` a `variant="fixed"` (o remover la prop ya que "fixed" es el default) en el `<MobileBottomBar>` del bloque `showAdmin`.
   - Con `variant="fixed"`, cada item usa `flex-1`, por lo que los 6 módulos se distribuyen proporcionalmente ocupando todo el ancho de la pantalla, adaptándose automáticamente a cualquier tamaño móvil.
   - Como ya no se necesita el botón "Más" en este menú admin, se omitirá `onMoreClick`.

### Resultado esperado
El menú inferior del rol administrativo mostrará 6 pestañas de igual ancho: **CXP**, **Nómina**, **Obras**, **Catálogos**, **Tesorería** y **Gastos**, ocupando todo el ancho disponible sin scroll horizontal.