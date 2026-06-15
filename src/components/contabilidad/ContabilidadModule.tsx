import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ChevronRight, ExternalLink, Info } from "lucide-react";
import { formatMXN } from "@/lib/format";
import { getBalanceGeneral, getDetalleCuenta } from "@/lib/contabilidad/balance.functions";
import {
  GRUPO_LABELS,
  SUBGRUPO_LABELS,
  type GrupoContable,
} from "@/lib/contabilidad/catalogo";

type Saldo = {
  codigo: string;
  nombre: string;
  grupo: GrupoContable;
  subgrupo: string;
  descripcion: string;
  disponible: boolean;
  saldo: number;
  linkModulo?: string;
};

const EXPANDIBLES = new Set([
  "1100", "1110", "1120", "1210",
  "2100", "2110", "2120", "2130", "2150", "2160",
  "3100",
]);

export function ContabilidadModule() {
  const fetchBalance = useServerFn(getBalanceGeneral);
  const q = useQuery({
    queryKey: ["balance-general"],
    queryFn: () => fetchBalance(),
    staleTime: 30_000,
  });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contabilidad</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Balance General gerencial. Los saldos se derivan en vivo de las operaciones registradas.
          </p>
        </div>
        {q.data && (
          <p className="text-xs text-muted-foreground">
            Generado: {new Date(q.data.generadoEn).toLocaleString("es-MX")}
          </p>
        )}
      </header>

      {q.isLoading && <BalanceSkeleton />}
      {q.error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>No se pudo calcular el balance</AlertTitle>
          <AlertDescription>{(q.error as Error).message}</AlertDescription>
        </Alert>
      )}
      {q.data && <BalanceView data={q.data} />}
    </div>
  );
}

function BalanceView({ data }: { data: Awaited<ReturnType<typeof getBalanceGeneral>> }) {
  const grouped = useMemo(() => {
    const acc: Record<GrupoContable, Saldo[]> = { activo: [], pasivo: [], capital: [] };
    for (const s of data.saldos as Saldo[]) acc[s.grupo].push(s);
    return acc;
  }, [data.saldos]);

  const cuadre = data.totales.activo - (data.totales.pasivo + data.totales.capital);
  const cuadrado = Math.abs(cuadre) < 0.01;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <GrupoCard titulo="Activo" tono="success" total={data.totales.activo} saldos={grouped.activo} />
        <GrupoCard titulo="Pasivo" tono="warning" total={data.totales.pasivo} saldos={grouped.pasivo} />
        <GrupoCard titulo="Capital" tono="info" total={data.totales.capital} saldos={grouped.capital} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comprobación de cuadre</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Activo</span>
            <span className="font-mono">{formatMXN(data.totales.activo)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Pasivo + Capital</span>
            <span className="font-mono">{formatMXN(data.totales.pasivo + data.totales.capital)}</span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="font-medium">Diferencia</span>
            <span className={`font-mono font-medium ${cuadrado ? "text-emerald-600" : "text-amber-600"}`}>
              {formatMXN(cuadre)}
            </span>
          </div>
          {!cuadrado && (
            <p className="text-xs text-muted-foreground mt-2">
              El cuadre se ajusta automáticamente con el <em>Resultado del ejercicio</em>.
              Esta diferencia residual indica anticipos, obras en proceso o almacén aún no
              modelados en el balance.
            </p>
          )}
        </CardContent>
      </Card>

      <Alert>
        <Info className="size-4" />
        <AlertTitle>Categorías en fase futura</AlertTitle>
        <AlertDescription>
          Algunas categorías aparecen como <Badge variant="secondary">Pendiente</Badge> porque
          requieren modelar facturación a cliente, almacén valorizado o anticipos a
          proveedores/subcontratistas. Se irán habilitando en próximas fases.
        </AlertDescription>
      </Alert>
    </>
  );
}

function GrupoCard({
  titulo,
  tono,
  total,
  saldos,
}: {
  titulo: string;
  tono: "success" | "warning" | "info";
  total: number;
  saldos: Saldo[];
}) {
  const accent =
    tono === "success" ? "text-emerald-600" : tono === "warning" ? "text-amber-600" : "text-sky-600";

  const porSubgrupo = saldos.reduce<Record<string, Saldo[]>>((acc, s) => {
    (acc[s.subgrupo] ||= []).push(s);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-baseline justify-between">
          <CardTitle className="text-base">{titulo}</CardTitle>
          <span className={`text-lg font-semibold font-mono ${accent}`}>{formatMXN(total)}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {Object.entries(porSubgrupo).map(([sg, items]) => (
          <div key={sg} className="space-y-0.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              {SUBGRUPO_LABELS[sg as keyof typeof SUBGRUPO_LABELS] ?? sg}
            </p>
            {items.map((s) => (
              <SaldoRow key={s.codigo} s={s} />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SaldoRow({ s }: { s: Saldo }) {
  const [open, setOpen] = useState(false);
  const expandable = s.disponible && EXPANDIBLES.has(s.codigo);

  const fetchDetalle = useServerFn(getDetalleCuenta);
  const detalleQ = useQuery({
    queryKey: ["balance-detalle", s.codigo],
    queryFn: () => fetchDetalle({ data: { codigo: s.codigo } }),
    enabled: expandable && open,
    staleTime: 30_000,
  });

  const header = (
    <div className="flex items-center justify-between gap-2 py-1 px-1 -mx-1 rounded hover:bg-muted/50">
      <div className="flex items-center gap-2 min-w-0">
        {expandable ? (
          <ChevronRight
            className={`size-3.5 text-muted-foreground transition-transform shrink-0 ${
              open ? "rotate-90" : ""
            }`}
          />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <span className="text-xs text-muted-foreground tabular-nums">{s.codigo}</span>
        <span className={`truncate ${!s.disponible ? "text-muted-foreground" : ""}`} title={s.descripcion}>
          {s.nombre}
        </span>
        {!s.disponible && (
          <Badge variant="secondary" className="text-[10px] h-4">
            Pendiente
          </Badge>
        )}
        {s.linkModulo && s.disponible && (
          <Link
            to={s.linkModulo}
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-foreground"
            title="Ir al módulo"
          >
            <ExternalLink className="size-3" />
          </Link>
        )}
      </div>
      <span className={`font-mono tabular-nums ${!s.disponible ? "text-muted-foreground" : ""}`}>
        {formatMXN(s.saldo)}
      </span>
    </div>
  );

  if (!expandable) {
    return <div>{header}</div>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left"
        aria-expanded={open}
      >
        {header}
      </button>
      {open && (
        <div className="ml-6 mt-1 mb-2 space-y-1 border-l border-border pl-3">
          {detalleQ.isLoading && (
            <>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </>
          )}
          {detalleQ.error && (
            <p className="text-xs text-destructive">No se pudo cargar el desglose.</p>
          )}
          {detalleQ.data && detalleQ.data.items.length === 0 && (
            <p className="text-xs text-muted-foreground py-1">Sin movimientos abiertos.</p>
          )}
          {detalleQ.data?.items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-2 text-xs py-0.5">
              <div className="min-w-0">
                <p className="truncate">{item.etiqueta}</p>
                {item.referencia && (
                  <p className="text-[11px] text-muted-foreground truncate">{item.referencia}</p>
                )}
              </div>
              <span className="font-mono tabular-nums shrink-0">{formatMXN(item.saldo)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BalanceSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="space-y-2">
            {[0, 1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-4 w-full" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// avoid unused-import warning
void GRUPO_LABELS;
