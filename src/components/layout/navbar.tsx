"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  Factory,
  KeyRound,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingCart,
  User,
} from "lucide-react";
import { useSidebarSections } from "@/components/layout/sidebar";
import {
  ChangePasswordDialog,
  ProfileDialog,
} from "@/components/layout/account-dialogs";
import { useAuth } from "@/lib/auth/auth-context";
import { ifAllowed } from "@/lib/api-client";
import type { Resource } from "@/lib/auth/permissions";
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
import { getAllOrders } from "@/lib/order-store";
import { getAllProductionBatches, getAllProductionLines } from "@/lib/production-store";
import { getAllLabExperiments, getAllLabSamples } from "@/lib/lab-store";
import { getAllWarehouseStockItems, toDisplayStockItems } from "@/lib/stock-store";
import {
  getAllRawMaterialOrders,
  syncReplenishmentOrders,
} from "@/lib/raw-material-order-store";
import { getAllRecipes } from "@/lib/recipe-store";
import { getAllRawMaterials } from "@/lib/raw-material-store";
import { getWarehouses } from "@/lib/warehouse-store";
import {
  loadReadNoticeIds,
  saveReadNoticeIds,
} from "@/lib/notification-reads";

type Notice = { id: string; title: string; detail: string; href: string };

function noticeIcon(id: string) {
  if (id.startsWith("ord-")) return ShoppingCart;
  if (id.startsWith("line-")) return Factory;
  if (id.startsWith("stk-")) return Package;
  if (id.startsWith("rmo-")) return AlertTriangle;
  return Bell;
}

type CanRead = (resource: Resource) => boolean;

