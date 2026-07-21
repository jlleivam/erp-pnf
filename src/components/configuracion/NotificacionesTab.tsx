import { Fragment, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  CATALOGO_NOTIFICACIONES,
  MODULOS_NOTIF_ORDEN,
  type NotifRole,
} from "@/lib/notificaciones/catalogo";
import {
  listNotificacionPreferencias,
  setNotificacionPreferencia,
} from "@/lib/api/notificaciones-prefs.functions";

const ROLES: NotifRole[] = ["director", "residente", "auxiliar", "administrativo", "supervisor"];
const ROLE_LABEL: Record<NotifRole, string> = {
  director: "Director",
  residente: "Residente",
  auxiliar: "Auxiliar",
  administrativo: "Administrativo",
  supervisor: "Supervisor",
};

export function NotificacionesTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listNotificacionPreferencias);
  const setFn = useServerFn(setNotificacionPreferencia);

  const q = useQuery({
    queryKey: ["notificacion_preferencias"],
    queryFn: () => listFn(),
  });

  const overrides = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const row of ((q.data as any)?.items ?? []) as Array<{
      role: string;
      tipo: string;
      habilitado: boolean;
    }>) {
      map.set(`${row.role}::${row.tipo}`, row.habilitado);
    }
    return map;
  }, [q.data]);

  const mut = useMutation({
    mutationFn: (input: { role: NotifRole; tipo: string; habilitado: boolean }) =>
      setFn({ data: input }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["notificacion_preferencias"] });
      const prev = qc.getQueryData<any>(["notificacion_preferencias"]);
      const items = [...(prev?.items ?? [])];
      const idx = items.findIndex((r) => r.role === input.role && r.tipo === input.tipo);
      if (idx >= 0) items[idx] = { ...items[idx], habilitado: input.habilitado };
      else items.push(input);
      qc.setQueryData(["notificacion_preferencias"], { items });
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(["notificacion_preferencias"], ctx.prev);
      toast.error("No se pudo guardar la preferencia");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacion_preferencias"] }),
  });

  const isChecked = (role: NotifRole, tipo: string, def: boolean) => {
    const v = overrides.get(`${role}::${tipo}`);
    return v ?? def;
  };

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="size-4" />
        <AlertDescription>
          Las preferencias se guardan pero aún no aplican a todas las notificaciones existentes;
          se irán conectando progresivamente.
        </AlertDescription>
      </Alert>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[280px]">Notificación</TableHead>
              {ROLES.map((r) => (
                <TableHead key={r} className="text-center whitespace-nowrap">
                  {ROLE_LABEL[r]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {MODULOS_NOTIF_ORDEN.map((modulo) => (
              <Fragment key={modulo}>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableCell
                    colSpan={1 + ROLES.length}
                    className="font-semibold text-xs uppercase tracking-wide text-muted-foreground"
                  >
                    {modulo}
                  </TableCell>
                </TableRow>
                {CATALOGO_NOTIFICACIONES.filter((n) => n.modulo === modulo).map((n) => (
                  <TableRow key={n.key}>
                    <TableCell>
                      <div className="text-sm">{n.label}</div>
                      {n.descripcion && (
                        <div className="text-xs text-muted-foreground">{n.descripcion}</div>
                      )}
                    </TableCell>
                    {ROLES.map((r) => {
                      const checked = isChecked(r, n.key, n.defaults[r]);
                      return (
                        <TableCell key={r} className="text-center">
                          <Checkbox
                            checked={checked}
                            disabled={mut.isPending}
                            onCheckedChange={(v) =>
                              mut.mutate({ role: r, tipo: n.key, habilitado: v === true })
                            }
                            aria-label={`${ROLE_LABEL[r]} — ${n.label}`}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
