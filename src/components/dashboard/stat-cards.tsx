"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Factory,
  Package,
  ShoppingCart,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";
import {
  type LabExperiment,
  type Order,
  type ProductionBatch,
  type ProductionLine,
} from "@/data/mock";
import { occupancyPercent } from "@/data/warehouses";
import { getAllOrders } from "@/lib/order-store";
import { getWarehouses } from "@/lib/warehouse-store";
import {
  getAllProductionBatches,
  getAllProductionLines,
} from "@/lib/production-store";
import { getAllLabExperiments } from "@/lib/lab-store";
import { getAllWarehouseStockItems, toDisplayStockItems } from "@/lib/stock-store";

function lineTotals(lines: ProductionLine[]) {
  return {
    dailyProduction: lines.reduce((s, l) => s + l.outputToday, 0),
    productionTarget: lines.reduce((s, l) => s + l.targetToday, 0),
    lines: lines.length,
  };
}

function countsFrom(
  batches: ProductionBatch[],
  orderList: Order[],
  experiments: LabExperiment[],
  lines: ProductionLine[]
) {
  const lt = lineTotals(lines);
  return {
    ...lt,
    activeBatches: batches.filter((b) => b.status === "in_progress").length,
    pendingOrders: orderList.filter((o) => o.status === "pending").length,
    labExperiments: experiments.length,
    urgentOrders: orderList.filter(
      (o) =>
        o.priority === "urgent" &&
        o.status !== "delivered" &&
        o.status !== "cancelled"
    ).length,
    activeLab: experiments.filter(
      (e) => e.status === "running" || e.status === "analysis"
    ).length,
  };
}

export function StatCards() {
  const [live, setLive] = useState(() =>
    countsFrom([], [], [], [])
  );

  useEffect(() => {
    void (async () => {
      const [batches, orderList, experiments, lines] = await Promise.all([
        getAllProductionBatches(),
        getAllOrders(),
        getAllLabExperiments(),
        getAllProductionLines(),
      ]);
      setLive(countsFrom(batches, orderList, experiments, lines));
    })();
  }, []);

  const statItems = [
    {
      label: "Günlük Üretim",
      value: formatNumber(live.dailyProduction),
      unit: "adet",
      description: `Hedef: ${formatNumber(live.productionTarget)}`,
      trend: "Hat kartları",
      href: "/factory",
      icon: Factory,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
    },
    {
      label: "Aktif Batch",
      value: String(live.activeBatches),
      unit: "batch",
      description: `${live.lines} üretim hattında`,
      trend: "Canlı",
      href: "/factory?tab=batches",
      icon: Package,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Bekleyen Sipariş",
      value: String(live.pendingOrders),
      unit: "sipariş",
      description: `${live.urgentOrders} acil öncelikli`,
      trend: "Canlı",
      href: "/orders",
      icon: ShoppingCart,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      label: "Ar-Ge Deneyleri",
      value: String(live.labExperiments),
      unit: "proje",
      description: `${live.activeLab} aktif test`,
      trend: "Canlı",
      href: "/rd-lab?tab=experiments",
      icon: FlaskConical,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {statItems.map((stat) => (
        <Link key={stat.label} href={stat.href} className="block">
          <Card className="glass-card border-none hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden relative group h-full">
          <CardContent className="p-7">
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-3 rounded-2xl", stat.bg)}>
                <stat.icon className={cn("w-6 h-6", stat.color)} />
              </div>
              <div className="flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground">
                {stat.trend}
              </div>
            </div>
            <h3 className="text-xs font-bold text-muted-foreground/80 uppercase tracking-widest mb-2">
              {stat.label}
            </h3>
            <p className="text-3xl font-black tracking-tighter">
              {stat.value}
              <span className="text-sm font-semibold text-muted-foreground ml-1">{stat.unit}</span>
            </p>
            <p className="text-[10px] text-muted-foreground font-semibold mt-2 opacity-70 italic">
              {stat.description}
            </p>
          </CardContent>
        </Card>
        </Link>
      ))}
    </div>
  );
}

export function ComplianceCard() {
  const [meta, setMeta] = useState({
    alerts: 0,
    utilization: 0,
    warehouseCount: 0,
  });

  useEffect(() => {
    void (async () => {
      const [warehouseItems, warehouses] = await Promise.all([
        getAllWarehouseStockItems(),
        getWarehouses(),
      ]);
      const display = toDisplayStockItems(warehouseItems);
      const alerts = display.filter(
        (i) =>
          i.status === "low" ||
          i.status === "critical" ||
          i.status === "expiring"
      ).length;
      const capacity = warehouses.reduce((s, w) => s + w.capacity, 0);
      const used = warehouses.reduce((s, w) => s + w.used, 0);
      setMeta({
        alerts,
        utilization: occupancyPercent(used, capacity),
        warehouseCount: warehouses.length,
      });
    })();
  }, []);

  return (
    <Link href="/stock" className="block h-full">
    <Card className="glass-card border-none h-full hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-emerald-500/10">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-bold">Stok Uyarıları</p>
            <p className="text-xs text-muted-foreground">Düşük, kritik veya SKT yakın</p>
          </div>
        </div>
        <p className="text-4xl font-black text-emerald-600">{meta.alerts}</p>
        <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
            style={{ width: `${Math.min(100, meta.alerts * 20)}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Depo: {meta.warehouseCount} · Kullanım: %{meta.utilization}
        </p>
      </CardContent>
    </Card>
    </Link>
  );
}
