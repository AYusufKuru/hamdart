"use client";
"use no memo";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import { getAllProductionLines } from "@/lib/production-store";
import { getAllWarehouseStockItems, toDisplayStockItems } from "@/lib/stock-store";

function useChartMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function ProductionChart() {
  const mounted = useChartMounted();
  const [data, setData] = useState<{ name: string; output: number }[]>([]);

  useEffect(() => {
    void getAllProductionLines().then((lines) =>
      setData(lines.map((l) => ({ name: l.name, output: l.outputToday })))
    );
  }, []);

  return (
    <Card className="glass-card border-none">
      <CardHeader>
        <CardTitle>Günlük Üretim</CardTitle>
        <CardDescription>Makinelerin bugünkü çıktısı</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[320px] w-full min-w-0">
          {mounted && data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 265)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => formatNumber(Number(value))}
                  contentStyle={{
                    borderRadius: 12,
                    border: "none",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                  }}
                />
                <Bar dataKey="output" name="Çıktı" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground py-16 text-center">
              Üretim kaydı yok
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function StockChart() {
  const mounted = useChartMounted();
  const [data, setData] = useState<{ category: string; value: number }[]>([]);

  useEffect(() => {
    void (async () => {
      const items = await getAllWarehouseStockItems();
      const map = new Map<string, number>();
      for (const i of toDisplayStockItems(items)) {
        map.set(i.category, (map.get(i.category) ?? 0) + i.quantity);
      }
      setData([...map.entries()].map(([category, value]) => ({ category, value })));
    })();
  }, []);

  return (
    <Card className="glass-card border-none">
      <CardHeader>
        <CardTitle>Stok Dağılımı</CardTitle>
        <CardDescription>Kategoriye göre mevcut stok miktarları</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[320px] w-full min-w-0">
          {mounted && data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
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
          ) : (
            <p className="text-sm text-muted-foreground py-16 text-center">
              Stok kaydı yok
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
