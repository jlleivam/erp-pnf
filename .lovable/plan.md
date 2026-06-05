## Problema
El `Command` de shadcn (cmdk) usa por defecto un filtro fuzzy que matchea letras en orden, no substrings. Por eso "arena" puntúa positivo con "Bailarina" y "Vibrador".

## Solución
En `src/components/requisiciones/NuevaRequisicionSheet.tsx`, pasar un `filter` personalizado a `<Command>` que solo devuelva 1 cuando el `value` del item **contenga** el `search` como substring, normalizando ambos a minúsculas y sin acentos.

```ts
const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

<Command filter={(value, search) =>
  normalize(value).includes(normalize(search)) ? 1 : 0
}>
```

Sin más cambios.