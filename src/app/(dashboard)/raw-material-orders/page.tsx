"use client";

import { useCallback, useEffect, useState } from "react";
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
import {
  rawMaterialOrderStatusConfig,
  rawMaterialOrderSourceLabels,
  seedRawMaterialOrders,
  type RawMaterialOrder,
  type RawMaterialOrderStatus,
} from "@/data/raw-material-orders";
import { syncReplenishmentOrders } from "@/lib/raw-material-order-store";
import { RawMaterialOrderFormSheet } from "@/components/raw-material-orders/raw-material-order-form-sheet";
import { formatNumber } from "@/lib/utils";
import {
  AlertCircle,
  Factory,
  Package,
  Plus,
  Search,
  Truck,
  Warehouse,
} from "lucide-react";

function loadOrders() {
  return syncReplenishmentOrders();
}

export default function RawMaterialOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<RawMaterialOrder[]>(seedRawMaterialOrders);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);

  const refresh = useCallback(() => {
    setOrders(loadOrders());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      o.materialName.toLowerCase().includes(q) ||
      o.orderNo.toLowerCase().includes(q) ||
      o.supplier.toLowerCase().includes(q) ||
      o.sku.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const toOrderCount = orders.filter((o) => o.status === "to_order").length;

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Tedarik"
        badgeClassName="bg-amber-500/10 text-amber-700 border-amber-500/20"
        title="Hammadde Siparişleri"
        description="Sipariş Verilecek kayıtları üç kaynaktan listeye düşer: stok uyarısı, üretim ihtiyacı veya manuel talep."
        actions={
          <Button
            className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
            onClick={() => setFormOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Manuel Talep
          </Button>
        }
      />

      <Card className="glass-card border-none border-l-4 border-l-amber-500">
        <CardContent className="p-5">
          <p className="text-sm font-bold flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            Sipariş Verilecek — kayıt nereden gelir?
          </p>
          <ul className="grid gap-3 md:grid-cols-3 text-sm">
            <li className="flex gap-3 p-3 rounded-xl bg-muted/40">
              <Warehouse className="w-5 h-5 text-rose-500 shrink-0" />
              <div>
                <p className="font-bold">Stok uyarısı</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Üretim malzemeleri deposunda miktar minimumun altına düşünce
                  otomatik buraya eklenir (sayfa açılışında kontrol).
                </p>
              </div>
            </li>
            <li className="flex gap-3 p-3 rounded-xl bg-muted/40">
              <Factory className="w-5 h-5 text-indigo-500 shrink-0" />
              <div>
                <p className="font-bold">Üretim / plan ihtiyacı</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Yeni ürün veya reçete için gereken hammadde (ör. Sarı
                  Kantaron) planlama tarafından talep edilir.
                </p>
              </div>
            </li>
            <li className="flex gap-3 p-3 rounded-xl bg-muted/40">
              <Package className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <p className="font-bold">Manuel talep</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Satın alma ekibi &quot;Manuel Talep&quot; ile doğrudan kayıt
                  açar.
                </p>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Toplam", value: orders.length },
          { label: "Sipariş Verilecek", value: toOrderCount },
          {
            label: "Stok Uyarısından",
            value: orders.filter(
              (o) => o.status === "to_order" && o.source === "low_stock"
            ).length,
          },
          {
            label: "Üretim İhtiyacı",
            value: orders.filter(
              (o) => o.status === "to_order" && o.source === "production_need"
            ).length,
          },
        ].map((s) => (
          <Card key={s.label} className="glass-card border-none">
            <CardContent className="p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {s.label}
              </p>
              <p className="text-3xl font-black mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-card border-none">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Malzeme, sipariş no, tedarikçi ara..."
                className="pl-10 rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="all">Tümü</TabsTrigger>
                {(Object.keys(
                  rawMaterialOrderStatusConfig
                ) as RawMaterialOrderStatus[]).map((st) => (
                  <TabsTrigger key={st} value={st} className="text-xs">
                    {rawMaterialOrderStatusConfig[st].label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sipariş No</TableHead>
                <TableHead>Hammadde</TableHead>
                <TableHead>Kaynak</TableHead>
                <TableHead>Tedarikçi</TableHead>
                <TableHead>Miktar</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">Tutar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order) => {
                const st =
                  rawMaterialOrderStatusConfig[order.status] ??
                  rawMaterialOrderStatusConfig.to_order;
                return (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => router.push(`/raw-material-orders/${order.id}`)}
                  >
                    <TableCell className="font-mono font-bold">
                      <Link
                        href={`/raw-material-orders/${order.id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {order.orderNo}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{order.materialName}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {order.sku}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">
                        {rawMaterialOrderSourceLabels[order.source] ?? "—"}
                      </Badge>
                      {order.sourceNote && (
                        <p className="text-[10px] text-muted-foreground mt-1 max-w-[160px] line-clamp-2">
                          {order.sourceNote}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{order.supplier}</TableCell>
                    <TableCell>
                      {formatNumber(order.quantity)} {order.unit}
                    </TableCell>
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      ₺{formatNumber(order.totalPrice)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filtered.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <Truck className="w-16 h-16 mx-auto mb-4 opacity-40" />
              <p className="font-medium">Kayıt bulunamadı</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="pb-10" />

      <RawMaterialOrderFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={(order) => {
          refresh();
          router.push(`/raw-material-orders/${order.id}`);
        }}
      />
    </div>
  );
}
