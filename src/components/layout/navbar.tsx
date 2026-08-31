"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, Menu, Search, User } from "lucide-react";
import { sidebarSections } from "@/components/layout/sidebar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import { getAllOrders } from "@/lib/order-store";
import { getAllProductionBatches, getAllProductionLines } from "@/lib/production-store";
import { getAllLabExperiments, getAllLabSamples } from "@/lib/lab-store";
import { toDisplayStockItems } from "@/lib/stock-store";
import {
  getAllRawMaterialOrders,
  syncReplenishmentOrders,
} from "@/lib/raw-material-order-store";
import { getAllRecipes } from "@/lib/recipe-store";
import { getAllRawMaterials } from "@/lib/raw-material-store";
import { warehouses } from "@/data/warehouses";

type Notice = { id: string; title: string; detail: string; href: string };

function collectNotifications(): Notice[] {
  syncReplenishmentOrders();
  const notices: Notice[] = [];

  for (const o of getAllOrders()) {
    if (o.priority === "urgent" && o.status !== "delivered" && o.status !== "cancelled") {
      notices.push({
        id: `ord-${o.id}`,
        title: `Acil sipariş ${o.orderNo}`,
        detail: `${o.customer} — ${o.product}`,
        href: `/orders/${o.id}`,
      });
    }
  }

  for (const line of getAllProductionLines()) {
    if (line.status === "alert") {
      notices.push({
        id: `line-${line.id}`,
        title: `${line.name} uyarıda`,
        detail: line.product,
        href: "/factory?tab=lines",
      });
    }
  }

  for (const item of toDisplayStockItems()) {
    if (item.status === "critical" || item.status === "low") {
      notices.push({
        id: `stk-${item.id}`,
        title: item.status === "critical" ? `Kritik stok ${item.sku}` : `Düşük stok ${item.sku}`,
        detail: `${item.name} — ${item.warehouse}`,
        href: item.warehouseId ? `/warehouses/${item.warehouseId}` : "/stock",
      });
    }
  }

  for (const o of getAllRawMaterialOrders()) {
    if (o.status === "to_order") {
      notices.push({
        id: `rmo-${o.id}`,
        title: `Sipariş verilecek ${o.orderNo}`,
        detail: o.materialName,
        href: `/raw-material-orders/${o.id}`,
      });
    }
  }

  return notices.slice(0, 12);
}

