"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Order } from "@/data/mock";
import { formatDate, formatNumber } from "@/lib/utils";
import { getRecipeByOrderId } from "@/lib/recipe-store";
import { getAllOrders } from "@/lib/order-store";
import { ShipOutDialog } from "@/components/orders/ship-out-dialog";
import { useAuth } from "@/lib/auth/auth-context";
import { ifAllowed } from "@/lib/api-client";
import {
  Clock,
  Package,
  Search,
  ShoppingCart,
  Truck,
} from "lucide-react";

const statusMap = {
  pending: { label: "Bekliyor", variant: "warning" as const },
  confirmed: { label: "Onaylandı", variant: "info" as const },
  picking: { label: "Toplanıyor", variant: "info" as const },
  shipped: { label: "Sevk Edildi", variant: "success" as const },
  delivered: { label: "Teslim Edildi", variant: "success" as const },
  cancelled: { label: "İptal", variant: "danger" as const },
};

const priorityMap = {
  normal: { label: "Normal", variant: "secondary" as const },
  high: { label: "Yüksek", variant: "warning" as const },
  urgent: { label: "Acil", variant: "danger" as const },
};

function isReadyToShip(status: Order["status"]) {
  return status === "pending" || status === "confirmed" || status === "picking";
}

function OrdersPageContent() {
  const router = useRouter();
  const { user, canRead, canWrite } = useAuth();
  const canShip = Boolean(user && canWrite("orders"));

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [recipeOrderIds, setRecipeOrderIds] = useState<Set<string>>(new Set());
  const [orders, setOrders] = useState<Order[]>([]);
  const [shipOpen, setShipOpen] = useState(false);
  const [shipTarget, setShipTarget] = useState<Order | null>(null);

  const refresh = async () => {
    const list = await getAllOrders();
    setOrders(list);
    const ids = new Set<string>();
    if (canRead("recipes")) {
      await Promise.all(
        list.map(async (o) => {
          const recipe = await ifAllowed(true, () => getRecipeByOrderId(o.id), undefined);
          if (recipe) ids.add(o.id);
        })
      );
    }
    setRecipeOrderIds(ids);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = orders.filter((order) => {
    const q = search.toLowerCase();
    const matchesSearch =
      order.orderNo.toLowerCase().includes(q) ||
      order.customer.toLowerCase().includes(q) ||
      order.product.toLowerCase().includes(q) ||
      (order.batchNo ?? "").toLowerCase().includes(q) ||
      (order.destination ?? "").toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "ready"
        ? isReadyToShip(order.status)
        : order.status === statusFilter);
    return matchesSearch && matchesStatus;
  });

  const totalValue = orders.reduce((s, o) => s + o.value, 0);
  const readyCount = orders.filter((o) => isReadyToShip(o.status)).length;

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Lojistik"
        badgeClassName="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
        title="Sevkiyat"
        description="Mamul stoğundan müşteriye sevk başlatın. KK'dan geçen partiler de burada listelenir."
        actions={
          canShip ? (
            <Button
              className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
              onClick={() => {
                setShipTarget(null);
                setShipOpen(true);
              }}
            >
              <Truck className="w-4 h-4 mr-2" />
              Yeni sevk başlat
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Toplam Sipariş", value: orders.length, icon: ShoppingCart },
          { label: "Sevke hazır", value: readyCount, icon: Clock },
          { label: "Sevk Edilen", value: orders.filter((o) => o.status === "shipped").length, icon: Truck },
          { label: "Toplam Değer", value: `₺${formatNumber(totalValue)}`, icon: Package },
        ].map((stat) => (
          <Card key={stat.label} className="glass-card border-none">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10">
                <stat.icon className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {stat.label}
                </p>
                <p className="text-2xl font-black">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-card border-none">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Sipariş no, parti, müşteri veya ürün ara..."
                className="pl-10 rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="all">Tümü</TabsTrigger>
                <TabsTrigger value="ready">Sevke hazır</TabsTrigger>
                <TabsTrigger value="pending">Bekliyor</TabsTrigger>
                <TabsTrigger value="confirmed">Onaylı</TabsTrigger>
                <TabsTrigger value="picking">Toplanıyor</TabsTrigger>
                <TabsTrigger value="shipped">Sevk</TabsTrigger>
                <TabsTrigger value="delivered">Teslim</TabsTrigger>
                <TabsTrigger value="cancelled">İptal</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sipariş No</TableHead>
                <TableHead>Parti</TableHead>
                <TableHead>Müşteri Adı</TableHead>
                <TableHead>Teslimat yeri</TableHead>
                <TableHead>Ürün Adı</TableHead>
                <TableHead>Miktar</TableHead>
                <TableHead>Öncelik</TableHead>
                <TableHead>Reçete No</TableHead>
                <TableHead>Durumu</TableHead>
                <TableHead>Teslim Tarihi</TableHead>
                <TableHead className="text-right">Tutar (₺)</TableHead>
                {canShip ? <TableHead className="text-right">İşlem</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order) => {
                const status = statusMap[order.status] ?? statusMap.pending;
                const priority = priorityMap[order.priority] ?? priorityMap.normal;
                return (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => router.push(`/orders/${order.id}`)}
                  >
                    <TableCell className="font-mono font-bold">
                      <Link
                        href={`/orders/${order.id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {order.orderNo}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {order.batchNo ?? "—"}
                    </TableCell>
                    <TableCell className="font-medium max-w-[180px] truncate">
                      {order.customer}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {order.destination ?? "—"}
                    </TableCell>
                    <TableCell>{order.product}</TableCell>
                    <TableCell>
                      {formatNumber(order.quantity)} {order.unit}
                    </TableCell>
                    <TableCell>
                      <Badge variant={priority.variant}>{priority.label}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {order.recipeNo || (recipeOrderIds.has(order.id) ? "Var" : "—")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(order.deliveryDate)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      ₺{formatNumber(order.value)}
                    </TableCell>
                    {canShip ? (
                      <TableCell className="text-right">
                        {isReadyToShip(order.status) ? (
                          <Button
                            size="sm"
                            className="rounded-lg"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShipTarget(order);
                              setShipOpen(true);
                            }}
                          >
                            Sevke çıkar
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filtered.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-40" />
              <p className="font-medium">Sipariş bulunamadı</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="pb-10" />

      <ShipOutDialog
        open={shipOpen}
        order={shipTarget}
        onOpenChange={(open) => {
          setShipOpen(open);
          if (!open) setShipTarget(null);
        }}
        onShipped={() => {
          setShipOpen(false);
          setShipTarget(null);
          void refresh();
        }}
      />
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="p-10 text-muted-foreground">Yükleniyor...</div>}>
      <OrdersPageContent />
    </Suspense>
  );
}
