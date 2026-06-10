
## Objetivo

Mostrar un badge tipo "globo de notificación" con el número de pagos pendientes en cada una de las dos pestañas de **Cuentas por pagar**:

- **Proveedores (OC)** → cantidad de OCs con saldo pendiente por pagar
- **Anticipos de destajo** → cantidad de anticipos solicitados y aún no pagados

## Diseño

- Badge circular pequeño a la derecha del texto de cada pestaña.
- Fondo `destructive` (rojo) con texto blanco, tamaño ~18px, fuente bold.
- Solo se muestra si el conteo > 0.
- Si > 99, mostrar "99+".

```text
[ Proveedores (OC)  ●3 ]   [ Anticipos de destajo  ●1 ]
```

## Implementación

Archivo: `src/components/pagos/CuentasPorPagarModule.tsx`

1. Las dos queries que alimentan las tablas ya existen en el módulo (proveedores con saldo y anticipos pendientes). Reutilizar sus `data` para calcular los conteos — no hacer queries nuevas.
2. En los `<TabsTrigger>` envolver el label en un flex y agregar el badge condicional:
   ```tsx
   <TabsTrigger value="proveedores">
     Proveedores (OC)
     {ocPendientesCount > 0 && (
       <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
         {ocPendientesCount > 99 ? "99+" : ocPendientesCount}
       </span>
     )}
   </TabsTrigger>
   ```
3. Igual para "Anticipos de destajo" con `anticiposPendientesCount`.

## Archivos a tocar

- `src/components/pagos/CuentasPorPagarModule.tsx` (único cambio, frontend puro).
