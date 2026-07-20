import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listTeamMembers,
  inviteTeamMember,
  updateMemberRole,
  removeMember,
} from "@/lib/api/team.functions";
import { useEffectiveIsDirector, type AppRole } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "director", label: "Director" },
  { value: "residente", label: "Residente" },
  { value: "auxiliar", label: "Auxiliar" },
  { value: "administrativo", label: "Administrativo" },
  { value: "supervisor", label: "Supervisor" },
];

const roleLabel = (r: string) =>
  ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r;

type Member = {
  id: string;
  nombre_completo: string;
  email: string;
  roles: string[];
};

export function EquipoModule() {
  const director = useEffectiveIsDirector();

  const qc = useQueryClient();
  const fetchList = useServerFn(listTeamMembers);
  const listQ = useQuery({
    queryKey: ["team-members"],
    queryFn: () => fetchList(),
    enabled: director,
  });

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

  if (!director) {
    return <p className="text-sm text-destructive">Solo el Director puede gestionar el equipo.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Usuarios de la empresa y su rol. El Director crea cuentas y comparte la contraseña manualmente.
        </p>
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
              <TableHead>Rol</TableHead>
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
                    {m.roles.length === 0 ? (
                      <span className="text-xs text-muted-foreground">sin rol</span>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        {roleLabel(m.roles[0])}
                      </Badge>
                    )}
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
        <EditRoleDialog
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
              "{toRemove?.nombre_completo || toRemove?.email}" perderá acceso a esta empresa y su rol.
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
  const [role, setRole] = useState<AppRole>("residente");

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

  const submit = () => {
    if (!email.trim() || !nombre.trim()) return toast.error("Email y nombre requeridos");
    if (password.length < 8) return toast.error("Contraseña mínimo 8 caracteres");
    m.mutate({
      data: {
        email: email.trim(),
        nombre_completo: nombre.trim(),
        password,
        role,
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
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

function EditRoleDialog({
  member,
  onClose,
  onSaved,
}: {
  member: Member;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [role, setRole] = useState<AppRole>((member.roles[0] as AppRole) ?? "residente");
  const update = useServerFn(updateMemberRole);
  const m = useMutation({
    mutationFn: update,
    onSuccess: () => { toast.success("Rol actualizado"); onSaved(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar rol</DialogTitle>
          <DialogDescription>{member.nombre_completo || member.email}</DialogDescription>
        </DialogHeader>
        <div>
          <Label>Rol</Label>
          <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => m.mutate({ data: { user_id: member.id, role } })}
            disabled={m.isPending}
          >
            {m.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

