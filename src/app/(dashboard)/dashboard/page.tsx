"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatCards, ComplianceCard } from "@/components/dashboard/stat-cards";
import { ProductionChart, StockChart } from "@/components/dashboard/charts";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { PageHeader } from "@/components/shared/page-header";
import { type Order, type ProductionLine } from "@/data/mock";
import { getAllOrders } from "@/lib/order-store";
import { syncReplenishmentOrders } from "@/lib/raw-material-order-store";
import { getAllProductionBatches, getAllProductionLines } from "@/lib/production-store";
import { getAllLabExperiments } from "@/lib/lab-store";
import { getAllWarehouseStockItems, toDisplayStockItems } from "@/lib/stock-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatNumber, todayIso } from "@/lib/utils";
import { toast } from "sonner";
import { CanWrite } from "@/components/auth/can-write";
import { ArrowRight, Download, Plus } from "lucide-react";

const lineStatusMap = {
  active: { label: "Aktif", variant: "success" as const },
  maintenance: { label: "Bakım", variant: "warning" as const },
  idle: { label: "Boşta", variant: "secondary" as const },
  alert: { label: "Uyarı", variant: "danger" as const },
};

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [productionLines, setProductionLines] = useState<ProductionLine[]>([]);

  useEffect(() => {
    void (async () => {
      await syncReplenishmentOrders();
      const [orderList, lines] = await Promise.all([
        getAllOrders(),
        getAllProductionLines(),
      ]);
      setOrders(orderList);
      setProductionLines(lines);
    })();
  }, []);

  const urgentOrders = orders.filter(
    (o) =>
      o.priority === "urgent" &&
      o.status !== "delivered" &&
      o.status !== "cancelled"
  );

  async function downloadReport() {
    await syncReplenishmentOrders();
    const [allOrders, batches, lines, experiments, warehouseItems] =
      await Promise.all([
        getAllOrders(),
        getAllProductionBatches(),
        getAllProductionLines(),
        getAllLabExperiments(),
        getAllWarehouseStockItems(),
      ]);
    const stock = toDisplayStockItems(warehouseItems);
    const alerts = stock.filter(
      (i) =>
        i.status === "low" || i.status === "critical" || i.status === "expiring"
    );

    const csv = [
      "HamdPharma Genel Rapor",
      `Tarih;${todayIso()}`,
      "",
      "Özet",
      `Sipariş;${allOrders.length}`,
      `Bekleyen sipariş;${allOrders.filter((o) => o.status === "pending").length}`,
      `Aktif batch;${batches.filter((b) => b.status === "in_progress").length}`,
      `Üretim hattı;${lines.length}`,
      `Deney;${experiments.length}`,
      `Stok uyarı;${alerts.length}`,
      "",
      "Sipariş No;Müşteri;Ürün;Durum;Öncelik;Fatura",
      ...allOrders.map(
        (o) =>
          `${o.orderNo};${o.customer};${o.product};${o.status};${o.priority};${o.value}`
      ),
      "",
      "Batch No;Ürün;Hat;Durum;Miktar",
      ...batches.map(
        (b) => `${b.batchNo};${b.product};${b.line};${b.status};${b.quantity}`
      ),
      "",
      "SKU;Ürün;Depo;Miktar;Durum",
      ...alerts.map(
        (i) => `${i.sku};${i.name};${i.warehouse};${i.quantity} ${i.unit};${i.status}`
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hamdpharma-rapor-${todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Rapor indirildi");
  }

  return (
    <div className="p-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Genel Bakış"
        title={
          <>
            Hoş geldiniz,{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">
              Ayşe
            </span>
          </>
        }
        description="Fabrika üretimi, stok durumu, depolar, siparişler ve Ar-Ge laboratuvarı tek panelden yönetiliyor."
        actions={
          <>
            <Button
              variant="outline"
              className="rounded-2xl h-11"
              onClick={downloadReport}
            >
              <Download className="w-4 h-4 mr-2" />
              Rapor İndir
            </Button>
            <CanWrite resource="orders">
              <Button
                className="rounded-2xl h-11 bg-gradient-to-r from-indigo-600 to-blue-500 border-none shadow-lg shadow-indigo-500/20"
                asChild
              >
                <Link href="/orders?yeni=1">
                  <Plus className="w-4 h-4 mr-2" />
                  Yeni Sipariş
                </Link>
              </Button>
            </CanWrite>
          </>
        }
      />

      <StatCards />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProductionChart />
        </div>
        <ComplianceCard />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <Card className="glass-card border-none">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Üretim Hatları — Canlı Durum</CardTitle>
              <Button variant="ghost" size="sm" className="rounded-xl" asChild>
                <Link href="/factory">
                  Tümünü Gör <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {productionLines.slice(0, 4).map((line) => {
                const status = lineStatusMap[line.status] ?? lineStatusMap.idle;
                const progress = line.targetToday
                  ? Math.round((line.outputToday / line.targetToday) * 100)
                  : 0;
                return (
                  <Link
                    key={line.id}
                    href="/factory"
                    className="block p-4 rounded-xl border border-border/40 hover:border-indigo-500/20 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-sm">{line.name}</p>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{line.product}</p>
                    <Progress value={progress} className="h-1.5" />
                    <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                      <span>{formatNumber(line.outputToday)} / {formatNumber(line.targetToday)}</span>
                      <span>%{line.efficiency} verim</span>
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          <StockChart />
        </div>

        <div className="space-y-8">
          <RecentActivity />

          <Card className="glass-card border-none">
            <CardHeader>
              <CardTitle>Acil Siparişler</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {urgentOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Acil bekleyen sipariş yok.
                </p>
              ) : (
                urgentOrders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="block p-3 rounded-xl bg-muted/20 border border-border/30 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-sm">{order.orderNo}</p>
                        <p className="text-xs text-muted-foreground mt-1">{order.customer}</p>
                      </div>
                      <Badge variant="danger">Acil</Badge>
                    </div>
                    <p className="text-xs mt-2">
                      {order.product} · {formatNumber(order.quantity)} {order.unit}
                    </p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="pb-10" />
    </div>
  );
}
