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
import { type LabExperiment, type LabSample } from "@/data/mock";
import { getAllLabExperiments, getAllLabSamples } from "@/lib/lab-store";
import { ExperimentFormSheet } from "@/components/rd-lab/experiment-form-sheet";
import { ExperimentAddMaterialDialog } from "@/components/rd-lab/experiment-add-material-dialog";
import { ExperimentCompleteDialog } from "@/components/rd-lab/experiment-complete-dialog";
import { SampleFormSheet } from "@/components/rd-lab/sample-form-sheet";
import { SampleCompleteDialog } from "@/components/rd-lab/sample-complete-dialog";
import { CanWrite } from "@/components/auth/can-write";
import { useAuth } from "@/lib/auth/auth-context";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import {
  Beaker,
  CheckCircle2,
  FlaskConical,
  Microscope,
  Plus,
  TestTube,
  Trash2,
  XCircle,
} from "lucide-react";

const experimentStatusMap = {
  planning: { label: "Planlama", variant: "info" as const },
  running: { label: "Devam Ediyor", variant: "success" as const },
  analysis: { label: "Analiz", variant: "warning" as const },
  approved: { label: "Onaylandı", variant: "success" as const },
  on_hold: { label: "Beklemede", variant: "danger" as const },
};

const sourceKindMap = {
  product: "Mamul",
  material: "Hammadde",
};

const dispositionMap = {
  open: { label: "Testte", variant: "warning" as const },
  returned: { label: "Depoya iade", variant: "success" as const },
  scrap: { label: "Iskarta", variant: "danger" as const },
};

