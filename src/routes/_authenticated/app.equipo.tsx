import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listTeamMembers,
  inviteTeamMember,
  updateMemberRoles,
  removeMember,
} from "@/lib/api/team.functions";
import { useAuthStore, isDirector, type AppRole } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/equipo")({
  component: EquipoPage,
});

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "director", label: "Director" },
  { value: "residente", label: "Residente" },
  { value: "auxiliar", label: "Auxiliar" },
  { value: "administrativo", label: "Administrativo" },
  { value: "supervisor", label: "Supervisor" },
];

type Member = {
  id: string;
  nombre_completo: string;
  email: string;
  roles: string[];
};

function EquipoPage() {
  const { roles } = useAuthStore();
  if (!isDirector(roles)) {
    return <p className="text-sm text-destructive">Solo el Director puede gestionar el equipo.</p>;
  }

  const qc = useQueryClient();
  const fetchList = useServerFn(listTeamMembers);
  const listQ = useQuery({ queryKey: ["team-members"], queryFn: () => fetchList() });

  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [toRemove, setToRemove] = useState<Member | null>(null);

  const remove = useServerFn(removeMember);
  const removeM = useMutation({
    mutationFn: remove,
    onSuccess: () => {
      toast.success("Miembro removido");
      qc.invalidateQueries({ queryKey: ["team-members"] });
      setToRemove(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Equipo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Usuarios de la empresa y sus roles. El Director crea cuentas y comparte la contraseña manualmente.
          </p>
        </div>
        <Button onClick={() => setInviting(true)}>
          <Plus className="size-4 mr-1" /> Crear cuenta
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead className="w-32 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
            ) : (listQ.data ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-sm text-muted-foreground">Sin miembros aún.</TableCell></TableRow>
            ) : (
              (listQ.data ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.nombre_completo || "—"}</TableCell>
                  <TableCell className="text-sm">{m.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {m.roles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">sin rol</span>
                      ) : (
                        m.roles.map((r) => (
                          <Badge key={r} variant="secondary" className="text-xs">
                            {ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(m as Member)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setToRemove(m as Member)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {inviting && (
        <InviteDialog
          onClose={() => setInviting(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["team-members"] })}
        />
      )}

      {editing && (
        <EditRolesDialog
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["team-members"] })}
        />
      )}

      <AlertDialog open={!!toRemove} onOpenChange={(o) => !o && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Remover de la empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              "{toRemove?.nombre_completo || toRemove?.email}" perderá acceso a esta empresa y todos sus roles.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toRemove && removeM.mutate({ data: { user_id: toRemove.id } })}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InviteDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>(["residente"]);

  const invite = useServerFn(inviteTeamMember);
  const m = useMutation({
    mutationFn: invite,
    onSuccess: () => {
      toast.success("Cuenta creada. Comparte la contraseña manualmente.");
      onCreated();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (r: AppRole) => {
    setSelectedRoles((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  };

  const submit = () => {
    if (!email.trim() || !nombre.trim()) return toast.error("Email y nombre requeridos");
    if (password.length < 8) return toast.error("Contraseña mínimo 8 caracteres");
    if (selectedRoles.length === 0) return toast.error("Selecciona al menos un rol");
    m.mutate({
      data: {
        email: email.trim(),
        nombre_completo: nombre.trim(),
        password,
        roles: selectedRoles,
      },
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear cuenta de usuario</DialogTitle>
          <DialogDescription>
            La cuenta se activa de inmediato. Comparte la contraseña con el usuario por un canal seguro.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nombre completo</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Contraseña temporal</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
            <p className="text-xs text-muted-foreground mt-1">
              No se enviará correo. Cópiala y compártela manualmente.
            </p>
          </div>
          <div>
            <Label>Roles</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {ROLE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedRoles.includes(opt.value)}
                    onCheckedChange={() => toggle(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={m.isPending}>
            {m.isPending ? "Creando…" : "Crear cuenta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditRolesDialog({
  member,
  onClose,
  onSaved,
}: {
  member: Member;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>(member.roles as AppRole[]);
  const update = useServerFn(updateMemberRoles);
  const m = useMutation({
    mutationFn: update,
    onSuccess: () => { toast.success("Roles actualizados"); onSaved(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (r: AppRole) => {
    setSelectedRoles((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar roles</DialogTitle>
          <DialogDescription>{member.nombre_completo || member.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {ROLE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selectedRoles.includes(opt.value)}
                onCheckedChange={() => toggle(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => {
              if (selectedRoles.length === 0) return toast.error("Selecciona al menos un rol");
              m.mutate({ data: { user_id: member.id, roles: selectedRoles } });
            }}
            disabled={m.isPending}
          >
            {m.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
