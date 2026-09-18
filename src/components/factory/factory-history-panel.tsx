"use client";

import { useEffect, useMemo, useState } from "react";
import { BatchHistoryDetail } from "@/components/factory/batch-history-detail";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductionBatch } from "@/data/mock";
import {
  aggregateMaterialHistory,
  formatUsagePercent,
  isFinishedBatch,
  recipeUsagePercent,
} from "@/lib/batch-material-report";
import { getAllProductionBatches } from "@/lib/production-store";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { History, Search } from "lucide-react";

const statusMap = {
  completed: { label: "Tamamlandı", variant: "success" as const },
  rejected: { label: "Reddedildi", variant: "danger" as const },
};

export function FactoryHistoryPanel({
  batches: batchesProp,
}: {
  batches?: ProductionBatch[];
}) {
  const [localBatches, setLocalBatches] = useState<ProductionBatch[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (batchesProp) return;
    void getAllProductionBatches().then(setLocalBatches);
  }, [batchesProp]);

  const batches = batchesProp ?? localBatches;

  const finished = useMemo(
    () =>
      batches
        .filter(isFinishedBatch)
        .sort(
          (a, b) =>
            b.endDate.localeCompare(a.endDate) ||
            b.batchNo.localeCompare(b.batchNo)
        ),
    [batches]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr");
    return finished.filter((batch) => {
      const matchesStatus =
        statusFilter === "all" || batch.status === statusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;
      return (
        batch.batchNo.toLocaleLowerCase("tr").includes(q) ||
        batch.product.toLocaleLowerCase("tr").includes(q) ||
        batch.line.toLocaleLowerCase("tr").includes(q)
      );
    });
  }, [finished, search, statusFilter]);

  const materialAgg = useMemo(
    () => aggregateMaterialHistory(finished),
    [finished]
  );

  const selected = finished.find((b) => b.id === selectedId);

  return (
    <div className="space-y-6">
      <Card className="glass-card border-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tamamlanan üretimler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="rounded-xl pl-10"
                placeholder="Parti, ürün veya hat ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <TabsList>
                <TabsTrigger value="all">Tümü</TabsTrigger>
                <TabsTrigger value="completed">Tamamlandı</TabsTrigger>
                <TabsTrigger value="rejected">Red</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parti</TableHead>
                <TableHead>Ürün</TableHead>
                <TableHead>Hat</TableHead>
                <TableHead>Miktar</TableHead>
                <TableHead>Bitiş</TableHead>
                <TableHead>Reçete %</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((batch) => {
                const status =
                  statusMap[batch.status as keyof typeof statusMap] ??
                  statusMap.completed;
                const pct = recipeUsagePercent(batch.materialUsage);
                const selectedRow = drawerOpen && selectedId === batch.id;
                return (
                  <TableRow
                    key={batch.id}
                    className={cn(
                      "cursor-pointer transition-colors",
                      selectedRow
                        ? "bg-indigo-500/10 hover:bg-indigo-500/15"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => {
                      setSelectedId(batch.id);
                      setDrawerOpen(true);
                    }}
                  >
                    <TableCell className="font-mono font-bold">
                      {batch.batchNo}
                    </TableCell>
                    <TableCell className="font-medium">{batch.product}</TableCell>
                    <TableCell>{batch.line}</TableCell>
                    <TableCell>
                      {formatNumber(batch.quantity)} {batch.unit}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(batch.endDate)}
                    </TableCell>
                    <TableCell className="font-bold">
                      {formatUsagePercent(pct)}
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
              <History className="mx-auto mb-4 h-16 w-16 opacity-40" />
              <p className="font-medium">Tamamlanan üretim yok</p>
              <p className="mt-2 text-sm">
                KK onayıyla biten partiler burada listelenir.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card border-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Geçmiş hammadde özeti</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tüm tamamlanan işlerde hangi malzemeden ne kadar gitti (reçete tahmini
            vs gerçekleşen).
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 pr-4 font-medium text-muted-foreground">
                    Hammadde
                  </th>
                  <th className="w-28 pb-3 pr-4 text-right font-medium text-muted-foreground">
                    Parti
                  </th>
                  <th className="w-40 pb-3 pr-4 text-right font-medium text-muted-foreground">
                    Reçete toplamı
                  </th>
                  <th className="w-44 pb-3 pr-4 text-right font-medium text-muted-foreground">
                    Gerçekleşen toplam
                  </th>
                  <th className="w-36 pb-3 text-right font-medium text-muted-foreground">
                    Fark
                  </th>
                </tr>
              </thead>
              <tbody>
                {materialAgg.map((row) => {
                  const diff = row.actualTotal - row.estimatedTotal;
                  return (
                    <tr
                      key={`${row.materialName}-${row.unit}`}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-3 pr-4 align-middle font-medium">
                        {row.materialName}
                      </td>
                      <td className="py-3 pr-4 align-middle text-right tabular-nums">
                        {row.batchCount}
                      </td>
                      <td className="py-3 pr-4 align-middle text-right tabular-nums">
                        <span className="font-medium">
                          {formatNumber(row.estimatedTotal)}
                        </span>
                        <span className="ml-1 text-muted-foreground">
                          {row.unit}
                        </span>
                      </td>
                      <td className="py-3 pr-4 align-middle text-right tabular-nums">
                        <span className="font-bold">
                          {formatNumber(row.actualTotal)}
                        </span>
                        <span className="ml-1 text-muted-foreground">
                          {row.unit}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "py-3 align-middle text-right font-semibold tabular-nums",
                          diff > 0 && "text-amber-700",
                          diff < 0 && "text-sky-700"
                        )}
                      >
                        <span>
                          {diff > 0 ? "+" : ""}
                          {formatNumber(diff)}
                        </span>
                        <span className="ml-1 font-normal text-muted-foreground">
                          {row.unit}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {materialAgg.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Henüz hammadde kullanım özeti yok.
            </p>
          )}
        </CardContent>
      </Card>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="right"
          className="flex w-[42vw] min-w-[42vw] max-w-[42vw] flex-col gap-0 overflow-hidden p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Parti detayı</SheetTitle>
            <SheetDescription>
              Reçete tahmini ve gerçekleşen hammadde kullanımı
            </SheetDescription>
          </SheetHeader>
          {selected ? <BatchHistoryDetail batch={selected} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