function findSearchTarget(query: string): string | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const order = getAllOrders().find(
    (o) =>
      o.orderNo.toLowerCase().includes(q) ||
      o.customer.toLowerCase().includes(q) ||
      o.product.toLowerCase().includes(q)
  );
  if (order) return `/orders/${order.id}`;

  const rmo = getAllRawMaterialOrders().find(
    (o) =>
      o.orderNo.toLowerCase().includes(q) ||
      o.materialName.toLowerCase().includes(q) ||
      o.sku.toLowerCase().includes(q)
  );
  if (rmo) return `/raw-material-orders/${rmo.id}`;

  const stock = toDisplayStockItems().find(
    (i) =>
      i.sku.toLowerCase().includes(q) ||
      i.name.toLowerCase().includes(q) ||
      i.lotNo.toLowerCase().includes(q)
  );
  if (stock?.warehouseId) return `/warehouses/${stock.warehouseId}`;
  if (stock) return "/stock";

  const batch = getAllProductionBatches().find(
    (b) =>
      b.batchNo.toLowerCase().includes(q) ||
      b.product.toLowerCase().includes(q)
  );
  if (batch) return "/factory?tab=batches";

  const sample = getAllLabSamples().find(
    (s) =>
      s.sampleNo.toLowerCase().includes(q) ||
      s.product.toLowerCase().includes(q) ||
      s.batchNo.toLowerCase().includes(q)
  );
  if (sample) return "/rd-lab?tab=samples";

  const experiment = getAllLabExperiments().find(
    (e) =>
      e.code.toLowerCase().includes(q) ||
      e.title.toLowerCase().includes(q)
  );
  if (experiment) return "/rd-lab?tab=experiments";

  const recipe = getAllRecipes().find((r) =>
    r.productName.toLowerCase().includes(q)
  );
  if (recipe) return `/orders/${recipe.orderId}`;

  const material = getAllRawMaterials().find(
    (m) =>
      m.sku.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q)
  );
  if (material) return "/raw-materials";

  const warehouse = warehouses.find(
    (w) =>
      w.name.toLowerCase().includes(q) ||
      w.location.toLowerCase().includes(q)
  );
  if (warehouse) return `/warehouses/${warehouse.id}`;

  const line = getAllProductionLines().find(
    (l) =>
      l.name.toLowerCase().includes(q) ||
      l.product.toLowerCase().includes(q)
  );
  if (line) return "/factory";

  return null;
}

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNotices(collectNotifications());
  }, [pathname]);

  useEffect(() => {
    if (notifOpen) setNotices(collectNotifications());
  }, [notifOpen]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const href = findSearchTarget(search);
    if (!href) {
      toast.error("Eşleşen kayıt bulunamadı");
      return;
    }
    router.push(href);
    setSearch("");
  }

  return (
    <header className="h-20 border-b bg-background/95 backdrop-blur-md px-4 sm:px-10 flex items-center justify-between sticky top-0 z-40 shadow-sm">
      <button
        type="button"
        className="lg:hidden p-2.5 mr-2 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-500/5 rounded-2xl"
        onClick={() => setNavOpen(true)}
        aria-label="Menüyü aç"
      >
        <Menu className="w-5 h-5" />
      </button>
      <form
        onSubmit={submitSearch}
        className="relative flex-1 max-w-md min-w-0 mx-2"
      >
        <Input
          placeholder="Ürün, batch, sipariş veya numune ara..."
          className="pl-4 pr-12 rounded-2xl bg-muted/30 border-border/50 h-11"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          type="submit"
          aria-label="Ara"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-xl text-muted-foreground hover:text-indigo-600 hover:bg-indigo-500/10"
        >
          <Search className="w-4 h-4" />
        </button>
      </form>

      <div className="flex items-center gap-6 ml-auto">
        <button
          type="button"
          onClick={() => setNotifOpen(true)}
          className="p-2.5 text-muted-foreground hover:text-indigo-600 hover:bg-indigo-500/5 rounded-2xl relative transition-all active:scale-95 group"
        >
          <Bell className="w-5 h-5 group-hover:animate-bounce" />
          {notices.length > 0 && (
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-indigo-500 rounded-full border-2 border-background ring-2 ring-indigo-500/20 animate-pulse" />
          )}
        </button>

        <div className="h-8 w-px bg-border/40" />

        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none">
            <div className="flex items-center gap-3.5 hover:bg-muted/80 p-1.5 pr-3 rounded-2xl transition-all cursor-pointer border border-transparent hover:border-border/40 hover:shadow-sm">
              <Avatar className="h-9 w-9 border-2 border-primary/10">
                <AvatarFallback>AY</AvatarFallback>
              </Avatar>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-bold leading-none">Ayşe Yılmaz</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-bold opacity-70">
                  Üretim Müdürü
                </p>
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-2">
            <DropdownMenuLabel>Hesap</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                setTimeout(() => setProfileOpen(true), 0);
              }}
            >
              <User className="w-4 h-4 mr-2" />
              Profil Ayarları
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                setTimeout(() => setNotifOpen(true), 0);
              }}
            >
              <Bell className="w-4 h-4 mr-2" />
              Bildirimler
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-72 p-0 gap-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle>HamdPharma</SheetTitle>
          </SheetHeader>
          <nav className="p-4 space-y-5 overflow-y-auto">
            {sidebarSections.map((section) => (
              <div key={section.title}>
                <p className="px-3 mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                  {section.title}
                </p>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/dashboard" &&
                        pathname.startsWith(item.href + "/"));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setNavOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium",
                          isActive
                            ? "bg-indigo-600 text-white"
                            : "text-muted-foreground hover:bg-indigo-500/5 hover:text-indigo-600"
                        )}
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      <FormSheet
        open={notifOpen}
        onOpenChange={setNotifOpen}
        title="Bildirimler"
        description="Acil siparişler, stok uyarıları ve bekleyen hammadde talepleri."
      >
        <FormSheetBody>
          {notices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Bekleyen bildirim yok.
            </p>
          ) : (
            <ul className="space-y-2">
              {notices.map((n) => (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    onClick={() => setNotifOpen(false)}
                    className="block rounded-xl border bg-muted/30 p-3 hover:bg-muted/60 transition-colors"
                  >
                    <p className="text-sm font-bold">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{n.detail}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </FormSheetBody>
        <FormSheetFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => setNotifOpen(false)}
          >
            Kapat
          </Button>
        </FormSheetFooter>
      </FormSheet>

      <FormSheet
        open={profileOpen}
        onOpenChange={setProfileOpen}
        title="Profil"
        description="Oturum açmış kullanıcı bilgileri."
      >
        <FormSheetBody>
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Ad Soyad
              </p>
              <p className="font-bold mt-1">Ayşe Yılmaz</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Rol
              </p>
              <p className="font-bold mt-1">Üretim Müdürü</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Tesis
              </p>
              <p className="font-bold mt-1">HamdPharma GMP</p>
            </div>
            <p className="text-xs text-muted-foreground rounded-xl bg-muted/40 p-3">
              Demo oturumu — profil alanları salt okunur.
            </p>
          </div>
        </FormSheetBody>
        <FormSheetFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => setProfileOpen(false)}
          >
            Kapat
          </Button>
        </FormSheetFooter>
      </FormSheet>
    </header>
  );
}
