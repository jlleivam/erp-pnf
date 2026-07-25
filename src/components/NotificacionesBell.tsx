import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTime } from "@/lib/format";
import {
  listMisNotificaciones, marcarNotificacionLeida, marcarTodasLeidas,
} from "@/lib/api/notificaciones.functions";

export function NotificacionesBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchList = useServerFn(listMisNotificaciones);
  const markOneFn = useServerFn(marcarNotificacionLeida);
  const markAllFn = useServerFn(marcarTodasLeidas);

  const q = useQuery({
    queryKey: ["notificaciones"],
    queryFn: () => fetchList({ data: { limit: 30 } }),
    refetchInterval: 30_000,
  });

  const items = (q.data as any)?.items ?? [];
  const noLeidas = (q.data as any)?.noLeidas ?? 0;

  const markOne = useMutation({
    mutationFn: (id: string) => markOneFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificaciones"] }),
  });
  const markAll = useMutation({
    mutationFn: () => markAllFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificaciones"] }),
  });

  const handleOpen = (n: any) => {
    if (!n.leida_at) markOne.mutate(n.id);
    if (!n.link) return;
    const url = new URL(n.link, window.location.origin);
    const search = Object.fromEntries(url.searchParams.entries());
    navigate({ to: url.pathname as any, search: search as any });
  };


  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificaciones">
          <Bell className="size-5" />
          {noLeidas > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] bg-rose-500 text-white border-0 rounded-full grid place-items-center">
              {noLeidas > 9 ? "9+" : noLeidas}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <button
            type="button"
            className="text-sm font-semibold hover:underline"
            onClick={() => navigate({ to: "/app/notificaciones" })}
          >
            Notificaciones
          </button>
          {noLeidas > 0 && (
            <Button
              variant="ghost" size="sm" className="h-7 gap-1 text-xs"
              onClick={() => markAll.mutate()} disabled={markAll.isPending}
            >
              <CheckCheck className="size-3" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">Sin notificaciones</p>
          ) : (
            <ul className="divide-y">
              {items.map((n: any) => (
                <li
                  key={n.id}
                  className={`px-3 py-2 cursor-pointer hover:bg-muted/50 ${!n.leida_at ? "bg-blue-50/50" : ""}`}
                  onClick={() => handleOpen(n)}
                >
                  <div className="flex items-start gap-2">
                    {!n.leida_at && <span className="mt-1.5 size-2 rounded-full bg-blue-500 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{n.titulo}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.mensaje}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(n.created_at)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t px-3 py-2">
          <button
            type="button"
            className="w-full text-xs text-center text-muted-foreground hover:text-foreground"
            onClick={() => navigate({ to: "/app/notificaciones" })}
          >
            Ver todas las notificaciones
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
