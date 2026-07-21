## Cambio

En `src/components/insumos/CatalogoInsumosModule.tsx`, aplicar al botón "Solicitar insumo" (y a los secundarios Categorías / Unidades / Importar Excel) exactamente el mismo tamaño que usa "Solicitar alta" en Trabajadores:

- `size="sm"` + `h-8`
- ícono `size-3.5 mr-1` (en lugar de `size-4 mr-1`)

Botón principal:
```tsx
<Button
  size="sm"
  onClick={() => setOpenSolicitar(true)}
  className="bg-[#0f1e3d] hover:bg-[#0f1e3d]/90 h-8"
>
  <Plus className="size-3.5 mr-1" /> Solicitar insumo
</Button>
```

Botones secundarios (Categorías, Unidades, Importar Excel): agregar `h-8` y bajar íconos a `size-3.5 mr-1` para conservar densidad uniforme.

## Fuera de alcance
No se tocan filtros, tabla ni lógica.
