// Utilidades compartidas (cliente y servidor) para validar y calcular
// renglones de presupuesto con clave WBS, y órdenes de cambio.

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

  if (errores.length > 0) return { renglones: [], errores, montoTotal: 0 };

  const claves = new Set(input.map((r) => r.clave.trim()));

  input.forEach((r, i) => {
    const clave = r.clave.trim();
    const parent = parentDeClave(clave);
    if (parent && !claves.has(parent)) {
      errores.push({ index: i, clave, errores: [`Falta el renglón padre "${parent}"`] });
    }
  });

  if (errores.length > 0) return { renglones: [], errores, montoTotal: 0 };

  const ordenadas = [...input]
    .map((r) => ({ ...r, clave: r.clave.trim() }))
    .sort((a, b) => ordenSort(a.clave, b.clave));

  const hijosPorPadre = new Map<string, string[]>();
  for (const r of ordenadas) {
    const p = parentDeClave(r.clave);
    if (p) {
      const arr = hijosPorPadre.get(p) ?? [];
      arr.push(r.clave);
      hijosPorPadre.set(p, arr);
    }
  }

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

  const montoTotal = renglones
    .filter((r) => r.nivel === 1)
    .reduce((s, r) => s + r.importe, 0);

  return { renglones, errores: [], montoTotal };
}

// ============================================================
// Órdenes de cambio
// ============================================================

export type TipoMovimiento = "renglon" | "modificacion" | "adicion" | "eliminacion";

export type RenglonBase = {
  clave: string;
  concepto: string;
  unidad: string | null;
  cantidad: number | null;
  precio_unitario: number | null;
  importe: number;
  es_grupo: boolean;
  nivel: number;
  parent_clave: string | null;
};

export type RenglonOC = {
  clave: string;
  tipo_movimiento: "modificacion" | "adicion" | "eliminacion";
  importe_delta: number;
  // datos del estado resultante (para adiciones/modificaciones)
  concepto: string;
  unidad: string | null;
  cantidad: number | null;
  precio_unitario: number | null;
};

export type OCInput = {
  clave: string;
  tipo_movimiento: "modificacion" | "adicion" | "eliminacion";
  // Para modificacion y adicion:
  concepto?: string;
  unidad?: string | null;
  cantidad?: number | null;
  precio_unitario?: number | null;
};

export type VigenteNode = RenglonBase & {
  origen: "base" | "modificada" | "agregada" | "eliminada";
  cantidad_base?: number | null;
  pu_base?: number | null;
  cantidad_modificada?: boolean;
  pu_modificado?: boolean;
};

/**
 * Reconstruye el presupuesto vigente a partir del base + OCs autorizadas.
 * `ocsAutorizadas` es un array de arrays (cada OC es una lista de RenglonOC).
 */
