## Objetivo

En la comparativa, impedir que el administrativo asigne a un proveedor una **cantidad** (y por tanto un **importe**) mayor al que ese proveedor cotizó para cada insumo. Hoy solo se muestra un borde ámbar de aviso, pero el sistema sí deja capturar más y permite enviar la OC.

## Regla de candado

Por cada línea `insumo × proveedor`:
- Cantidad cotizada disponible = `oferta.cantidad` (lo que el proveedor puso al capturar la respuesta).
- Precio unitario = `oferta.precio` (fijo, no editable acá).
- **Cantidad máxima asignable = `oferta.cantidad`**.
- **Importe máximo = `oferta.cantidad × oferta.precio`** (consecuencia directa del candado de cantidad, ya que el precio es fijo).

No se introduce un candado "monetario" adicional separado: el precio ya está bloqueado en la matriz de ofertas, así que limitando la cantidad queda limitado el importe automáticamente.

## Cambios en `src/components/requisiciones/ComparativaTable.tsx`

1. **Input de cantidad por línea** (alrededor de la línea 716):
   - Agregar `max={ofertaA?.cantidad ?? undefined}` al `<Input type="number">`.
   - En `onChange`, clamp: `cantidad = Math.min(Number(e.target.value) || 0, ofertaA?.cantidad ?? Infinity)`.
   - Mostrar siempre el ayudante `{cantidad} / {ofertaA.cantidad} {unidad}` (ya existe el sufijo `/ ${ofertaA.cantidad}`).
   - Si el usuario intenta exceder, mostrar toast: *"El proveedor solo cotizó X {unidad}"*.
   - Cambiar el estilo `excede` (borde ámbar) → ya no aplica porque queda imposible exceder; se quita esa variante.

2. **Cambio de proveedor en el Select** (línea 680): al hacer `onValueChange`, la nueva cantidad ya se trunca con `Math.min(a.cantidad, o.cantidad)` — está bien, pero asegurar que también respeta el restante. Sin cambios funcionales, solo verificar.

3. **Auto-asignación "mejor precio"** (`tomarMejorPrecio`, línea 261): ya respeta `o.cantidad` con `Math.min(faltante, o.cantidad)`. Sin cambios.

4. **Validación al enviar OC** (mutación `enviarMut`, línea 395):
   - Antes de llamar a `guardarFn`, recorrer `insumos` y verificar que `cantidad ≤ oferta.cantidad` para cada línea.
   - Si alguna excede (por datos heredados de paquetes guardados previos al candado), abortar con `toast.error("La cantidad asignada supera lo cotizado por el proveedor para {insumo}")`.

5. **Indicador visual de tope alcanzado** (opcional menor): cuando `a.cantidad === ofertaA.cantidad`, mostrar el helper en color `text-emerald-700` para indicar que se asignó todo lo cotizado.

## Fuera de alcance

- No se valida en el backend (`guardarPaquete`) en este cambio — el candado vive en la UI del administrativo. Si lo quieres también server-side, lo agregamos en una iteración posterior.
- No se tocan paquetes ya guardados con cantidades fuera de tope; solo se bloquea la edición/envío posterior.
- No se modifica el flujo de cotizaciones ni la captura de respuesta del proveedor.

## Pregunta abierta

¿Quieres que también valide en **servidor** (en `guardarPaquete` de `src/lib/api/cotizaciones.functions.ts`) que ninguna línea exceda lo cotizado por el proveedor? Es más robusto pero implica tocar lógica de backend. Si no respondes, lo dejo solo en la UI.