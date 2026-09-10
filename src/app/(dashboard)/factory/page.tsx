"use client";

import { Suspense, useEffect, useState } from "react";
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
import { type ProductionBatch, type ProductionLine } from "@/data/mock";
import {
  getAllProductionBatches,
  getAllProductionLines,
  lineHasActiveBatch,
  queuedBatchesForLine,
  updateProductionBatch,
} from "@/lib/production-store";
import { BatchFormSheet } from "@/components/factory/batch-form-sheet";
import { LineSettingsSheet } from "@/components/factory/line-settings-sheet";
import { CanWrite } from "@/components/auth/can-write";
import { useAuth } from "@/lib/auth/auth-context";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import {
  AlertTriangle,
  Cog,
  Factory,
  ListOrdered,
  Pause,
  Play,
  Settings,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

const lineStatusMap = {
  active: { label: "Aktif", variant: "success" as const, icon: Play },
  maintenance: { label: "Bakımda", variant: "warning" as const, icon: Wrench },
  idle: { label: "Boşta", variant: "secondary" as const, icon: Pause },
  alert: { label: "Uyarı", variant: "danger" as const, icon: AlertTriangle },
};

const batchStatusMap = {
  planned: { label: "Planlandı", variant: "info" as const },
  in_progress: { label: "Üretimde", variant: "success" as const },
  queued: { label: "Sırada", variant: "secondary" as const },
  qc_pending: { label: "KK Bekliyor", variant: "warning" as const },
  completed: { label: "Tamamlandı", variant: "success" as const },
  rejected: { label: "Reddedildi", variant: "danger" as const },
};

function FactoryPageContent() {
  const searchParams = useSearchParams();
  const { canWrite } = useAuth();
  const canEditFactory = canWrite("factory");
  const [productionLines, setProductionLines] = useState<ProductionLine[]>([]);
  const [productionBatches, setProductionBatches] = useState<
    ProductionBatch[]
  >([]);
  const [formOpen, setFormOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsLineId, setSettingsLineId] = useState<string | undefined>();
  const [tab, setTab] = useState("lines");

  const refresh = async () => {
    const [lines, batches] = await Promise.all([
      getAllProductionLines(),
      getAllProductionBatches(),
    ]);
    setProductionLines(lines);
    setProductionBatches(batches);
  };

  async function finishCurrent(batchId: string) {
    try {
      const updated = await updateProductionBatch(batchId, {
        action: "complete_and_next",
      });
      toast.success(
        updated.status === "in_progress"
          ? `Sıradaki parti başladı: ${updated.batchNo}`
          : `${updated.batchNo} bitirildi`
      );
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız");
    }
  }

  async function startQueued(batchId: string) {
    try {
      const updated = await updateProductionBatch(batchId, {
        action: "start_next",
      });
      toast.success(`Sıradaki parti başladı: ${updated.batchNo}`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız");
    }
  }

  useEffect(() => {
    void refresh();
    const nextTab = searchParams.get("tab");
    if (nextTab === "batches") setTab("batches");
    if (nextTab === "lines") setTab("lines");
    if (nextTab === "queue") setTab("queue");
  }, [searchParams]);

  const queuedCount = productionBatches.filter((b) => b.status === "queued").length;

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Üretim"
        badgeClassName="bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
        title="Fabrika & Üretim"
        description="Üretim hatları, batch takibi, verimlilik ve GMP uyumlu operasyon yönetimi."
        actions={
          <>
            <CanWrite resource="factory">
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
            </CanWrite>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Toplam Hat", value: productionLines.length, icon: Factory },
          { label: "Aktif Hat", value: productionLines.filter((l) => l.status === "active").length, icon: Play },
          { label: "Sırada", value: queuedCount, icon: ListOrdered },
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
          <TabsTrigger value="queue">Sıra</TabsTrigger>
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
              const queue = queuedBatchesForLine(productionBatches, line.name);
              const activeBatch = productionBatches.find(
                (b) => b.line === line.name && b.status === "in_progress"
              );

              return (
                <Card
                  key={line.id}
                  className={cn(
                    "glass-card border-none transition-shadow",
                    canEditFactory && "hover:shadow-lg cursor-pointer"
                  )}
                  onClick={
                    canEditFactory
                      ? () => {
                          setSettingsLineId(line.id);
                          setSettingsOpen(true);
                        }
                      : undefined
                  }
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{line.name}</CardTitle>
                        <p className="text-xs font-mono text-muted-foreground mt-1">
                          Makine Kodu: {line.code ?? line.id}
                        </p>
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

                    {queue.length > 0 && (
                      <div className="rounded-xl border bg-indigo-500/5 p-3 space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                          Sıra · {queue.length}
                        </p>
                        <ol className="space-y-1.5">
                          {queue.map((b) => (
                            <li
                              key={b.id}
                              className="flex items-start justify-between gap-2 text-xs"
                            >
                              <span>
                                <span className="font-mono font-bold">
                                  {b.queuePosition}. {b.batchNo}
                                </span>
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {b.product}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {canEditFactory && (activeBatch || (queue.length > 0 && !activeBatch)) && (
                      <div className="flex flex-wrap gap-2">
                        {activeBatch ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg"
                            onClick={(e) => {
                              e.stopPropagation();
                              void finishCurrent(activeBatch.id);
                            }}
                          >
                            {queue.length > 0 ? "Bitir, sıradakini al" : "Bitir"}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="rounded-lg"
                            onClick={(e) => {
                              e.stopPropagation();
                              void startQueued(queue[0].id);
                            }}
                          >
                            Sıradakini başlat
                          </Button>
                        )}
                      </div>
                    )}

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

        <TabsContent value="queue">
          <div className="grid gap-6 md:grid-cols-2">
            {productionLines
              .map((line) => ({
                line,
                queue: queuedBatchesForLine(productionBatches, line.name),
                busy: lineHasActiveBatch(productionBatches, line.name),
              }))
              .filter((row) => row.queue.length > 0)
              .map(({ line, queue, busy }) => (
                <Card key={line.id} className="glass-card border-none">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{line.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {busy
                            ? `Üretimde: ${line.currentBatch}`
                            : "Hat boşta — sıra bekliyor"}
                        </p>
                      </div>
                      <Badge variant="secondary">{queue.length} sırada</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <ol className="space-y-2">
                      {queue.map((b) => (
                        <li
                          key={b.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="font-mono text-sm font-bold">
                              {b.queuePosition}. {b.batchNo}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {b.product} · {formatNumber(b.quantity)} {b.unit}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              ))}
          </div>
          {queuedCount === 0 && (
              <Card className="glass-card border-none">
                <CardContent className="py-16 text-center text-muted-foreground">
                  <p className="font-medium">Sırada bekleyen iş yok</p>
                </CardContent>
              </Card>
            )}
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
                          <Badge variant={status.variant}>
                            {status.label}
                            {batch.status === "queued" && batch.queuePosition
                              ? ` · ${batch.queuePosition}`
                              : ""}
                          </Badge>
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
          void refresh();
          setTab("lines");
        }}
      />
      <LineSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialLineId={settingsLineId}
        onSaved={() => {
          void refresh();
          setTab("lines");
        }}
      />
    </div>
  );
}

export default function FactoryPage() {
  return (
    <Suspense fallback={<div className="p-10 text-muted-foreground">Yükleniyor...</div>}>
      <FactoryPageContent />
    </Suspense>
  );
}
