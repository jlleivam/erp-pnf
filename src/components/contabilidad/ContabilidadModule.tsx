import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ExternalLink, Info } from "lucide-react";
import { formatMXN } from "@/lib/format";
import { getBalanceGeneral } from "@/lib/contabilidad/balance.functions";
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
        <GrupoCard
          titulo="Activo"
          tono="success"
          total={data.totales.activo}
          saldos={grouped.activo}
        />
        <GrupoCard
          titulo="Pasivo"
          tono="warning"
          total={data.totales.pasivo}
          saldos={grouped.pasivo}
        />
        <GrupoCard
          titulo="Capital"
          tono="info"
          total={data.totales.capital}
          saldos={grouped.capital}
        />
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
            <span className="font-mono">
              {formatMXN(data.totales.pasivo + data.totales.capital)}
            </span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="font-medium">Diferencia</span>
            <span
              className={`font-mono font-medium ${
                cuadrado ? "text-emerald-600" : "text-amber-600"
              }`}
            >
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
    tono === "success"
      ? "text-emerald-600"
      : tono === "warning"
      ? "text-amber-600"
      : "text-sky-600";

  // Agrupar por subgrupo
  const porSubgrupo = saldos.reduce<Record<string, Saldo[]>>((acc, s) => {
    (acc[s.subgrupo] ||= []).push(s);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-baseline justify-between">
          <CardTitle className="text-base">{titulo}</CardTitle>
          <span className={`text-lg font-semibold font-mono ${accent}`}>
            {formatMXN(total)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {Object.entries(porSubgrupo).map(([sg, items]) => (
          <div key={sg} className="space-y-1.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
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
  const content = (
    <div className="flex items-center justify-between gap-2 py-1 group">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs text-muted-foreground tabular-nums">{s.codigo}</span>
        <span
          className={`truncate ${
            !s.disponible ? "text-muted-foreground" : ""
          }`}
          title={s.descripcion}
        >
          {s.nombre}
        </span>
        {!s.disponible && (
          <Badge variant="secondary" className="text-[10px] h-4">
            Pendiente
          </Badge>
        )}
        {s.linkModulo && s.disponible && (
          <ExternalLink className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
        )}
      </div>
      <span
        className={`font-mono tabular-nums ${
          !s.disponible ? "text-muted-foreground" : ""
        }`}
      >
        {formatMXN(s.saldo)}
      </span>
    </div>
  );

  if (s.linkModulo && s.disponible) {
    return (
      <Link to={s.linkModulo} className="block hover:bg-muted/50 rounded px-1 -mx-1">
        {content}
      </Link>
    );
  }
  return <div className="px-1 -mx-1">{content}</div>;
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
