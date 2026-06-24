import {
  FileText,
  Wallet,
  Scale,
  Banknote,
  Warehouse,
  Receipt,
  Users,
  Hammer,
  Handshake,
  Truck,
  Fuel,
  Coins,
  CalendarRange,
  ListTodo,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";

export type ModuleEntry = {
  to: string;
  label: string;
  icon: LucideIcon;
  ready?: boolean;
};

export const ADMIN_MODULES: ModuleEntry[] = [
  { to: "/app/admin/requisiciones", label: "Requisiciones", icon: ClipboardList },
  { to: "/app/admin/cuentas-por-pagar", label: "Cuentas por pagar", icon: FileText },
  { to: "/app/admin/tesoreria", label: "Tesorería", icon: Wallet },
  { to: "/app/admin/contabilidad", label: "Contabilidad", icon: Scale },
  { to: "/app/admin/condensado-semanal", label: "Condensado semanal", icon: CalendarRange },
  { to: "/app/admin/almacen-central", label: "Almacén central", icon: Warehouse },
  { to: "/app/admin/gastos-oficina", label: "Gastos de oficina", icon: Receipt },
  { to: "/app/admin/nomina", label: "Nómina", icon: Users },
  { to: "/app/admin/destajos", label: "Destajos", icon: Hammer },
  { to: "/app/admin/subcontratos", label: "Subcontratos", icon: Handshake },
  { to: "/app/admin/rentas", label: "Rentas", icon: Truck },
  { to: "/app/admin/gasolinas", label: "Gasolinas", icon: Fuel },
  { to: "/app/admin/caja-chica", label: "Caja chica", icon: Coins },
  
  { to: "/app/admin/tareas", label: "Tareas", icon: ListTodo },
];

export const CONFIG_MODULES: ModuleEntry[] = [
  { to: "/app/configuracion", label: "Facturación", icon: FileText },
  { to: "/app/equipo", label: "Equipo", icon: Users, ready: true },
  { to: "/app/configuracion", label: "Otras", icon: Banknote },
];
