import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  CATALOGO_ACCIONES,
  MODULOS_ORDEN,
  type PermRole,
} from "@/lib/permisos/catalogo";
import { listRolePermissions, setRolePermission } from "@/lib/api/permisos.functions";

const ROLES: PermRole[] = ["residente", "auxiliar", "administrativo", "supervisor"];
const ROLE_LABEL: Record<PermRole, string> = {
  residente: "Residente",
  auxiliar: "Auxiliar",
  administrativo: "Administrativo",
  supervisor: "Supervisor",
};

export function PermisosTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listRolePermissions);
  const setFn = useServerFn(setRolePermission);

  const q = useQuery({
    queryKey: ["role_permissions"],
    queryFn: () => listFn(),
  });

  const overrides = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const row of ((q.data as any)?.items ?? []) as Array<{ role: string; action_key: string; allowed: boolean }>) {
      map.set(`${row.role}::${row.action_key}`, row.allowed);
    }
    return map;
  }, [q.data]);

  const mut = useMutation({
    mutationFn: (input: { role: PermRole; action_key: string; allowed: boolean }) =>
      setFn({ data: input }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["role_permissions"] });
      const prev = qc.getQueryData<any>(["role_permissions"]);
      const items = [...(prev?.items ?? [])];
      const idx = items.findIndex((r) => r.role === input.role && r.action_key === input.action_key);
      if (idx >= 0) items[idx] = { ...items[idx], allowed: input.allowed };
      else items.push(input);
      qc.setQueryData(["role_permissions"], { items });
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(["role_permissions"], ctx.prev);
      toast.error("No se pudo guardar el permiso");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["role_permissions"] }),
  });

  const isChecked = (role: PermRole, action_key: string, def: boolean) => {
    const v = overrides.get(`${role}::${action_key}`);
    return v ?? def;
  };

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="size-4" />
        <AlertDescription>
          Los permisos configurados aquí aún no se aplican al sistema — estamos preparando la migración.
          Por ahora sirven para definir el modelo de acceso deseado.
        </AlertDescription>
      </Alert>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[280px]">Acción</TableHead>
              <TableHead className="text-center whitespace-nowrap">Director</TableHead>
              {ROLES.map((r) => (
                <TableHead key={r} className="text-center whitespace-nowrap">
                  {ROLE_LABEL[r]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {MODULOS_ORDEN.map((modulo) => (
              <>
                <TableRow key={`h-${modulo}`} className="bg-muted/50 hover:bg-muted/50">
                  <TableCell colSpan={2 + ROLES.length} className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                    {modulo}
                  </TableCell>
                </TableRow>
                {CATALOGO_ACCIONES.filter((a) => a.modulo === modulo).map((a) => (
                  <TableRow key={a.key}>
                    <TableCell>
                      <div className="text-sm">{a.label}</div>
                      {a.descripcion && (
                        <div className="text-xs text-muted-foreground">{a.descripcion}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox checked disabled aria-label="Director (siempre)" />
                    </TableCell>
                    {ROLES.map((r) => {
                      const checked = isChecked(r, a.key, a.defaults[r]);
                      return (
                        <TableCell key={r} className="text-center">
                          <Checkbox
                            checked={checked}
                            disabled={mut.isPending}
                            onCheckedChange={(v) =>
                              mut.mutate({ role: r, action_key: a.key, allowed: v === true })
                            }
                            aria-label={`${ROLE_LABEL[r]} — ${a.label}`}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