export function reconstruirVigente(
  baseRenglones: RenglonBase[],
  ocsAutorizadas: RenglonOC[][],
): { vigente: VigenteNode[]; montoTotal: number } {
  // mapa clave → { concepto, unidad, cantidad, pu, origen }
  type Hoja = {
    clave: string;
    concepto: string;
    unidad: string | null;
    cantidad: number | null;
    precio_unitario: number | null;
    origen: "base" | "modificada" | "agregada";
    eliminada: boolean;
    cantidad_base?: number | null;
    pu_base?: number | null;
    cantidad_modificada?: boolean;
    pu_modificado?: boolean;
  };
  const hojas = new Map<string, Hoja>();

  for (const r of baseRenglones) {
    if (r.es_grupo) continue;
    hojas.set(r.clave, {
      clave: r.clave,
      concepto: r.concepto,
      unidad: r.unidad,
      cantidad: r.cantidad,
      precio_unitario: r.precio_unitario,
      origen: "base",
      eliminada: false,
    });
  }

  for (const oc of ocsAutorizadas) {
    for (const m of oc) {
      if (m.tipo_movimiento === "eliminacion") {
        const h = hojas.get(m.clave);
        if (h) h.eliminada = true;
      } else if (m.tipo_movimiento === "adicion") {
        hojas.set(m.clave, {
          clave: m.clave,
          concepto: m.concepto,
          unidad: m.unidad,
          cantidad: m.cantidad,
          precio_unitario: m.precio_unitario,
          origen: "agregada",
          eliminada: false,
        });
      } else if (m.tipo_movimiento === "modificacion") {
        const h = hojas.get(m.clave);
        if (h && !h.eliminada) {
          if (h.origen === "base") {
            h.cantidad_base = h.cantidad;
            h.pu_base = h.precio_unitario;
          }
          const newCant = m.cantidad;
          const newPU = m.precio_unitario;
          if (Number(newCant ?? 0) !== Number(h.cantidad_base ?? 0)) {
            h.cantidad_modificada = true;
          }
          if (Number(newPU ?? 0) !== Number(h.pu_base ?? 0)) {
            h.pu_modificado = true;
          }
          h.cantidad = newCant;
          h.precio_unitario = newPU;
          if (m.concepto) h.concepto = m.concepto;
          if (m.unidad !== undefined) h.unidad = m.unidad;
          if (h.origen === "base") h.origen = "modificada";
        }
      }
    }
  }

  // Construir nodos: incluir TODAS las hojas (vivas y eliminadas) para mostrarlas
  const todasHojas = [...hojas.values()];
  const todasClaves = new Set<string>();
  for (const h of todasHojas) {
    let c: string | null = h.clave;
    while (c) {
      todasClaves.add(c);
      c = parentDeClave(c);
    }
  }

  // detectar grupos (cualquier clave con hijos directos)
  const hijosPorPadre = new Map<string, string[]>();
  for (const c of todasClaves) {
    const p = parentDeClave(c);
    if (p) {
      const arr = hijosPorPadre.get(p) ?? [];
      arr.push(c);
      hijosPorPadre.set(p, arr);
    }
  }

  // Mapa de concepto/unidad para grupos: tomar del base si existe; si no, de adición que coincida
  const conceptoGrupo = new Map<string, string>();
  const origenGrupo = new Map<string, "base" | "modificada" | "agregada">();
  for (const r of baseRenglones) {
    if (r.es_grupo) {
      conceptoGrupo.set(r.clave, r.concepto);
      origenGrupo.set(r.clave, "base");
    }
  }
  for (const oc of ocsAutorizadas) {
    for (const m of oc) {
      if (m.tipo_movimiento === "adicion" && hijosPorPadre.has(m.clave)) {
        if (!conceptoGrupo.has(m.clave)) {
          conceptoGrupo.set(m.clave, m.concepto);
          origenGrupo.set(m.clave, "agregada");
        }
      }
    }
  }

  // Calcular importes (hojas primero, luego grupos). Las eliminadas aportan 0.
  const importes = new Map<string, number>();
  for (const h of todasHojas) {
    if (h.eliminada) {
      importes.set(h.clave, 0);
    } else {
      importes.set(h.clave, Number(h.cantidad ?? 0) * Number(h.precio_unitario ?? 0));
    }
  }
  const clavesOrdNivelDesc = [...todasClaves].sort(
    (a, b) => nivelDeClave(b) - nivelDeClave(a),
  );
  for (const clave of clavesOrdNivelDesc) {
    if (hijosPorPadre.has(clave)) {
      const hijos = hijosPorPadre.get(clave)!;
      const total = hijos.reduce((s, c) => s + (importes.get(c) ?? 0), 0);
      importes.set(clave, total);
    }
  }

  // Construir lista ordenada
  const claveOrden = [...todasClaves].sort(ordenSort);
  const vigente: VigenteNode[] = claveOrden.map((clave) => {
    const esGrupo = hijosPorPadre.has(clave);
    if (esGrupo) {
      return {
        clave,
        concepto: conceptoGrupo.get(clave) ?? clave,
        unidad: null,
        cantidad: null,
        precio_unitario: null,
        importe: importes.get(clave) ?? 0,
        es_grupo: true,
        nivel: nivelDeClave(clave),
        parent_clave: parentDeClave(clave),
        origen: origenGrupo.get(clave) ?? "base",
      };
    }
    const h = hojas.get(clave)!;
    if (h.eliminada) {
      return {
        clave,
        concepto: h.concepto,
        unidad: h.unidad,
        cantidad: 0,
        precio_unitario: h.precio_unitario,
        importe: 0,
        es_grupo: false,
        nivel: nivelDeClave(clave),
        parent_clave: parentDeClave(clave),
        origen: "eliminada",
      };
    }
    return {
      clave,
      concepto: h.concepto,
      unidad: h.unidad,
      cantidad: h.cantidad,
      precio_unitario: h.precio_unitario,
      importe: importes.get(clave) ?? 0,
      es_grupo: false,
      nivel: nivelDeClave(clave),
      parent_clave: parentDeClave(clave),
      origen: h.origen,
      cantidad_base: h.cantidad_base,
      pu_base: h.pu_base,
      cantidad_modificada: h.cantidad_modificada,
      pu_modificado: h.pu_modificado,
    };
  });

  const montoTotal = vigente.filter((n) => n.nivel === 1).reduce((s, n) => s + n.importe, 0);
  return { vigente, montoTotal };
}

