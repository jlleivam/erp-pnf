## Mostrar el logo de la empresa en la barra superior

Reemplazar el ícono `Building2` + texto "ERP PNF" del header de `AppShell` por el logo de la empresa cuando exista uno cargado. El elemento sigue siendo un `<Link to="/app">`, conservando su función de navegación al dashboard.

### Cambios en `src/components/AppShell.tsx`

1. Importar `useQuery` de `@tanstack/react-query`, `useServerFn` de `@tanstack/react-start`, y `getCompanyConfig` + `getCompanyLogoSignedUrl` de `@/lib/api/company.functions`.
2. Dentro de `AppShell`:
   - Consultar la config de la empresa con `useQuery(["company-config"], …)` (misma queryKey que ya usa `IdentidadTab`, así se comparte caché).
   - Si `cfg.data?.logo_url` existe, resolver la signed URL con un segundo `useQuery(["company-logo-signed", path], …)` con `staleTime` de ~50 min.
3. En el `<header>`, dentro del `<Link to="/app">`:
   - Si hay `signedUrl`: renderizar `<img src={signedUrl} alt={profile?.company?... ?? "Logo empresa"} className="h-8 w-auto max-w-[160px] object-contain" />`.
   - Si no hay logo: mantener el `Building2` + "ERP PNF" actual como fallback.
4. No tocar el branding del sidebar (`sidebarBranding`) — el usuario solo pidió la barra superior.

### Notas técnicas

- La queryKey `["company-config"]` ya se invalida desde `IdentidadTab` al subir/eliminar el logo, así que el header se actualizará automáticamente.
- La signed URL del bucket `company-logos` (privado) dura 1 h; se refresca por re-render cuando expira el `staleTime`.
- No se modifica ningún archivo de backend ni el esquema; solo presentación en `AppShell.tsx`.