"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  labExperiments as seedExperiments,
  labSamples as seedSamples,
  type LabExperiment,
  type LabSample,
} from "@/data/mock";
import { getAllLabExperiments, getAllLabSamples } from "@/lib/lab-store";
import { ExperimentFormSheet } from "@/components/rd-lab/experiment-form-sheet";
import { SampleFormSheet } from "@/components/rd-lab/sample-form-sheet";
import { cn, formatDate } from "@/lib/utils";
import {
  Beaker,
  CheckCircle2,
  FlaskConical,
  Microscope,
  Plus,
  TestTube,
  XCircle,
} from "lucide-react";

const experimentStatusMap = {
  planning: { label: "Planlama", variant: "info" as const },
  running: { label: "Devam Ediyor", variant: "success" as const },
  analysis: { label: "Analiz", variant: "warning" as const },
  approved: { label: "Onaylandı", variant: "success" as const },
  on_hold: { label: "Beklemede", variant: "danger" as const },
};

const sampleStatusMap = {
  received: { label: "Alındı", variant: "info" as const },
  testing: { label: "Test Ediliyor", variant: "warning" as const },
  approved: { label: "Onaylı", variant: "success" as const },
  rejected: { label: "Red", variant: "danger" as const },
};

export default function RDLabPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [labExperiments, setLabExperiments] =
    useState<LabExperiment[]>(seedExperiments);
  const [labSamples, setLabSamples] = useState<LabSample[]>(seedSamples);
  const [experimentOpen, setExperimentOpen] = useState(false);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [tab, setTab] = useState("experiments");

  const refresh = () => {
    setLabExperiments(getAllLabExperiments());
    setLabSamples(getAllLabSamples());
  };

  useEffect(() => {
    refresh();
    const nextTab = searchParams.get("tab");
    if (nextTab === "samples") setTab("samples");
    if (nextTab === "experiments") setTab("experiments");
  }, [searchParams]);

  const activeExperiments = labExperiments.filter(
    (e) => e.status === "running" || e.status === "analysis"
  ).length;
  const approvalRate =
    labSamples.length === 0
      ? 0
      : Math.round(
          (labSamples.filter((s) => s.status === "approved").length /
            labSamples.length) *
            100
        );

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Ar-Ge"
        badgeClassName="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
        title="Ar-Ge Laboratuvarı"
        description="Formülasyon geliştirme, stabilite testleri, numune takibi ve kalite kontrol süreçleri."
        actions={
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
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Aktif Deney", value: activeExperiments, icon: FlaskConical },
          { label: "Toplam Proje", value: labExperiments.length, icon: Beaker },
          { label: "Numune", value: labSamples.length, icon: TestTube },
          {
            label: "Onay Oranı",
            value: `%${approvalRate}`,
            icon: CheckCircle2,
          },
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
        </TabsList>

        <TabsContent value="experiments">
          <div className="grid gap-6 md:grid-cols-2">
            {labExperiments.map((exp) => {
              const status = experimentStatusMap[exp.status] ?? experimentStatusMap.planning;
              return (
                <Card key={exp.id} className="glass-card border-none">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-muted-foreground">{exp.code}</p>
                        <CardTitle className="text-base mt-1 leading-snug">{exp.title}</CardTitle>
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
                      <span>{exp.samples} numune</span>
                    </div>
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
                    <TableHead>Ürün</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead>Analist</TableHead>
                    <TableHead>Alınma</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Sonuç</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {labSamples.map((sample) => {
                    const status = sampleStatusMap[sample.status] ?? sampleStatusMap.received;
                    return (
                      <TableRow
                        key={sample.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => router.push("/factory?tab=batches")}
                      >
                        <TableCell className="font-mono font-bold">{sample.sampleNo}</TableCell>
                        <TableCell>{sample.product}</TableCell>
                        <TableCell className="font-mono text-xs">{sample.batchNo}</TableCell>
                        <TableCell className="text-muted-foreground">{sample.type}</TableCell>
                        <TableCell className="text-sm">{sample.analyst}</TableCell>
                        <TableCell>{formatDate(sample.receivedDate)}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="gap-1">
                            {sample.status === "approved" && <CheckCircle2 className="w-3 h-3" />}
                            {sample.status === "rejected" && <XCircle className="w-3 h-3" />}
                            {sample.status === "testing" && <Microscope className="w-3 h-3" />}
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {sample.result ?? "—"}
                        </TableCell>
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
      </Tabs>

      <div className="pb-10" />

      <ExperimentFormSheet
        open={experimentOpen}
        onOpenChange={setExperimentOpen}
        onCreated={() => {
          refresh();
          setTab("experiments");
        }}
      />
      <SampleFormSheet
        open={sampleOpen}
        onOpenChange={setSampleOpen}
        onCreated={() => {
          refresh();
          setTab("samples");
        }}
      />
    </div>
  );
}
