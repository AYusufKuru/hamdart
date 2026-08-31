"use client";
"use no memo";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { productionChartData, stockChartData } from "@/data/mock";
import { formatNumber } from "@/lib/utils";

function useChartMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function ProductionChart() {
  const mounted = useChartMounted();

  return (
    <Card className="glass-card border-none">
      <CardHeader>
        <CardTitle>Üretim Trendi</CardTitle>
        <CardDescription>Son 6 ay ürün tipine göre üretim hacmi</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[320px] w-full min-w-0">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={productionChartData}>
                <defs>
                  <linearGradient id="tabletGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="capsuleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 265)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) => formatNumber(Number(value))}
                  contentStyle={{
                    borderRadius: 12,
                    border: "none",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="tablet"
                  name="Tablet"
                  stroke="#4f46e5"
                  fill="url(#tabletGrad)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="capsule"
                  name="Kapsül"
                  stroke="#3b82f6"
                  fill="url(#capsuleGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function StockChart() {
  const mounted = useChartMounted();

  return (
    <Card className="glass-card border-none">
      <CardHeader>
        <CardTitle>Stok Dağılımı</CardTitle>
        <CardDescription>Kategoriye göre mevcut stok miktarları</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[320px] w-full min-w-0">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockChartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="oklch(0.9 0.02 265)"
                />
                <XAxis type="number" tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="category" width={90} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => formatNumber(Number(value))}
                  contentStyle={{
                    borderRadius: 12,
                    border: "none",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                  }}
                />
                <Bar dataKey="value" name="Stok" fill="#6366f1" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
