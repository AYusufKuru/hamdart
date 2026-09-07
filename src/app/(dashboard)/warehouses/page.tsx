"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { warehouseTypeConfig } from "@/components/warehouses/warehouse-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  occupancyPercent,
  warehouseTypeLabels,
  WAREHOUSE_IDS,
  type StockTransfer,
  type Warehouse,
  type WarehouseStockItem,
} from "@/data/warehouses";
import { getAllWarehouseStockItems } from "@/lib/stock-store";
import { getStockTransfers, getWarehouses } from "@/lib/warehouse-store";
import { syncReplenishmentOrders } from "@/lib/raw-material-order-store";
import { StockTransferFormSheet } from "@/components/warehouses/stock-transfer-form-sheet";
import { CanWrite } from "@/components/auth/can-write";
import { cn, formatDate } from "@/lib/utils";
import {
  ArrowRight,
  ArrowRightLeft,
  Box,
  Factory,
  MapPin,
  Package,
  User,
} from "lucide-react";

const transferReasonLabel = {
  replenishment: "Ana depodan aktarım",
  direct_lab: "Doğrudan lab girişi",
  manual: "Manuel",
};

export default function WarehousesPage() {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stock, setStock] = useState<WarehouseStockItem[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);

  async function refresh() {
    await syncReplenishmentOrders();
    const [wh, items, tr] = await Promise.all([
      getWarehouses(),
      getAllWarehouseStockItems(),
      getStockTransfers(),
    ]);
    setWarehouses(wh);
    setStock(items);
    setTransfers(tr);
  }

  useEffect(() => {
    void refresh();
  }, []);

  const labLow = stock.filter(
    (i) =>
      i.warehouseId === WAREHOUSE_IDS.laboratory &&
      !i.labDirectEntry &&
      i.replenishFromWarehouseId &&
      i.labTargetQuantity !== undefined &&
      i.quantity < i.minStock
  );
  const pendingTransfers = transfers.filter((t) => t.status === "pending");

  const filteredWarehouses =
    activeTab === "all"
      ? warehouses
      : warehouses.filter((w) => w.type === activeTab);

  const totalCapacity = warehouses.reduce((s, w) => s + w.capacity, 0);
  const totalUsed = warehouses.reduce((s, w) => s + w.used, 0);
  const avgUtilization = Math.round((totalUsed / totalCapacity) * 100);
  const totalSkus = stock.length;

  function stockByWarehouse(warehouseId: string) {
    return stock.filter((i) => i.warehouseId === warehouseId);
  }

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Lojistik"
        badgeClassName="bg-violet-500/10 text-violet-600 border-violet-500/20"
        title="Depolar"
        description="Her depo için ayrı detay sayfasında tüm stok kalemlerini arayın ve filtreleyin. Laboratuvar stoğu üretim deposundan aktarılır."
        actions={
          <CanWrite resource="stock">
            <Button
              className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
              onClick={() => setTransferOpen(true)}
            >
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Stok Aktar
            </Button>
          </CanWrite>
        }
      />

      {(labLow.length > 0 || pendingTransfers.length > 0) && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-2">
          <p className="text-sm font-bold text-violet-900 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4" />
            Laboratuvar aktarım özeti
          </p>
          <p className="text-sm text-violet-800/90">
            {pendingTransfers.length} bekleyen aktarım · {labLow.length} ürün
            minimum stok altında
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Depo Sayısı", value: warehouses.length, icon: Box },
          { label: "Toplam SKU", value: totalSkus, icon: Package },
          { label: "Ort. Doluluk", value: `%${avgUtilization}`, icon: Factory },
          {
            label: "Bekleyen Aktarım",
            value: pendingTransfers.length,
            icon: ArrowRightLeft,
          },
        ].map((stat) => (
          <Card key={stat.label} className="glass-card border-none">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-violet-500/10">
                <stat.icon className="w-5 h-5 text-violet-600" />
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">Tümü</TabsTrigger>
          <TabsTrigger value="packaging">Paketleme</TabsTrigger>
          <TabsTrigger value="production">Üretim Malzemeleri</TabsTrigger>
          <TabsTrigger value="laboratory">Laboratuvar</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredWarehouses.map((warehouse) => {
          const config =
            warehouseTypeConfig[warehouse.type] ?? warehouseTypeConfig.production;
          const Icon = config.icon;
          const utilization = occupancyPercent(
            warehouse.used,
            warehouse.capacity
          );
          const stockCount = stockByWarehouse(warehouse.id).length;
          const alertCount = stockByWarehouse(warehouse.id).filter(
            (i) =>
              i.status === "low" ||
              i.status === "critical" ||
              i.status === "expiring"
          ).length;

          return (
            <Link key={warehouse.id} href={`/warehouses/${warehouse.id}`}>
              <Card className="glass-card border-none hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden h-full cursor-pointer group">
                <div
                  className={cn(
                    "h-2 bg-gradient-to-r",
                    config.color.replace("/10", "/40")
                  )}
                />
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-muted/50 group-hover:bg-violet-500/10 transition-colors">
                        <Icon className="w-5 h-5 text-violet-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg group-hover:text-indigo-600 transition-colors">
                          {warehouse.name}
                        </CardTitle>
                        <div className="flex items-center gap-1.5 mt-1.5 text-sm text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          {warehouse.location}
                        </div>
                      </div>
                    </div>
                    <Badge variant={config.badge}>
                      {warehouseTypeLabels[warehouse.type]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-3 line-clamp-2">
                    {warehouse.description}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="rounded-xl bg-muted/30 p-3">
                      <p className="text-2xl font-black">{stockCount}</p>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                        Stok Kalemi
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/30 p-3">
                      <p
                        className={cn(
                          "text-2xl font-black",
                          alertCount > 0 && "text-amber-600"
                        )}
                      >
                        {alertCount}
                      </p>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                        Uyarı
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Doluluk</span>
                      <span className="font-bold">%{utilization}</span>
                    </div>
                    <Progress value={utilization} />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="w-4 h-4" />
                      {warehouse.manager}
                    </div>
                    <span className="flex items-center gap-1 font-bold text-indigo-600 text-xs">
                      Detay
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className="glass-card border-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowRightLeft className="w-5 h-5 text-violet-600" />
            Son Aktarımlar (Üretim → Laboratuvar)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Malzeme</TableHead>
                <TableHead>Miktar</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Tarih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    Henüz aktarım yok
                  </TableCell>
                </TableRow>
              ) : (
                transfers.slice(0, 5).map((tr) => (
                <TableRow key={tr.id}>
                  <TableCell className="font-medium">{tr.materialName}</TableCell>
                  <TableCell>
                    {tr.quantity} {tr.unit}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        tr.reason === "direct_lab" ? "warning" : "secondary"
                      }
                    >
                      {transferReasonLabel[tr.reason]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={tr.status === "completed" ? "success" : "info"}
                    >
                      {tr.status === "completed" ? "Tamamlandı" : "Bekliyor"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(tr.createdAt)}
                  </TableCell>
                </TableRow>
              ))
              )}
            </TableBody>
          </Table>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" className="rounded-xl" asChild>
              <Link href={`/warehouses/${WAREHOUSE_IDS.laboratory}`}>
                Laboratuvar detayı
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="pb-10" />

      <StockTransferFormSheet
        open={transferOpen}
        onOpenChange={setTransferOpen}
        warehouses={warehouses}
        items={stock}
        onCreated={() => void refresh()}
      />
    </div>
  );
}
