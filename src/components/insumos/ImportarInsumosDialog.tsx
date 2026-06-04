import { useMemo, useRef, useState } from "react";

import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Upload, AlertCircle, CheckCircle2, Sparkles } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { importarInsumos, listUnidades, listCategorias } from "@/lib/api/insumos.functions";

type FilaError = { row: number; nombre: string; unidad: string; categoria: string; error: string };
type FilaValida = { row: number; nombre: string; unidad: string; categoria: string };
type UnidadNueva = { codigo: string; nombre: string };
type CategoriaNueva = { nombre: string; prefijo: string };

const PREFIJO_REGEX = /^[A-Z0-9]{3}$/;
const UNIDAD_REGEX = /^[A-Z0-9]{1,10}$/;

function normHeader(s: string) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function derivarPrefijo(nombre: string): string {
  const clean = nombre.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (clean + "XXX").slice(0, 3);
}

export function ImportarInsumosDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
}) {
  const qc = useQueryClient();
  const importarFn = useServerFn(importarInsumos);
  const unitsFn = useServerFn(listUnidades);
  const catsFn = useServerFn(listCategorias);
  const unidadesQ = useQuery({ queryKey: ["insumo-unidades"], queryFn: () => unitsFn() });
  const categoriasQ = useQuery({ queryKey: ["insumo-categorias"], queryFn: () => catsFn() });
  const unidadesValidas = useMemo(
    () => new Set((unidadesQ.data ?? []).map((u: any) => String(u.codigo).toUpperCase())),
    [unidadesQ.data],
  );
  const categoriasValidas = useMemo(
    () => new Set((categoriasQ.data ?? []).map((c: any) => String(c.nombre).trim().toLowerCase())),
    [categoriasQ.data],
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "errors" | "faltantes" | "preview">("upload");
  const [errores, setErrores] = useState<FilaError[]>([]);
  const [validas, setValidas] = useState<FilaValida[]>([]);
  const [unidadesNuevas, setUnidadesNuevas] = useState<UnidadNueva[]>([]);
  const [categoriasNuevas, setCategoriasNuevas] = useState<CategoriaNueva[]>([]);
  const [parsing, setParsing] = useState(false);

  function reset() {
    setStep("upload");
    setErrores([]);
    setValidas([]);
    setUnidadesNuevas([]);
    setCategoriasNuevas([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose(b: boolean) {
    if (!b) reset();
    onOpenChange(b);
  }
  async function descargarPlantilla() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      ["nombre", "unidad", "categoría"],
      ["Cemento Portland 50kg", "PZA", "Materiales"],
      ["Varilla 3/8\"", "PZA", "Acero"],
    ]);
    ws["!cols"] = [{ wch: 35 }, { wch: 10 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Insumos");
    XLSX.writeFile(wb, "plantilla-insumos.xlsx");
  }

  async function descargarErrores() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      ["Fila", "nombre", "unidad", "categoría", "Error"],
      ...errores.map((e) => [e.row, e.nombre, e.unidad, e.categoria, e.error]),
    ]);
    ws["!cols"] = [{ wch: 8 }, { wch: 35 }, { wch: 10 }, { wch: 20 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errores");
    XLSX.writeFile(wb, "insumos-con-errores.xlsx");
  }

  async function handleFile(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("El archivo es demasiado grande (máx 2MB)");
      return;
    }
    setParsing(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "", blankrows: false });

      if (rows.length === 0) {
        toast.error("El archivo está vacío");
        return;
      }

      let headerIdx = -1;
      let colNombre = -1, colUnidad = -1, colCategoria = -1;
      for (let i = 0; i < Math.min(rows.length, 5); i++) {
        const cells = (rows[i] ?? []).map((c: any) => normHeader(String(c)));
        const n = cells.indexOf("nombre");
        const u = cells.indexOf("unidad");
        const c = cells.findIndex((x) => x === "categoria");
        if (n >= 0 && u >= 0 && c >= 0) {
          headerIdx = i; colNombre = n; colUnidad = u; colCategoria = c;
          break;
        }
      }
      if (headerIdx < 0) {
        toast.error("No se encontraron los encabezados: nombre, unidad, categoría");
        return;
      }

      const errs: FilaError[] = [];
      const vals: FilaValida[] = [];
      const seen = new Map<string, number>();

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i] ?? [];
        const nombre = String(r[colNombre] ?? "").trim();
        const unidadRaw = String(r[colUnidad] ?? "").trim().toUpperCase();
        const categoria = String(r[colCategoria] ?? "").trim();
        const excelRow = i + 1;

        if (!nombre && !unidadRaw && !categoria) continue;

        const errMsgs: string[] = [];
        if (!nombre) errMsgs.push("Nombre vacío");
        if (!unidadRaw) errMsgs.push("Unidad vacía");
        else if (!UNIDAD_REGEX.test(unidadRaw)) {
          errMsgs.push(`Unidad con formato inválido (${unidadRaw}): solo letras/números, máx 10`);
        }
        if (!categoria) errMsgs.push("Categoría vacía");

        const key = nombre.toLowerCase();
        if (nombre && seen.has(key)) {
          errMsgs.push(`Duplicado en el archivo (fila ${seen.get(key)})`);
        } else if (nombre) {
          seen.set(key, excelRow);
        }

        if (errMsgs.length > 0) {
          errs.push({ row: excelRow, nombre, unidad: unidadRaw, categoria, error: errMsgs.join("; ") });
        } else {
          vals.push({ row: excelRow, nombre, unidad: unidadRaw, categoria });
        }
      }

      if (vals.length === 0 && errs.length === 0) {
        toast.error("No se encontraron filas de datos");
        return;
      }

      if (errs.length > 0) {
        setErrores(errs);
        setStep("errors");
        return;
      }

      // Detectar unidades y categorías faltantes
      const unidadesSet = new Set<string>();
      const categoriasMap = new Map<string, string>(); // lowercase -> nombre original
      for (const v of vals) {
        if (!unidadesValidas.has(v.unidad)) unidadesSet.add(v.unidad);
        const ck = v.categoria.toLowerCase();
        if (!categoriasValidas.has(ck) && !categoriasMap.has(ck)) {
          categoriasMap.set(ck, v.categoria);
        }
      }

      setValidas(vals);

      if (unidadesSet.size > 0 || categoriasMap.size > 0) {
        setUnidadesNuevas(
          Array.from(unidadesSet).sort().map((codigo) => ({ codigo, nombre: "" })),
        );
        setCategoriasNuevas(
          Array.from(categoriasMap.values()).map((nombre) => ({
            nombre,
            prefijo: derivarPrefijo(nombre),
          })),
        );
        setStep("faltantes");
      } else {
        setUnidadesNuevas([]);
        setCategoriasNuevas([]);
        setStep("preview");
      }
    } catch (e: any) {
      toast.error(`Error leyendo el archivo: ${e.message ?? e}`);
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const faltantesValidos = useMemo(() => {
    const unidadesOk = unidadesNuevas.every((u) => u.nombre.trim().length > 0);
    const prefijos = new Set<string>();
    let categoriasOk = true;
    for (const c of categoriasNuevas) {
      const p = c.prefijo.trim().toUpperCase();
      if (!PREFIJO_REGEX.test(p)) { categoriasOk = false; break; }
      if (prefijos.has(p)) { categoriasOk = false; break; }
      prefijos.add(p);
    }
    return unidadesOk && categoriasOk;
  }, [unidadesNuevas, categoriasNuevas]);

  const confirmMut = useMutation({
    mutationFn: importarFn,
    onSuccess: (res: any) => {
      if (res.ok === false) {
        setErrores(res.errores);
        setStep("errors");
        toast.error(`${res.errores.length} errores detectados en el servidor`);
        return;
      }
      const partes = [`${res.insertadas} insumos importados`];
      if (res.unidadesCreadas) partes.push(`${res.unidadesCreadas} unidades nuevas`);
      if (res.categoriasCreadas) partes.push(`${res.categoriasCreadas} categorías nuevas`);
      toast.success(partes.join(" · "));
      qc.invalidateQueries({ queryKey: ["insumos"] });
      qc.invalidateQueries({ queryKey: ["insumo-categorias"] });
      qc.invalidateQueries({ queryKey: ["insumo-unidades"] });
      qc.invalidateQueries({ queryKey: ["insumos-metricas"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Error al importar"),
  });

  function confirmarImportacion() {
    confirmMut.mutate({
      data: {
        filas: validas,
        unidadesNuevas: unidadesNuevas.map((u) => ({
          codigo: u.codigo,
          nombre: u.nombre.trim(),
        })),
        categoriasNuevas: categoriasNuevas.map((c) => ({
          nombre: c.nombre,
          prefijo: c.prefijo.trim().toUpperCase(),
        })),
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" />
            Importar insumos desde Excel
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Descarga la plantilla, llénala y súbela para importar múltiples insumos a la vez."}
            {step === "errors" && "El archivo contiene errores que debes corregir antes de importar."}
            {step === "faltantes" && "Detectamos unidades o categorías nuevas. Complétalas para crearlas junto con la importación."}
            {step === "preview" && "Revisa los insumos antes de confirmar la importación."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 overflow-auto">
            <Card className="p-4 bg-muted/40">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="size-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">Paso 1: Descarga la plantilla</p>
                  <p className="text-sm text-muted-foreground">
                    Encabezados requeridos: <code className="text-xs">nombre</code>,{" "}
                    <code className="text-xs">unidad</code>, <code className="text-xs">categoría</code>.
                    Si una unidad o categoría no existe, te preguntaremos para crearla al momento.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={descargarPlantilla}>
                  <Download /> Plantilla
                </Button>
              </div>
            </Card>

            <label
              className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/40 transition"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
            >
              <Upload className="size-8 text-muted-foreground" />
              <p className="font-medium">Paso 2: Sube tu archivo</p>
              <p className="text-sm text-muted-foreground">Click o arrastra un archivo .xlsx aquí</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              {parsing && <p className="text-xs text-muted-foreground">Procesando...</p>}
            </label>
          </div>
        )}

        {step === "errors" && (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <Card className="p-3 border-destructive bg-destructive/5 flex items-center gap-2">
              <AlertCircle className="size-5 text-destructive shrink-0" />
              <p className="text-sm font-medium text-destructive">
                {errores.length} {errores.length === 1 ? "error encontrado" : "errores encontrados"} — corrige el archivo y vuelve a subirlo
              </p>
            </Card>
            <div className="overflow-auto border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-16">Fila</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errores.map((e, i) => (
                    <TableRow key={i} className="bg-destructive/5">
                      <TableCell className="font-mono text-xs">{e.row}</TableCell>
                      <TableCell>{e.nombre || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{e.unidad || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>{e.categoria || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-destructive text-sm">{e.error}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {step === "faltantes" && (
          <div className="flex-1 overflow-auto flex flex-col gap-4">
            <Card className="p-3 border-amber-300 bg-amber-50 flex items-center gap-2">
              <Sparkles className="size-5 text-amber-600 shrink-0" />
              <p className="text-sm font-medium text-amber-900">
                Se crearán {unidadesNuevas.length} unidad(es) y {categoriasNuevas.length} categoría(s) nuevas junto con la importación.
              </p>
            </Card>

            {unidadesNuevas.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Unidades nuevas</h3>
                <p className="text-xs text-muted-foreground">
                  Asigna un nombre descriptivo para cada código (ej. KG → "Kilogramo").
                </p>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-32">Código</TableHead>
                        <TableHead>Nombre descriptivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unidadesNuevas.map((u, i) => (
                        <TableRow key={u.codigo}>
                          <TableCell className="font-mono text-sm">{u.codigo}</TableCell>
                          <TableCell>
                            <Input
                              value={u.nombre}
                              placeholder="Ej. Kilogramo"
                              onChange={(e) => {
                                const v = e.target.value;
                                setUnidadesNuevas((prev) =>
                                  prev.map((x, j) => (j === i ? { ...x, nombre: v } : x)),
                                );
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {categoriasNuevas.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Categorías nuevas</h3>
                <p className="text-xs text-muted-foreground">
                  El prefijo (3 letras o números) se usa como inicio del código de los insumos. Debe ser único.
                </p>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="w-32">Prefijo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoriasNuevas.map((c, i) => {
                        const p = c.prefijo.trim().toUpperCase();
                        const invalido = !PREFIJO_REGEX.test(p);
                        const duplicado =
                          !invalido &&
                          categoriasNuevas.some((o, j) => j !== i && o.prefijo.trim().toUpperCase() === p);
                        return (
                          <TableRow key={c.nombre}>
                            <TableCell className="text-sm">{c.nombre}</TableCell>
                            <TableCell>
                              <Input
                                value={c.prefijo}
                                maxLength={3}
                                className={`font-mono uppercase ${invalido || duplicado ? "border-destructive" : ""}`}
                                onChange={(e) => {
                                  const v = e.target.value.toUpperCase();
                                  setCategoriasNuevas((prev) =>
                                    prev.map((x, j) => (j === i ? { ...x, prefijo: v } : x)),
                                  );
                                }}
                              />
                              {duplicado && (
                                <p className="text-xs text-destructive mt-1">Prefijo duplicado</p>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "preview" && (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <Card className="p-3 border-emerald-300 bg-emerald-50 flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
              <p className="text-sm font-medium text-emerald-900">
                {validas.length} {validas.length === 1 ? "insumo listo" : "insumos listos"} para importar
                {(unidadesNuevas.length > 0 || categoriasNuevas.length > 0) && (
                  <> · {unidadesNuevas.length} unidad(es) y {categoriasNuevas.length} categoría(s) nuevas</>
                )}
              </p>
            </Card>
            <div className="overflow-auto border rounded-md max-h-[50vh]">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-16">Fila</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Categoría</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validas.slice(0, 100).map((v, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{v.row}</TableCell>
                      <TableCell className="font-medium">{v.nombre}</TableCell>
                      <TableCell>{v.unidad}</TableCell>
                      <TableCell>{v.categoria}</TableCell>
                    </TableRow>
                  ))}
                  {validas.length > 100 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
                        y {validas.length - 100} más...
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          )}
          {step === "errors" && (
            <>
              <Button variant="outline" onClick={descargarErrores}>
                <Download /> Descargar archivo con errores
              </Button>
              <Button onClick={reset}>Subir otro archivo</Button>
            </>
          )}
          {step === "faltantes" && (
            <>
              <Button variant="outline" onClick={reset}>Cancelar</Button>
              <Button disabled={!faltantesValidos} onClick={() => setStep("preview")}>
                Continuar
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset} disabled={confirmMut.isPending}>
                Subir otro archivo
              </Button>
              <Button
                disabled={confirmMut.isPending}
                onClick={confirmarImportacion}
              >
                {confirmMut.isPending ? "Importando..." : `Confirmar importación (${validas.length})`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
