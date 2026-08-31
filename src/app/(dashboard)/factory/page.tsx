"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  productionLines as seedLines,
  productionBatches as seedBatches,
  type ProductionBatch,
  type ProductionLine,
} from "@/data/mock";
import {
  getAllProductionBatches,
  getAllProductionLines,
} from "@/lib/production-store";
import { BatchFormSheet } from "@/components/factory/batch-form-sheet";
import { LineSettingsSheet } from "@/components/factory/line-settings-sheet";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import {
  AlertTriangle,
  Cog,
  Factory,
  Pause,
  Play,
  Settings,
  Wrench,
} from "lucide-react";

const lineStatusMap = {
  active: { label: "Aktif", variant: "success" as const, icon: Play },
  maintenance: { label: "Bakımda", variant: "warning" as const, icon: Wrench },
  idle: { label: "Boşta", variant: "secondary" as const, icon: Pause },
  alert: { label: "Uyarı", variant: "danger" as const, icon: AlertTriangle },
};

const batchStatusMap = {
  planned: { label: "Planlandı", variant: "info" as const },
  in_progress: { label: "Üretimde", variant: "success" as const },
  qc_pending: { label: "KK Bekliyor", variant: "warning" as const },
  completed: { label: "Tamamlandı", variant: "success" as const },
  rejected: { label: "Reddedildi", variant: "danger" as const },
};

export default function FactoryPage() {
  const searchParams = useSearchParams();
  const [productionLines, setProductionLines] =
    useState<ProductionLine[]>(seedLines);
  const [productionBatches, setProductionBatches] =
    useState<ProductionBatch[]>(seedBatches);
  const [formOpen, setFormOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsLineId, setSettingsLineId] = useState<string | undefined>();
  const [tab, setTab] = useState("lines");

  const refresh = () => {
    setProductionLines(getAllProductionLines());
    setProductionBatches(getAllProductionBatches());
  };

  useEffect(() => {
    refresh();
    const nextTab = searchParams.get("tab");
    if (nextTab === "batches") setTab("batches");
    if (nextTab === "lines") setTab("lines");
  }, [searchParams]);

  const activeLines = productionLines.filter((l) => l.status === "active").length;
  const alertLines = productionLines.filter((l) => l.status === "alert").length;

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Üretim"
        badgeClassName="bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
        title="Fabrika & Üretim"
        description="Üretim hatları, batch takibi, verimlilik ve GMP uyumlu operasyon yönetimi."
        actions={
          <>
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={() => {
                setSettingsLineId(undefined);
                setSettingsOpen(true);
              }}
            >
              <Settings className="w-4 h-4 mr-2" />
              Hat Ayarları
            </Button>
            <Button
              className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
              onClick={() => setFormOpen(true)}
            >
              <Factory className="w-4 h-4 mr-2" />
              Yeni Batch Başlat
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Toplam Hat", value: productionLines.length, icon: Factory },
          { label: "Aktif Hat", value: activeLines, icon: Play },
          { label: "Uyarı", value: alertLines, icon: AlertTriangle },
          { label: "Bakımda", value: productionLines.filter((l) => l.status === "maintenance").length, icon: Cog },
        ].map((item) => (
          <Card key={item.label} className="glass-card border-none">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-indigo-500/10">
                <item.icon className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {item.label}
                </p>
                <p className="text-2xl font-black">{item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="lines">Üretim Hatları</TabsTrigger>
          <TabsTrigger value="batches">Batch Takibi</TabsTrigger>
        </TabsList>

        <TabsContent value="lines">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {productionLines.map((line) => {
              const status = lineStatusMap[line.status] ?? lineStatusMap.idle;
              const StatusIcon = status.icon;
              const progress = line.targetToday
                ? Math.min(100, Math.round((line.outputToday / line.targetToday) * 100))
                : 0;

              return (
                <Card
                  key={line.id}
                  className="glass-card border-none hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => {
                    setSettingsLineId(line.id);
                    setSettingsOpen(true);
                  }}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{line.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{line.product}</p>
                      </div>
                      <Badge variant={status.variant} className="gap-1">
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-3 rounded-xl bg-muted/30">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                          Batch
                        </p>
                        <p className="font-mono font-bold mt-1">{line.currentBatch}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/30">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                          Operatör
                        </p>
                        <p className="font-semibold mt-1 truncate">{line.operator}</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-muted-foreground">Günlük çıktı</span>
                        <span className="font-bold">
                          {formatNumber(line.outputToday)} / {formatNumber(line.targetToday)}
                        </span>
                      </div>
                      <Progress
                        value={progress}
                        indicatorClassName={cn(
                          line.status === "alert" && "bg-amber-500",
                          line.status === "maintenance" && "bg-muted-foreground/30"
                        )}
                      />
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-border/40">
                      <span className="text-xs text-muted-foreground">
                        Verimlilik: <strong className="text-foreground">%{line.efficiency}</strong>
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Bakım: {formatDate(line.lastMaintenance)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="batches">
          <Card className="glass-card border-none">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch No</TableHead>
                    <TableHead>Ürün</TableHead>
                    <TableHead>Hat</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Miktar</TableHead>
                    <TableHead>Verim</TableHead>
                    <TableHead>KK Skoru</TableHead>
                    <TableHead>Tarih</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productionBatches.map((batch) => {
                    const status = batchStatusMap[batch.status] ?? batchStatusMap.planned;
                    return (
                      <TableRow key={batch.id}>
                        <TableCell className="font-mono font-bold">{batch.batchNo}</TableCell>
                        <TableCell>{batch.product}</TableCell>
                        <TableCell className="text-muted-foreground">{batch.line}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {formatNumber(batch.quantity)} {batch.unit}
                        </TableCell>
                        <TableCell>
                          {batch.yield > 0 ? (
                            <span
                              className={cn(
                                "font-bold",
                                batch.yield >= 95
                                  ? "text-emerald-600"
                                  : batch.yield >= 90
                                    ? "text-amber-600"
                                    : "text-rose-600"
                              )}
                            >
                              %{batch.yield}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {batch.qcScore > 0 ? (
                            <span className="font-bold">{batch.qcScore}%</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(batch.startDate)} — {formatDate(batch.endDate)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {productionBatches.length === 0 && (
                <div className="py-16 text-center text-muted-foreground">
                  <p className="font-medium">Kayıtlı batch yok</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="pb-10" />

      <BatchFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        onCreated={() => {
          refresh();
          setTab("batches");
        }}
      />
      <LineSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialLineId={settingsLineId}
        onSaved={() => {
          refresh();
          setTab("lines");
        }}
      />
    </div>
  );
}
