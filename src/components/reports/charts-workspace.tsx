"use client";
"use no memo";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Banknote,
  FileSpreadsheet,
  FileText,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { monthChartData, type ReportColumn, type ReportTableRow, type ReportsData } from "@/lib/reports";
import { downloadReportExcel } from "@/lib/report-export";
import { cn, formatNumber } from "@/lib/utils";

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "none",
  boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
};
const PIE_COLORS = ["#4f46e5", "#f43f5e", "#059669", "#d97706", "#0ea5e9", "#8b5cf6"];

function useChartMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function moneyTip(value: unknown) {
  return `${formatNumber(Number(value))} ₺`;
}

function ChartBox({
  title,
  description,
  children,
  empty,
  hasData = true,
}: {
  title: string;
  description: string;
  children: ReactNode;
  empty?: string;
  hasData?: boolean;
}) {
  return (
    <Card className="glass-card border-none min-w-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full min-w-0">
          {hasData ? (
            children
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {empty ?? "Bu dönem için veri yok"}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ChartsWorkspace({ data }: { data: ReportsData }) {
  const mounted = useChartMounted();
  const chart = useMemo(() => monthChartData(data), [data]);
  const monthLabel = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(
    new Date()
  );

  const kpis = [
    {
      label: "Gelir",
      value: chart.gelir,
      icon: TrendingUp,
      className: "text-indigo-600 bg-indigo-500/10",
    },
    {
      label: "Gider",
      value: chart.gider,
      icon: TrendingDown,
      className: "text-rose-600 bg-rose-500/10",
    },
    {
      label: "Tahsilat",
      value: chart.tahsilat,
      icon: Banknote,
      className: "text-emerald-600 bg-emerald-500/10",
    },
    {
      label: "Ödeme",
      value: chart.odeme,
      icon: Wallet,
      className: "text-amber-600 bg-amber-500/10",
    },
    {
      label: "Net",
      value: chart.net,
      icon: chart.net >= 0 ? TrendingUp : TrendingDown,
      className: chart.net >= 0 ? "text-emerald-600 bg-emerald-500/10" : "text-rose-600 bg-rose-500/10",
    },
  ];

  const balances = [
    {
      label: "Açık alacak",
      value: chart.openReceivable,
      icon: Wallet,
      hint: "Satış faturalarında kalan",
    },
    {
      label: "Açık borç",
      value: chart.openPayable,
      icon: TrendingDown,
      hint: "Alış faturalarında kalan",
    },
    {
      label: "Vadesi geçen",
      value: chart.overdueReceivable,
      icon: AlertTriangle,
      hint: "Gecikmiş tahsilat",
    },
  ];

  const docs = [
    { label: "Satış", value: chart.docs.sales, icon: TrendingUp },
    { label: "Alış", value: chart.docs.purchases, icon: TrendingDown },
    { label: "Teklif", value: chart.docs.quotes, icon: FileText },
    { label: "İrsaliye", value: chart.docs.notes, icon: Truck },
    { label: "Sipariş", value: chart.docs.orders, icon: ShoppingCart },
  ];

  function exportMonthExcel() {
    const columns: ReportColumn[] = [
      { key: "day", header: "Gün" },
      { key: "gelir", header: "Gelir" },
      { key: "gider", header: "Gider" },
      { key: "tahsilat", header: "Tahsilat" },
      { key: "odeme", header: "Ödeme" },
    ];
    const rows: ReportTableRow[] = chart.daily.map((row) => ({
      id: row.day,
      day: row.day,
      gelir: formatNumber(row.gelir),
      gider: formatNumber(row.gider),
      tahsilat: formatNumber(row.tahsilat),
      odeme: formatNumber(row.odeme),
    }));
    downloadReportExcel(`${monthLabel} grafik`, columns, rows);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-lg font-black tracking-tight capitalize">{monthLabel}</p>
          <p className="text-sm text-muted-foreground">
            Fatura, tahsilat, yevmiye ve sipariş kayıtlarından özet.
          </p>
        </div>
        <Button type="button" variant="outline" className="rounded-xl" onClick={exportMonthExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((item) => (
          <Card key={item.label} className="glass-card border-none">
            <CardContent className="p-5 flex items-center gap-3">
              <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", item.className)}>
                <item.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {item.label}
                </p>
                <p className="truncate text-xl font-black">{formatNumber(item.value)} ₺</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {balances.map((item) => (
          <Card key={item.label} className="glass-card border-none">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {item.label}
                </p>
                <item.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-2xl font-black">{formatNumber(item.value)} ₺</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-5">
        {docs.map((item) => (
          <Card key={item.label} className="glass-card border-none">
            <CardContent className="p-4 flex items-center gap-3">
              <item.icon className="h-4 w-4 text-indigo-600" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {item.label}
                </p>
                <p className="text-lg font-black">{item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {mounted ? (
        <>
          <ChartBox title="6 aylık trend" description="Gelir, gider ve tahsilatın son altı ayı">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart.trend} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 265)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={moneyTip} contentStyle={TOOLTIP_STYLE} />
                <Legend />
                <Area type="monotone" dataKey="gelir" name="Gelir" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.18} />
                <Area type="monotone" dataKey="gider" name="Gider" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.12} />
                <Area
                  type="monotone"
                  dataKey="tahsilat"
                  name="Tahsilat"
                  stroke="#059669"
                  fill="#059669"
                  fillOpacity={0.1}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartBox>

          <ChartBox title="Günlük gelir ve gider" description={`${monthLabel} — fatura ve yevmiye`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart.daily} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 265)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 11 }} />
                <Tooltip formatter={moneyTip} contentStyle={TOOLTIP_STYLE} />
                <Legend />
                <Bar dataKey="gelir" name="Gelir" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gider" name="Gider" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartBox title="Gelir / gider payı" description="Bu ayki dağılım" hasData={chart.mix.length > 0}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chart.mix} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
                    {chart.mix.map((item, i) => (
                      <Cell key={item.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={moneyTip} contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartBox>

            <ChartBox title="Tahsilat ve ödeme" description="Bu ayki nakit hareketi">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart.daily} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 265)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={moneyTip} contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                  <Bar dataKey="tahsilat" name="Tahsilat" fill="#059669" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="odeme" name="Ödeme" fill="#d97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>

            <ChartBox
              title="En çok satış"
              description="Bu ayki satış faturaları"
              hasData={chart.topCustomers.length > 0}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart.topCustomers} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="oklch(0.9 0.02 265)" />
                  <XAxis type="number" tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={moneyTip} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="value" name="Satış" fill="#4f46e5" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>

            <ChartBox
              title="En çok alış"
              description="Bu ayki alış faturaları"
              hasData={chart.topSuppliers.length > 0}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart.topSuppliers} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="oklch(0.9 0.02 265)" />
                  <XAxis type="number" tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={moneyTip} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="value" name="Alış" fill="#f43f5e" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>

            <ChartBox
              title="Tahsilat kanalları"
              description="Nakit, havale ve diğer"
              hasData={chart.methods.length > 0}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart.methods} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="oklch(0.9 0.02 265)" />
                  <XAxis type="number" tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={moneyTip} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="value" name="Tutar" fill="#6366f1" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>

            <ChartBox
              title="Satış fatura durumları"
              description="Bu ay kesilen satışların durumu"
              hasData={chart.statuses.length > 0}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chart.statuses}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {chart.statuses.map((item, i) => (
                      <Cell key={item.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartBox>
          </div>
        </>
      ) : null}
    </div>
  );
}
