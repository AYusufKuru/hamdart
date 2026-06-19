"use client";

import {
  Factory,
  Package,
  ShoppingCart,
  FlaskConical,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";
import { dashboardStats } from "@/data/mock";

const statItems = [
  {
    label: "Günlük Üretim",
    value: formatNumber(dashboardStats.dailyProduction),
    unit: "adet",
    description: `Hedef: ${formatNumber(dashboardStats.productionTarget)}`,
    trend: "+%3.2",
    trendDir: "up" as const,
    icon: Factory,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
  },
  {
    label: "Aktif Batch",
    value: String(dashboardStats.activeBatches),
    unit: "batch",
    description: "6 üretim hattında",
    trend: "Canlı",
    trendDir: "neutral" as const,
    icon: Package,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    label: "Bekleyen Sipariş",
    value: String(dashboardStats.pendingOrders),
    unit: "sipariş",
    description: "7 acil öncelikli",
    trend: "+5 bugün",
    trendDir: "up" as const,
    icon: ShoppingCart,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    label: "Ar-Ge Deneyleri",
    value: String(dashboardStats.labExperiments),
    unit: "proje",
    description: "4 aktif test",
    trend: "2 onay bekliyor",
    trendDir: "neutral" as const,
    icon: FlaskConical,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
];

export function StatCards() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {statItems.map((stat) => (
        <Card
          key={stat.label}
          className="glass-card border-none hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden relative group"
        >
          <CardContent className="p-7">
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-3 rounded-2xl", stat.bg)}>
                <stat.icon className={cn("w-6 h-6", stat.color)} />
              </div>
              <div
                className={cn(
                  "flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                  stat.trendDir === "up"
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {stat.trend}
                {stat.trendDir === "up" && <ArrowUpRight className="ml-0.5 w-3 h-3" />}
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
      ))}
    </div>
  );
}

export function ComplianceCard() {
  return (
    <Card className="glass-card border-none">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-emerald-500/10">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-bold">GMP Uyumluluk Skoru</p>
            <p className="text-xs text-muted-foreground">Son 30 gün ortalaması</p>
          </div>
        </div>
        <p className="text-4xl font-black text-emerald-600">{dashboardStats.gmpCompliance}%</p>
        <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
            style={{ width: `${dashboardStats.gmpCompliance}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Depo kullanım: %{dashboardStats.warehouseUtilization} · Stok uyarı: {dashboardStats.stockAlerts}
        </p>
      </CardContent>
    </Card>
  );
}
