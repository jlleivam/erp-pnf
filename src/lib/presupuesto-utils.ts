// Utilidades compartidas (cliente y servidor) para validar y calcular
// renglones de presupuesto con clave WBS.

export type RenglonInput = {
  clave: string;
  concepto: string;
  unidad?: string | null;
  cantidad?: number | null;
  precio_unitario?: number | null;
};

export type RenglonCalculado = RenglonInput & {
  nivel: number;
  parent_clave: string | null;
  es_grupo: boolean;
  importe: number;
  orden: number;
};

export type ValidacionRenglon = {
  index: number;
  clave: string;
  errores: string[];
};

const CLAVE_REGEX = /^\d+(\.\d+){0,4}$/;

export function nivelDeClave(clave: string): number {
  return clave.split(".").length;
}

export function parentDeClave(clave: string): string | null {
  const idx = clave.lastIndexOf(".");
  return idx === -1 ? null : clave.slice(0, idx);
}

export function ordenSort(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10));
  const pb = b.split(".").map((n) => parseInt(n, 10));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? -1;
    const y = pb[i] ?? -1;
    if (x !== y) return x - y;
  }
  return 0;
}

/**
 * Valida y calcula importes, niveles, es_grupo y orden de los renglones.
 * Devuelve los renglones calculados + lista de errores por índice.
 */
export function procesarRenglones(input: RenglonInput[]): {
  renglones: RenglonCalculado[];
  errores: ValidacionRenglon[];
  montoTotal: number;
} {
  const errores: ValidacionRenglon[] = [];
  const clavesVistas = new Map<string, number>();

  // Validación básica
  input.forEach((r, i) => {
    const errs: string[] = [];
    const clave = (r.clave ?? "").trim();
    if (!clave) errs.push("Clave vacía");
    else if (!CLAVE_REGEX.test(clave))
      errs.push("Formato de clave inválido (use 1, 1.1, 1.2.3, máx 5 niveles)");
    if (!r.concepto || !r.concepto.trim()) errs.push("Concepto requerido");
    if (clavesVistas.has(clave)) errs.push("Clave duplicada");
    else if (clave) clavesVistas.set(clave, i);
    if (errs.length) errores.push({ index: i, clave, errores: errs });
  });

  // Si hay errores estructurales, regresamos sin calcular agregados
  if (errores.length > 0) {
    return { renglones: [], errores, montoTotal: 0 };
  }

  // Construir set de claves
  const claves = new Set(input.map((r) => r.clave.trim()));

  // Validar que cada padre exista (excepto nivel 1)
  input.forEach((r, i) => {
    const clave = r.clave.trim();
    const parent = parentDeClave(clave);
    if (parent && !claves.has(parent)) {
      errores.push({ index: i, clave, errores: [`Falta el renglón padre "${parent}"`] });
    }
  });

  if (errores.length > 0) {
    return { renglones: [], errores, montoTotal: 0 };
  }

  // Ordenar
  const ordenadas = [...input]
    .map((r) => ({ ...r, clave: r.clave.trim() }))
    .sort((a, b) => ordenSort(a.clave, b.clave));

  // Detectar grupos: cualquier clave con hijos directos
  const hijosPorPadre = new Map<string, string[]>();
  for (const r of ordenadas) {
    const p = parentDeClave(r.clave);
    if (p) {
      const arr = hijosPorPadre.get(p) ?? [];
      arr.push(r.clave);
      hijosPorPadre.set(p, arr);
    }
  }

  // Calcular importes: hojas primero, luego grupos en orden descendente de nivel
  const importes = new Map<string, number>();
  const ordenPorNivel = [...ordenadas].sort(
    (a, b) => nivelDeClave(b.clave) - nivelDeClave(a.clave),
  );

  for (const r of ordenPorNivel) {
    const esGrupo = hijosPorPadre.has(r.clave);
    if (esGrupo) {
      const hijos = hijosPorPadre.get(r.clave) ?? [];
      const total = hijos.reduce((s, c) => s + (importes.get(c) ?? 0), 0);
      importes.set(r.clave, total);
    } else {
      const cant = Number(r.cantidad ?? 0);
      const pu = Number(r.precio_unitario ?? 0);
      importes.set(r.clave, cant * pu);
    }
  }

  const renglones: RenglonCalculado[] = ordenadas.map((r, i) => {
    const esGrupo = hijosPorPadre.has(r.clave);
    return {
      clave: r.clave,
      concepto: r.concepto.trim(),
      unidad: esGrupo ? null : (r.unidad ?? null),
      cantidad: esGrupo ? null : (r.cantidad ?? null),
      precio_unitario: esGrupo ? null : (r.precio_unitario ?? null),
      nivel: nivelDeClave(r.clave),
      parent_clave: parentDeClave(r.clave),
      es_grupo: esGrupo,
      importe: importes.get(r.clave) ?? 0,
      orden: i,
    };
  });

  // Monto total = suma de renglones nivel 1
  const montoTotal = renglones
    .filter((r) => r.nivel === 1)
    .reduce((s, r) => s + r.importe, 0);

  return { renglones, errores: [], montoTotal };
}
