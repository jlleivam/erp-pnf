import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listClientes,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
} from "@/lib/api/clientes.functions";
import { useAuthStore, isDirector } from "@/stores/auth";
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

export const Route = createFileRoute("/_authenticated/app/clientes")({
  component: ClientesPage,
});

type Cliente = {
  id: string;
  razon_social: string;
  rfc: string;
  tipo_persona: "moral" | "fisica";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  datos_contacto: any;
};

function ClientesPage() {
  const { roles } = useAuthStore();
  const canEdit = isDirector(roles);
  const qc = useQueryClient();

  const fetchList = useServerFn(listClientes);
  const listQ = useQuery({ queryKey: ["clientes"], queryFn: () => fetchList() });

  const [editing, setEditing] = useState<Cliente | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Cliente | null>(null);

  const eliminar = useServerFn(eliminarCliente);
  const delM = useMutation({
    mutationFn: eliminar,
    onSuccess: () => {
      toast.success("Cliente eliminado");
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Empresas y personas a las que facturas tus obras.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4 mr-1" /> Nuevo cliente
          </Button>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Razón social</TableHead>
              <TableHead>RFC</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Contacto</TableHead>
              {canEdit && <TableHead className="w-32 text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQ.isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
            ) : (listQ.data ?? []).length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground">Sin clientes aún.</TableCell></TableRow>
            ) : (
              (listQ.data ?? []).map((c) => {
                const dc = (c.datos_contacto ?? {}) as Record<string, string>;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.razon_social}</TableCell>
                    <TableCell className="font-mono text-xs">{c.rfc}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {c.tipo_persona === "moral" ? "Moral" : "Física"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {dc.nombre_contacto || dc.email || dc.telefono || "—"}
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(c as Cliente)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setToDelete(c as Cliente)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {(creating || editing) && (
        <ClienteFormDialog
          open
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["clientes"] })}
        />
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{toDelete?.razon_social}". Las obras vinculadas quedarán sin cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && delM.mutate({ data: { id: toDelete.id } })}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClienteFormDialog({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: Cliente | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const dc = (initial?.datos_contacto ?? {}) as Record<string, string>;

  const [tipoPersona, setTipoPersona] = useState<"moral" | "fisica">(initial?.tipo_persona ?? "moral");
  const [razonSocial, setRazonSocial] = useState(initial?.razon_social ?? "");
  const [rfc, setRfc] = useState(initial?.rfc ?? "");
  const [nombreContacto, setNombreContacto] = useState(dc.nombre_contacto ?? "");
  const [email, setEmail] = useState(dc.email ?? "");
  const [telefono, setTelefono] = useState(dc.telefono ?? "");

  const create = useServerFn(crearCliente);
  const update = useServerFn(actualizarCliente);
  const createM = useMutation({
    mutationFn: create,
    onSuccess: () => { toast.success("Cliente creado"); onSaved(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateM = useMutation({
    mutationFn: update,
    onSuccess: () => { toast.success("Cliente actualizado"); onSaved(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = () => {
    if (!razonSocial.trim()) return toast.error("Razón social requerida");
    if (rfc.trim().length < 12) return toast.error("RFC inválido");
    const payload = {
      tipo_persona: tipoPersona,
      razon_social: razonSocial.trim(),
      rfc: rfc.trim(),
      datos_contacto: {
        nombre_contacto: nombreContacto.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
      },
    };
    if (isEdit && initial) {
      updateM.mutate({ data: { ...payload, id: initial.id } });
    } else {
      createM.mutate({ data: payload });
    }
  };

  const pending = createM.isPending || updateM.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo de persona</Label>
            <Select value={tipoPersona} onValueChange={(v) => setTipoPersona(v as "moral" | "fisica")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="moral">Persona moral</SelectItem>
                <SelectItem value="fisica">Persona física</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Razón social</Label>
            <Input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} />
          </div>
          <div>
            <Label>RFC</Label>
            <Input value={rfc} onChange={(e) => setRfc(e.target.value.toUpperCase())} />
          </div>
          <div className="border-t pt-4 space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Contacto</p>
            <div>
              <Label>Nombre del contacto</Label>
              <Input value={nombreContacto} onChange={(e) => setNombreContacto(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
