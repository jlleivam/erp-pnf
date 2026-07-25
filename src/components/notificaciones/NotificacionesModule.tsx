import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import {
  listMisNotificaciones, marcarNotificacionLeida, marcarTodasLeidas,
} from "@/lib/api/notificaciones.functions";

type Filter = "todas" | "no_leidas" | "leidas";

export function NotificacionesModule() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchList = useServerFn(listMisNotificaciones);
  const markOneFn = useServerFn(marcarNotificacionLeida);
  const markAllFn = useServerFn(marcarTodasLeidas);

  const [filter, setFilter] = useState<Filter>("todas");
  const [tipo, setTipo] = useState<string>("todos");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["notificaciones", "modulo"],
    queryFn: () => fetchList({ data: { limit: 100 } }),
    refetchInterval: 30_000,
  });

  const items = (q.data as any)?.items ?? [];
  const noLeidas = (q.data as any)?.noLeidas ?? 0;

  const tipos = useMemo(() => {
    const set = new Set<string>();
    for (const n of items) if (n.tipo) set.add(n.tipo);
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((n: any) => {
      if (filter === "no_leidas" && n.leida_at) return false;
      if (filter === "leidas" && !n.leida_at) return false;
      if (tipo !== "todos" && n.tipo !== tipo) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        const hay = `${n.titulo ?? ""} ${n.mensaje ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [items, filter, tipo, search]);

  const markOne = useMutation({
    mutationFn: (id: string) => markOneFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notificaciones"] });
      qc.invalidateQueries({ queryKey: ["notificaciones", "modulo"] });
    },
  });
  const markAll = useMutation({
    mutationFn: () => markAllFn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notificaciones"] });
      qc.invalidateQueries({ queryKey: ["notificaciones", "modulo"] });
    },
  });

  const handleOpen = (n: any) => {
    if (!n.leida_at) markOne.mutate(n.id);
    if (!n.link) return;
    const url = new URL(n.link, window.location.origin);
    const search = Object.fromEntries(url.searchParams.entries());
    navigate({ to: url.pathname as any, search: search as any });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Bell className="size-6" /> Notificaciones
            {noLeidas > 0 && (
              <Badge className="bg-rose-500 text-white border-0">{noLeidas} nuevas</Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Historial completo de notificaciones de tu cuenta.
          </p>
        </div>
        {noLeidas > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
          >
            <CheckCheck className="size-4" /> Marcar todas como leídas
          </Button>
        )}
      </header>

      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="todas">Todas</TabsTrigger>
              <TabsTrigger value="no_leidas">
                No leídas{noLeidas > 0 ? ` (${noLeidas})` : ""}
              </TabsTrigger>
              <TabsTrigger value="leidas">Leídas</TabsTrigger>
            </TabsList>
          </Tabs>

          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              {tipos.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar en título o mensaje…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {q.isLoading ? (
          <p className="p-8 text-sm text-muted-foreground text-center">Cargando…</p>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Bell className="size-8 mx-auto text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Sin notificaciones para mostrar</p>
          </div>
        ) : (
          <ul className="divide-y rounded-md border">
            {filtered.map((n: any) => (
              <li
                key={n.id}
                className={`px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                  !n.leida_at ? "bg-blue-50/40" : ""
                }`}
                onClick={() => handleOpen(n)}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1.5 size-2 rounded-full shrink-0 ${
                      !n.leida_at ? "bg-blue-500" : "bg-transparent"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm truncate ${!n.leida_at ? "font-semibold" : "font-medium"}`}>
                        {n.titulo}
                      </p>
                      {n.tipo && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {n.tipo}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.mensaje}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDateTime(n.created_at)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
