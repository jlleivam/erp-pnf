## Cambio

Hacer clickable la fila de **Reembolso** en `CxP → Caja chica` para abrir el `RevisarReembolsoSheet` existente (mismo que ya usa el módulo de Caja chica). Ahí el administrativo puede reclasificar comprobantes de los gastos aprobados.

### En `src/components/pagos/CajaChicaPorPagarTab.tsx`

1. Importar `RevisarReembolsoSheet` desde `@/components/caja-chica/RevisarReembolsoSheet`.
2. Agregar estado `const [verReembolsoId, setVerReembolsoId] = useState<string | null>(null);`.
3. En el `<TableRow>` de un reembolso: `className="cursor-pointer hover:bg-muted/30"` y `onClick={() => setVerReembolsoId(r.id)}`.
4. El botón **Reponer** se queda igual, pero se le añade `onClick={(e) => { e.stopPropagation(); setReponerReemb(r); }}` para que no abra el sheet al pagar.
5. Las filas de **Fondo** no cambian (no abren sheet).
6. Renderizar al final:
   ```tsx
   <RevisarReembolsoSheet
     open={!!verReembolsoId}
     onOpenChange={(o) => { if (!o) setVerReembolsoId(null); }}
     reembolsoId={verReembolsoId}
     onChanged={() => qc.invalidateQueries({ queryKey: ["caja-chica-por-pagar"] })}
   />
   ```

Sin cambios en backend ni en el sheet — éste ya muestra el botón "Reclasificar comprobante" cuando el reembolso está en `enviado_admin` y el gasto está `aprobado`, que es exactamente el caso de esta lista.