async function collectNotifications(
  canRead: CanRead,
  canWrite: CanRead
): Promise<Notice[]> {
  if (canWrite("raw_material_orders")) {
    await ifAllowed(true, () => syncReplenishmentOrders(), []);
  }
  const [orders, lines, warehouseItems, rawMaterialOrders] = await Promise.all([
    ifAllowed(canRead("orders"), () => getAllOrders(), []),
    ifAllowed(canRead("factory"), () => getAllProductionLines(), []),
    ifAllowed(canRead("stock"), () => getAllWarehouseStockItems(), []),
    ifAllowed(canRead("raw_material_orders"), () => getAllRawMaterialOrders(), []),
  ]);
  const stockItems = toDisplayStockItems(warehouseItems);
  const notices: Notice[] = [];

  for (const o of orders) {
    if (o.priority === "urgent" && o.status !== "delivered" && o.status !== "cancelled") {
      notices.push({
        id: `ord-${o.id}`,
        title: `Acil sipariş ${o.orderNo}`,
        detail: `${o.customer} — ${o.product}`,
        href: `/orders/${o.id}`,
      });
    }
  }

  for (const line of lines) {
    if (line.status === "alert") {
      notices.push({
        id: `line-${line.id}`,
        title: `${line.name} uyarıda`,
        detail: line.product,
        href: "/factory?tab=lines",
      });
    }
  }

  for (const item of stockItems) {
    if (item.status === "critical" || item.status === "low") {
      notices.push({
        id: `stk-${item.id}-${item.status}`,
        title: item.status === "critical" ? `Kritik stok ${item.sku}` : `Düşük stok ${item.sku}`,
        detail: `${item.name} — ${item.warehouse}`,
        href: item.warehouseId ? `/warehouses/${item.warehouseId}` : "/stock",
      });
    }
  }

  for (const o of rawMaterialOrders) {
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

async function findSearchTarget(
  query: string,
  canRead: CanRead
): Promise<string | null> {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const [
    orders,
    rawMaterialOrders,
    warehouseItems,
    batches,
    samples,
    experiments,
    recipes,
    materials,
    lines,
    warehouses,
  ] = await Promise.all([
    ifAllowed(canRead("orders"), () => getAllOrders(), []),
    ifAllowed(canRead("raw_material_orders"), () => getAllRawMaterialOrders(), []),
    ifAllowed(canRead("stock"), () => getAllWarehouseStockItems(), []),
    ifAllowed(canRead("factory"), () => getAllProductionBatches(), []),
    ifAllowed(canRead("lab"), () => getAllLabSamples(), []),
    ifAllowed(canRead("lab"), () => getAllLabExperiments(), []),
    ifAllowed(canRead("recipes"), () => getAllRecipes(), []),
    ifAllowed(canRead("raw_materials"), () => getAllRawMaterials(), []),
    ifAllowed(canRead("factory"), () => getAllProductionLines(), []),
    ifAllowed(canRead("warehouses"), () => getWarehouses(), []),
  ]);
  const stock = toDisplayStockItems(warehouseItems);

  const order = orders.find(
    (o) =>
      o.orderNo.toLowerCase().includes(q) ||
      o.customer.toLowerCase().includes(q) ||
      o.product.toLowerCase().includes(q)
  );
  if (order) return `/orders/${order.id}`;

  const rmo = rawMaterialOrders.find(
    (o) =>
      o.orderNo.toLowerCase().includes(q) ||
      o.materialName.toLowerCase().includes(q) ||
      o.sku.toLowerCase().includes(q)
  );
  if (rmo) return `/raw-material-orders/${rmo.id}`;

  const stockHit = stock.find(
    (i) =>
      i.sku.toLowerCase().includes(q) ||
      i.name.toLowerCase().includes(q) ||
      i.lotNo.toLowerCase().includes(q)
  );
  if (stockHit?.warehouseId) return `/warehouses/${stockHit.warehouseId}`;
  if (stockHit) return "/stock";

  const batch = batches.find(
    (b) =>
      b.batchNo.toLowerCase().includes(q) ||
      b.product.toLowerCase().includes(q)
  );
  if (batch) return "/factory?tab=batches";

  const sample = samples.find(
    (s) =>
      s.sampleNo.toLowerCase().includes(q) ||
      s.product.toLowerCase().includes(q) ||
      s.batchNo.toLowerCase().includes(q)
  );
  if (sample) return "/rd-lab?tab=samples";

  const experiment = experiments.find(
    (e) =>
      e.code.toLowerCase().includes(q) ||
      e.title.toLowerCase().includes(q)
  );
  if (experiment) return "/rd-lab?tab=experiments";

  const recipe = recipes.find(
    (r) =>
      r.productName.toLowerCase().includes(q) ||
      (r.code ?? "").toLowerCase().includes(q)
  );
  if (recipe) return "/recipes";

  const material = materials.find(
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

  const line = lines.find(
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
  const { user, loading, logout, canRead, canWrite } = useAuth();
  const mobileSections = useSidebarSections();
  const [search, setSearch] = useState("");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const unreadNotices = notices.filter((n) => !readIds.has(n.id));

  const initials = user?.name
    ? user.name
        .split(/\s+/)
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "";

  useEffect(() => {
    if (!user?.userId) {
      setReadIds(new Set());
      return;
    }
    setReadIds(loadReadNoticeIds(user.userId));
  }, [user?.userId]);

  useEffect(() => {
    if (loading) return;
    void collectNotifications(canRead, canWrite).then(setNotices);
  }, [pathname, loading, user?.userId, canRead, canWrite]);

  useEffect(() => {
    if (!notifOpen || loading) return;
    void collectNotifications(canRead, canWrite).then(setNotices);
  }, [notifOpen, loading, canRead, canWrite]);

  function persistReadIds(next: Set<string>) {
    setReadIds(next);
    if (user?.userId) saveReadNoticeIds(user.userId, next);
  }

  function markNoticeRead(id: string) {
    const next = new Set(readIds);
    next.add(id);
    persistReadIds(next);
  }

  function markAllNoticesRead() {
    const next = new Set(readIds);
    for (const n of notices) next.add(n.id);
    persistReadIds(next);
  }

  async function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const href = await findSearchTarget(search, canRead);
    if (!href) {
      toast.error("Eşleşen kayıt bulunamadı");
      return;
    }
    router.push(href);
    setSearch("");
  }

  return (
    <header className="sticky top-0 z-40 flex h-20 w-full min-w-0 shrink-0 items-center justify-between border-b bg-background/95 px-4 shadow-sm backdrop-blur-md sm:px-10">
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
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger
            aria-label="Bildirimler"
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600 outline-none transition-all hover:bg-indigo-500/15 active:scale-95 data-[state=open]:bg-indigo-500/20"
          >
            <Bell className="h-5 w-5" />
            {unreadNotices.length > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-background" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={10}
            className="z-[80] w-[min(22rem,calc(100vw-2rem))] p-0"
          >
            <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
              <p className="text-sm font-bold">Bildirimler</p>
              {unreadNotices.length > 0 && (
                <button
                  type="button"
                  onClick={markAllNoticesRead}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:bg-indigo-500/10"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Tümünü okundu işaretle
                </button>
              )}
            </div>
            {unreadNotices.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                Bekleyen bildirim yok.
              </p>
            ) : (
              <div className="max-h-[min(22rem,70vh)] overflow-y-auto p-1.5">
                {unreadNotices.map((n) => {
                  const Icon = noticeIcon(n.id);
                  return (
                    <div
                      key={n.id}
                      className="flex items-start gap-0.5 rounded-xl hover:bg-muted/80"
                    >
                      <Link
                        href={n.href}
                        onClick={() => markNoticeRead(n.id)}
                        className="flex min-w-0 flex-1 items-start gap-3 rounded-xl px-2.5 py-2.5"
                      >
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-600">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold leading-snug">
                            {n.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {n.detail}
                          </span>
                        </span>
                      </Link>
                      <button
                        type="button"
                        title="Okundu olarak işaretle"
                        aria-label="Okundu olarak işaretle"
                        onClick={() => markNoticeRead(n.id)}
                        className="mt-1.5 mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-600"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-8 w-px bg-border/40" />

        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none">
            <div className="flex items-center gap-3.5 hover:bg-muted/80 p-1.5 pr-3 rounded-2xl transition-all cursor-pointer border border-transparent hover:border-border/40 hover:shadow-sm">
              <Avatar className="h-9 w-9 border-2 border-primary/10">
                <AvatarFallback>
                  {user ? initials : loading ? "" : "??"}
                </AvatarFallback>
              </Avatar>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-bold leading-none">
                  {user?.name ?? (loading ? "…" : "—")}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest font-bold opacity-70">
                  {user?.roleLabel ?? ""}
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
                setTimeout(() => setPasswordOpen(true), 0);
              }}
            >
              <KeyRound className="w-4 h-4 mr-2" />
              Şifre Değiştir
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                void logout();
              }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Çıkış Yap
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
            {mobileSections.map((section) => (
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

      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        user={user}
      />
      <ChangePasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        user={user}
      />
    </header>
  );
}
