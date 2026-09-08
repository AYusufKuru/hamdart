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
import { getAllProductionLines } from "@/lib/production-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-context";
import { generateDashboardPdf } from "@/lib/dashboard-report";
import { ArrowRight, Download, Loader2 } from "lucide-react";

const lineStatusMap = {
  active: { label: "Aktif", variant: "success" as const },
  maintenance: { label: "Bakım", variant: "warning" as const },
  idle: { label: "Boşta", variant: "secondary" as const },
  alert: { label: "Uyarı", variant: "danger" as const },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [productionLines, setProductionLines] = useState<ProductionLine[]>([]);
  const [exporting, setExporting] = useState(false);

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
    if (exporting) return;
    setExporting(true);
    const toastId = toast.loading("PDF raporu hazırlanıyor...");
    try {
      await generateDashboardPdf({ generatedBy: user?.name });
      toast.success("PDF indirildi", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Rapor oluşturulamadı", { id: toastId });
    } finally {
      setExporting(false);
    }
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
          <Button
            variant="outline"
            className="rounded-2xl h-11"
            onClick={downloadReport}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {exporting ? "Hazırlanıyor" : "Rapor İndir"}
          </Button>
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