function RDLabPageContent() {
  const searchParams = useSearchParams();
  const { canWrite } = useAuth();
  const [labExperiments, setLabExperiments] = useState<LabExperiment[]>([]);
  const [labSamples, setLabSamples] = useState<LabSample[]>([]);
  const [experimentOpen, setExperimentOpen] = useState(false);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<LabSample | null>(null);
  const [addMaterialTarget, setAddMaterialTarget] = useState<LabExperiment | null>(
    null
  );
  const [experimentDetail, setExperimentDetail] = useState<LabExperiment | null>(
    null
  );
  const [tab, setTab] = useState("experiments");
  const canFinish = canWrite("lab");

  const refresh = async () => {
    const [experiments, samples] = await Promise.all([
      getAllLabExperiments(),
      getAllLabSamples(),
    ]);
    setLabExperiments(experiments);
    setLabSamples(samples);
  };

  useEffect(() => {
    void refresh();
    const nextTab = searchParams.get("tab");
    if (nextTab === "samples") setTab("samples");
    if (nextTab === "scrap") setTab("scrap");
    if (nextTab === "experiments") setTab("experiments");
  }, [searchParams]);

  const activeExperiments = labExperiments.filter(
    (e) => e.status === "running" || e.status === "analysis"
  ).length;
  const scrapSamples = labSamples.filter((s) => s.disposition === "scrap");

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Ar-Ge"
        badgeClassName="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
        title="Ar-Ge Laboratuvarı"
        description="Reçete geliştirme deneyleri, hammadde tüketimi, numune takibi ve ıskarta."
        actions={
          <CanWrite resource="lab">
            <>
              <Button
                variant="outline"
                className="rounded-2xl"
                onClick={() => setSampleOpen(true)}
              >
                <TestTube className="w-4 h-4 mr-2" />
                Numune Kaydı
              </Button>
              <Button
                className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
                onClick={() => setExperimentOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Yeni Deney
              </Button>
            </>
          </CanWrite>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Aktif Deney", value: activeExperiments, icon: FlaskConical },
          { label: "Toplam Proje", value: labExperiments.length, icon: Beaker },
          { label: "Numune", value: labSamples.length, icon: TestTube },
          { label: "Iskarta", value: scrapSamples.length, icon: Trash2 },
        ].map((stat) => (
          <Card key={stat.label} className="glass-card border-none">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10">
                <stat.icon className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {stat.label}
                </p>
                <p className="text-2xl font-black">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="experiments">Deneyler</TabsTrigger>
          <TabsTrigger value="samples">Numuneler</TabsTrigger>
          <TabsTrigger value="scrap">Iskarta</TabsTrigger>
        </TabsList>

        <TabsContent value="experiments">
          <div className="grid gap-6 md:grid-cols-2">
            {labExperiments.map((exp) => {
              const status = experimentStatusMap[exp.status] ?? experimentStatusMap.planning;
              const usageCount = exp.materialUsages?.length ?? 0;
              const openExp = exp.status !== "approved";
              return (
                <Card key={exp.id} className="glass-card border-none">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-muted-foreground">{exp.code}</p>
                        <CardTitle className="text-base mt-1 leading-snug">
                          {exp.productName || exp.title}
                        </CardTitle>
                        {exp.recipeCode ? (
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            Reçete: {exp.recipeCode}
                          </p>
                        ) : null}
                      </div>
                      <Badge variant={status.variant} className="shrink-0">
                        {status.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 rounded-lg bg-muted/50 font-medium">
                        {exp.department}
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-muted/50 font-medium">
                        {exp.researcher}
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-muted/50 font-medium">
                        {usageCount} hammadde kaydı
                      </span>
                      {exp.priority === "high" && (
                        <Badge variant="danger">Yüksek Öncelik</Badge>
                      )}
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-muted-foreground">İlerleme</span>
                        <span className="font-bold">%{exp.progress}</span>
                      </div>
                      <Progress
                        value={exp.progress}
                        indicatorClassName={cn(
                          exp.status === "approved" && "bg-emerald-500",
                          exp.status === "on_hold" && "bg-rose-500"
                        )}
                      />
                    </div>

                    <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t border-border/40">
                      <span>{formatDate(exp.startDate)} — {formatDate(exp.dueDate)}</span>
                      {exp.recipeId ? (
                        <span className="font-medium text-emerald-600">Reçete kaydedildi</span>
                      ) : (
                        <span>{exp.samples} numune</span>
                      )}
                    </div>

                    {canFinish ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-lg"
                          onClick={() => setExperimentDetail(exp)}
                        >
                          Kullanım / özet
                        </Button>
                        {openExp ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg"
                              onClick={() => setAddMaterialTarget(exp)}
                            >
                              Hammadde ekle
                            </Button>
                            <Button
                              size="sm"
                              className="rounded-lg"
                              onClick={() => setExperimentDetail(exp)}
                            >
                              Tamamla
                            </Button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {labExperiments.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <p className="font-medium">Kayıtlı deney yok</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="samples">
          <Card className="glass-card border-none">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numune No</TableHead>
                    <TableHead>Kaynak</TableHead>
                    <TableHead>Ürün / hammadde</TableHead>
                    <TableHead>Miktar</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead>Analist</TableHead>
                    <TableHead>Alınma</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Sonuç</TableHead>
                    {canFinish ? <TableHead className="text-right">İşlem</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {labSamples.map((sample) => {
                    const disposition =
                      dispositionMap[sample.disposition ?? "open"] ??
                      dispositionMap.open;
                    const openSample = (sample.disposition ?? "open") === "open";
                    return (
                      <TableRow key={sample.id}>
                        <TableCell className="font-mono font-bold">{sample.sampleNo}</TableCell>
                        <TableCell className="text-sm">
                          {sourceKindMap[sample.sourceKind ?? "product"]}
                        </TableCell>
                        <TableCell>{sample.product}</TableCell>
                        <TableCell className="text-sm">
                          {sample.quantity
                            ? `${formatNumber(sample.quantity)} ${sample.unit ?? ""}`
                            : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{sample.batchNo}</TableCell>
                        <TableCell className="text-sm">{sample.analyst}</TableCell>
                        <TableCell>{formatDate(sample.receivedDate)}</TableCell>
                        <TableCell>
                          <Badge variant={disposition.variant} className="gap-1">
                            {sample.disposition === "returned" && <CheckCircle2 className="w-3 h-3" />}
                            {sample.disposition === "scrap" && <XCircle className="w-3 h-3" />}
                            {openSample && <Microscope className="w-3 h-3" />}
                            {disposition.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {sample.result ?? "—"}
                        </TableCell>
                        {canFinish ? (
                          <TableCell className="text-right">
                            {openSample ? (
                              <Button
                                size="sm"
                                className="rounded-lg"
                                onClick={() => setCompleteTarget(sample)}
                              >
                                Testi tamamla
                              </Button>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {labSamples.length === 0 && (
                <div className="py-16 text-center text-muted-foreground">
                  <p className="font-medium">Kayıtlı numune yok</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scrap">
          <Card className="glass-card border-none">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numune No</TableHead>
                    <TableHead>Kaynak</TableHead>
                    <TableHead>Ürün / hammadde</TableHead>
                    <TableHead>Miktar</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead>Analist</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Not</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scrapSamples.map((sample) => (
                    <TableRow key={sample.id}>
                      <TableCell className="font-mono font-bold">{sample.sampleNo}</TableCell>
                      <TableCell className="text-sm">
                        {sourceKindMap[sample.sourceKind ?? "product"]}
                      </TableCell>
                      <TableCell>{sample.product}</TableCell>
                      <TableCell className="text-sm">
                        {sample.quantity
                          ? `${formatNumber(sample.quantity)} ${sample.unit ?? ""}`
                          : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{sample.batchNo}</TableCell>
                      <TableCell className="text-sm">{sample.analyst}</TableCell>
                      <TableCell>{formatDate(sample.receivedDate)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[240px] truncate">
                        {sample.result ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {scrapSamples.length === 0 && (
                <div className="py-16 text-center text-muted-foreground">
                  <p className="font-medium">Iskarta numune yok</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="pb-10" />

      <ExperimentFormSheet
        open={experimentOpen}
        onOpenChange={setExperimentOpen}
        onCreated={() => {
          void refresh();
          setTab("experiments");
        }}
      />
      <ExperimentAddMaterialDialog
        open={Boolean(addMaterialTarget)}
        experiment={addMaterialTarget}
        onOpenChange={(next) => {
          if (!next) setAddMaterialTarget(null);
        }}
        onAdded={() => {
          setAddMaterialTarget(null);
          void refresh();
        }}
      />
      <ExperimentCompleteDialog
        open={Boolean(experimentDetail)}
        experiment={experimentDetail}
        onOpenChange={(next) => {
          if (!next) setExperimentDetail(null);
        }}
        onCompleted={() => {
          setExperimentDetail(null);
          void refresh();
        }}
      />
      <SampleFormSheet
        open={sampleOpen}
        onOpenChange={setSampleOpen}
        onCreated={() => {
          void refresh();
          setTab("samples");
        }}
      />
      <SampleCompleteDialog
        open={Boolean(completeTarget)}
        sample={completeTarget}
        onOpenChange={(next) => {
          if (!next) setCompleteTarget(null);
        }}
        onCompleted={(updated) => {
          setCompleteTarget(null);
          void refresh();
          if (updated.disposition === "scrap") setTab("scrap");
        }}
      />
    </div>
  );
}

export default function RDLabPage() {
  return (
    <Suspense fallback={<div className="p-10 text-muted-foreground">Yükleniyor...</div>}>
      <RDLabPageContent />
    </Suspense>
  );
}