/**
 * Valida y calcula los renglones de una orden de cambio sobre un vigente previo.
 */
export function procesarOrdenCambio(
  vigentePrevio: VigenteNode[],
  input: OCInput[],
): {
  renglones: (RenglonOC & {
    nivel: number;
    parent_clave: string | null;
    orden: number;
  })[];
  errores: ValidacionRenglon[];
  montoDelta: number;
} {
  const errores: ValidacionRenglon[] = [];
  const porClaveVig = new Map<string, VigenteNode>();
  for (const n of vigentePrevio) porClaveVig.set(n.clave, n);

  // claves vistas en este input
  const vistas = new Map<string, number>();

  input.forEach((m, i) => {
    const errs: string[] = [];
    const clave = (m.clave ?? "").trim();
    if (!clave) errs.push("Clave vacía");
    else if (!CLAVE_REGEX.test(clave))
      errs.push("Formato de clave inválido (1, 1.1, 1.2.3, máx 5 niveles)");
    if (vistas.has(clave)) errs.push("Clave duplicada en esta orden de cambio");
    else if (clave) vistas.set(clave, i);

    const existe = porClaveVig.get(clave);

    if (m.tipo_movimiento === "modificacion") {
      if (!existe) errs.push("El concepto no existe en el vigente");
      else if (existe.es_grupo) errs.push("No se puede modificar un grupo, solo hojas");
      const cant = Number(m.cantidad ?? 0);
      const pu = Number(m.precio_unitario ?? 0);
      if (!Number.isFinite(cant) || !Number.isFinite(pu))
        errs.push("Cantidad y PU son requeridos");
    } else if (m.tipo_movimiento === "adicion") {
      if (existe) errs.push("La clave ya existe en el vigente");
      if (!m.concepto || !m.concepto.trim()) errs.push("Concepto requerido");
      const parent = parentDeClave(clave);
      if (parent) {
        const padreExiste =
          porClaveVig.has(parent) ||
          input.some(
            (x) => x.tipo_movimiento === "adicion" && (x.clave ?? "").trim() === parent,
          );
        if (!padreExiste) errs.push(`Falta el renglón padre "${parent}"`);
      }
    } else if (m.tipo_movimiento === "eliminacion") {
      if (!existe) errs.push("El concepto no existe en el vigente");
      else if (existe.es_grupo) errs.push("No se puede eliminar un grupo, solo hojas");
    }

    if (errs.length) errores.push({ index: i, clave, errores: errs });
  });

  if (errores.length > 0) return { renglones: [], errores, montoDelta: 0 };

  const ordenadas = [...input]
    .map((m) => ({ ...m, clave: m.clave.trim() }))
    .sort((a, b) => ordenSort(a.clave, b.clave));

  let montoDelta = 0;
  const renglones = ordenadas.map((m, i) => {
    let delta = 0;
    let concepto = "";
    let unidad: string | null = null;
    let cantidad: number | null = null;
    let pu: number | null = null;

    if (m.tipo_movimiento === "modificacion") {
      const prev = porClaveVig.get(m.clave)!;
      cantidad = Number(m.cantidad ?? 0);
      pu = Number(m.precio_unitario ?? 0);
      const nuevoImporte = cantidad * pu;
      delta = nuevoImporte - Number(prev.importe);
      concepto = m.concepto?.trim() || prev.concepto;
      unidad = m.unidad ?? prev.unidad;
    } else if (m.tipo_movimiento === "adicion") {
      cantidad = m.cantidad != null ? Number(m.cantidad) : 0;
      pu = m.precio_unitario != null ? Number(m.precio_unitario) : 0;
      delta = cantidad * pu;
      concepto = (m.concepto ?? "").trim();
      unidad = m.unidad ?? null;
    } else {
      // eliminacion
      const prev = porClaveVig.get(m.clave)!;
      delta = -Number(prev.importe);
      concepto = prev.concepto;
      unidad = prev.unidad;
      cantidad = null;
      pu = null;
    }

    montoDelta += delta;

    return {
      clave: m.clave,
      tipo_movimiento: m.tipo_movimiento,
      importe_delta: delta,
      concepto,
      unidad,
      cantidad,
      precio_unitario: pu,
      nivel: nivelDeClave(m.clave),
      parent_clave: parentDeClave(m.clave),
      orden: i,
    };
  });

  return { renglones, errores: [], montoDelta };
}
