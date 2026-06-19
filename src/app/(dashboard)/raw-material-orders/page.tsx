"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
  type RawMaterialOrder,
  type RawMaterialOrderStatus,
} from "@/data/raw-material-orders";
import {
  createManualRawMaterialOrder,
  getAllRawMaterialOrders,
  syncReplenishmentOrders,
} from "@/lib/raw-material-order-store";
import { getWarehouseName } from "@/data/warehouses";
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
import { toast } from "sonner";

function loadOrders() {
  return syncReplenishmentOrders();
}

export default function RawMaterialOrdersPage() {
  const [orders, setOrders] = useState<RawMaterialOrder[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    materialName: "",
    sku: "",
    supplier: "",
    quantity: "",
    unit: "kg",
    unitPrice: "",
    sourceNote: "",
  });

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

  function handleCreateManual(e: React.FormEvent) {
    e.preventDefault();
    createManualRawMaterialOrder({
      materialName: form.materialName,
      sku: form.sku,
      supplier: form.supplier,
      quantity: parseFloat(form.quantity) || 0,
      unit: form.unit,
      unitPrice: parseFloat(form.unitPrice) || 0,
      source: "manual",
      sourceNote: form.sourceNote || undefined,
    });
    toast.success("Talep oluşturuldu — Sipariş Verilecek listesine düştü");
    setForm({
      materialName: "",
      sku: "",
      supplier: "",
      quantity: "",
      unit: "kg",
      unitPrice: "",
      sourceNote: "",
    });
    setShowForm(false);
    refresh();
  }

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
            onClick={() => setShowForm((v) => !v)}
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

      {showForm && (
        <Card className="glass-card border-none">
          <CardContent className="p-6">
            <form
              onSubmit={handleCreateManual}
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            >
              <Input
                placeholder="Malzeme adı *"
                required
                value={form.materialName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, materialName: e.target.value }))
                }
                className="rounded-xl"
              />
              <Input
                placeholder="SKU *"
                required
                value={form.sku}
                onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                className="rounded-xl"
              />
              <Input
                placeholder="Tedarikçi *"
                required
                value={form.supplier}
                onChange={(e) =>
                  setForm((f) => ({ ...f, supplier: e.target.value }))
                }
                className="rounded-xl"
              />
              <Input
                type="number"
                placeholder="Miktar *"
                required
                min={0}
                value={form.quantity}
                onChange={(e) =>
                  setForm((f) => ({ ...f, quantity: e.target.value }))
                }
                className="rounded-xl"
              />
              <Input
                placeholder="Birim (kg, adet...)"
                value={form.unit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unit: e.target.value }))
                }
                className="rounded-xl"
              />
              <Input
                type="number"
                placeholder="Birim fiyat (₺) *"
                required
                min={0}
                value={form.unitPrice}
                onChange={(e) =>
                  setForm((f) => ({ ...f, unitPrice: e.target.value }))
                }
                className="rounded-xl"
              />
              <Input
                placeholder="Açıklama (isteğe bağlı)"
                className="rounded-xl md:col-span-2 lg:col-span-3"
                value={form.sourceNote}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sourceNote: e.target.value }))
                }
              />
              <div className="md:col-span-2 lg:col-span-3 flex gap-2">
                <Button type="submit" className="rounded-xl">
                  Talebi Oluştur
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setShowForm(false)}
                >
                  İptal
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

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
                const st = rawMaterialOrderStatusConfig[order.status];
                return (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/40"
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
                        {rawMaterialOrderSourceLabels[order.source]}
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
    </div>
  );
}
