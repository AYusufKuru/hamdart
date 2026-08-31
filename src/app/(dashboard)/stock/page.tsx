"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { stockItems as seedStockItems, type StockItem } from "@/data/mock";
import {
  warehouses,
  WAREHOUSE_IDS,
  warehouseTypeLabels,
} from "@/data/warehouses";
import { toDisplayStockItems } from "@/lib/stock-store";
import { syncReplenishmentOrders } from "@/lib/raw-material-order-store";
import { StockFormSheet } from "@/components/stock/stock-form-sheet";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Filter, Package, Plus, Search, Snowflake } from "lucide-react";

const statusMap = {
  normal: { label: "Normal", variant: "success" as const },
  low: { label: "Düşük", variant: "warning" as const },
  critical: { label: "Kritik", variant: "danger" as const },
  expiring: { label: "SKT Yakın", variant: "warning" as const },
};

export default function StockPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "alert">("all");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [stockItems, setStockItems] = useState<StockItem[]>(seedStockItems);
  const [formOpen, setFormOpen] = useState(false);

  const refresh = () => {
    syncReplenishmentOrders();
    setStockItems(toDisplayStockItems());
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = stockItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      item.lotNo.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" || item.status === "low" || item.status === "critical" || item.status === "expiring";
    const matchesWarehouse =
      warehouseFilter === "all" || item.warehouseId === warehouseFilter;
    return matchesSearch && matchesFilter && matchesWarehouse;
  });

  const alerts = stockItems.filter(
    (i) => i.status === "low" || i.status === "critical" || i.status === "expiring"
  );

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Lojistik"
        badgeClassName="bg-blue-500/10 text-blue-600 border-blue-500/20"
        title="Stok Durumu"
        description="Paketleme, üretim malzemeleri ve laboratuvar depolarındaki stoklar. Lab ürünleri ana depodan aktarılır; referans standartlar doğrudan lab girişlidir."
        actions={
          <Button
            className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
            onClick={() => setFormOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Stok Girişi
          </Button>
        }
      />

      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-800">
            {alerts.length} üründe stok uyarısı var — kritik seviye, düşük stok veya SKT yaklaşıyor.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Toplam SKU", value: stockItems.length },
          { label: "Normal Stok", value: stockItems.filter((i) => i.status === "normal").length },
          { label: "Uyarı", value: alerts.length },
          { label: "Soğuk Zincir", value: stockItems.filter((i) => i.temperature).length },
        ].map((stat) => (
          <Card key={stat.label} className="glass-card border-none">
            <CardContent className="p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {stat.label}
              </p>
              <p className="text-3xl font-black mt-1">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-card border-none">
        <CardContent className="p-6">
          <Tabs
            value={warehouseFilter}
            onValueChange={setWarehouseFilter}
            className="mb-4"
          >
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all">Tüm Depolar</TabsTrigger>
              {warehouses.map((wh) => (
                <TabsTrigger key={wh.id} value={wh.id}>
                  {warehouseTypeLabels[wh.type]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Ürün adı, SKU veya lot no ara..."
                className="pl-10 rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button
              variant={filter === "alert" ? "default" : "outline"}
              className="rounded-xl"
              onClick={() => setFilter(filter === "all" ? "alert" : "all")}
            >
              <Filter className="w-4 h-4 mr-2" />
              {filter === "all" ? "Uyarıları Göster" : "Tümünü Göster"}
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Ürün</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Miktar</TableHead>
                <TableHead>Depo</TableHead>
                <TableHead>Lot No</TableHead>
                <TableHead>SKT</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const status = statusMap[item.status] ?? {
                  label: item.status,
                  variant: "secondary" as const,
                };
                return (
                  <TableRow
                    key={item.id}
                    className={
                      item.warehouseId
                        ? "cursor-pointer hover:bg-muted/40"
                        : undefined
                    }
                    onClick={() => {
                      if (item.warehouseId) {
                        router.push(`/warehouses/${item.warehouseId}`);
                      }
                    }}
                  >
                    <TableCell className="font-mono text-xs font-bold">{item.sku}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.temperature && <Snowflake className="w-3.5 h-3.5 text-blue-500" />}
                        <span className="font-medium">{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.category}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "font-bold",
                          item.status === "critical" && "text-rose-600",
                          item.status === "low" && "text-amber-600"
                        )}
                      >
                        {formatNumber(item.quantity)} {item.unit}
                      </span>
                      <p className="text-[10px] text-muted-foreground">Min: {formatNumber(item.minStock)}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{item.warehouse}</span>
                      {item.labDirectEntry && (
                        <Badge variant="warning" className="mt-1 text-[10px]">
                          Doğrudan lab
                        </Badge>
                      )}
                      {item.replenishFromWarehouseId &&
                        item.warehouseId === WAREHOUSE_IDS.laboratory &&
                        !item.labDirectEntry && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Ana depodan aktarım
                          </p>
                        )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.lotNo}</TableCell>
                    <TableCell className={cn(item.status === "expiring" && "text-amber-600 font-semibold")}>
                      {formatDate(item.expiryDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {filtered.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-40" />
              <p className="font-medium">Sonuç bulunamadı</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="pb-10" />

      <StockFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={refresh}
      />
    </div>
  );
}
