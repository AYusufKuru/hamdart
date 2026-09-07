"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Factory,
  Package,
  Warehouse,
  ShoppingCart,
  FlaskConical,
  Pill,
  ClipboardList,
  Beaker,
  Truck,
  Users,
  Building2,
  Contact,
  FileSpreadsheet,
  BookOpen,
  Wallet,
  Boxes,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn, formatDate } from "@/lib/utils";
import type { Warehouse as WarehouseRow } from "@/data/warehouses";
import { getWarehouses } from "@/lib/warehouse-store";
import { useAuth } from "@/lib/auth/auth-context";
import { NAV_ITEMS, type Resource } from "@/lib/auth/permissions";

const ICONS: Record<Resource, LucideIcon> = {
  dashboard: LayoutDashboard,
  personnel: Users,
  factory: Factory,
  recipes: ClipboardList,
  raw_materials: Beaker,
  raw_material_orders: Truck,
  products: Boxes,
  stock: Package,
  warehouses: Warehouse,
  orders: ShoppingCart,
  customers: Contact,
  suppliers: Building2,
  invoices: FileSpreadsheet,
  ledger: BookOpen,
  budget: Wallet,
  admin: Shield,
  lab: FlaskConical,
};

export function useSidebarSections() {
  const { canRead } = useAuth();

  const sections: {
    title: string;
    items: { icon: LucideIcon; label: string; href: string }[];
  }[] = [];

  const titles = [...new Set(NAV_ITEMS.map((i) => i.title))];

  for (const title of titles) {
    const items = NAV_ITEMS.filter(
      (item) => item.title === title && canRead(item.resource)
    ).map((item) => ({
      icon: ICONS[item.resource],
      label: item.label,
      href: item.href,
    }));
    if (items.length > 0) {
      sections.push({ title, items });
    }
  }

  return sections;
}

/** @deprecated useSidebarSections kullanın */
export const sidebarSections = NAV_ITEMS.map((item) => ({
  title: item.title,
  items: [
    {
      icon: ICONS[item.resource],
      label: item.label,
      href: item.href,
    },
  ],
}));

export function Sidebar() {
  const pathname = usePathname();
  const sections = useSidebarSections();
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);

  useEffect(() => {
    void getWarehouses()
      .then(setWarehouses)
      .catch(() => setWarehouses([]));
  }, []);

  return (
    <div className="flex flex-col h-full bg-card/80 backdrop-blur-xl border-r w-64 pt-8 pb-6">
      <div className="px-8 mb-8 flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-500 shadow-lg shadow-indigo-500/20 rounded-xl flex items-center justify-center animate-float">
          <Pill className="text-white w-6 h-6" />
        </div>
        <div>
          <span className="text-xl font-bold tracking-tight block leading-tight text-foreground">
            HamdPharma
          </span>
          <span className="text-[10px] text-indigo-600/70 uppercase tracking-widest font-black font-mono">
            GMP Edition
          </span>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-5 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-4 mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
              {section.title}
            </p>
            <div className="space-y-1.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname.startsWith(item.href + "/"));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 relative",
                      isActive
                        ? "bg-gradient-to-r from-indigo-600/90 to-blue-500/90 text-white shadow-md shadow-indigo-500/10 scale-[1.02]"
                        : "text-muted-foreground hover:bg-indigo-500/5 hover:text-indigo-600 hover:translate-x-1"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "w-4 h-4 transition-transform group-hover:scale-110 shrink-0",
                        isActive
                          ? "text-white"
                          : "text-muted-foreground/70 group-hover:text-indigo-500"
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-white/40 rounded-r-full" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-6 pt-6 mt-4 border-t border-border/50">
        <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
            Depolar
          </p>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            {warehouses.length}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Son denetim:{" "}
            {formatDate(
              [...warehouses].sort((a, b) =>
                b.lastAudit.localeCompare(a.lastAudit)
              )[0]?.lastAudit ?? ""
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
