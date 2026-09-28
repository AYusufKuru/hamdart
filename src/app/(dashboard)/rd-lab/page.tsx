"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { type LabExperiment } from "@/data/mock";
import { getAllLabExperiments } from "@/lib/lab-store";
import { ExperimentFormSheet } from "@/components/rd-lab/experiment-form-sheet";
import { ExperimentAddMaterialDialog } from "@/components/rd-lab/experiment-add-material-dialog";
import { ExperimentCompleteDialog } from "@/components/rd-lab/experiment-complete-dialog";
import { ExperimentSaveRecipeDialog } from "@/components/rd-lab/experiment-save-recipe-dialog";
import { CanWrite } from "@/components/auth/can-write";
import { useAuth } from "@/lib/auth/auth-context";
import { experimentStepCount } from "@/lib/lab-experiment-steps";
import { cn, formatDate } from "@/lib/utils";
import { Beaker, FlaskConical, Plus } from "lucide-react";

const experimentStatusMap = {
  planning: { label: "Planlama", variant: "info" as const },
  running: { label: "Devam Ediyor", variant: "success" as const },
  analysis: { label: "Analiz", variant: "warning" as const },
  approved: { label: "Onaylandı", variant: "success" as const },
  on_hold: { label: "Beklemede", variant: "danger" as const },
};

export default function RDLabPage() {
  const { canWrite } = useAuth();
  const [labExperiments, setLabExperiments] = useState<LabExperiment[]>([]);
  const [experimentOpen, setExperimentOpen] = useState(false);
  const [addMaterialTarget, setAddMaterialTarget] = useState<LabExperiment | null>(null);
  const [experimentDetail, setExperimentDetail] = useState<LabExperiment | null>(null);
  const [saveRecipeTarget, setSaveRecipeTarget] = useState<LabExperiment | null>(null);
  const canFinish = canWrite("lab");

  const refresh = async () => {
    setLabExperiments(await getAllLabExperiments());
  };

  useEffect(() => {
    void refresh();
  }, []);

  const activeExperiments = labExperiments.filter(
    (e) => e.status === "running" || e.status === "analysis"
  ).length;

  return (
    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 min-h-full">
      <PageHeader
        badge="Ar-Ge"
        badgeClassName="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
        title="Ar-Ge Laboratuvarı"
        description="Reçete geliştirme deneyleri ve hammadde tüketimi."
        actions={
          <CanWrite resource="lab">
            <Button
              className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
              onClick={() => setExperimentOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Yeni Deney
            </Button>
          </CanWrite>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { label: "Aktif Deney", value: activeExperiments, icon: FlaskConical },
          { label: "Toplam Proje", value: labExperiments.length, icon: Beaker },
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

      <div className="grid gap-6 md:grid-cols-2">
        {labExperiments.map((exp) => {
          const status = experimentStatusMap[exp.status] ?? experimentStatusMap.planning;
          const stepCount = experimentStepCount(exp.materialUsages);
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
                    {stepCount} adım
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
                          Hammadde adımı
                        </Button>
                        <Button
                          size="sm"
                          className="rounded-lg"
                          onClick={() => setExperimentDetail(exp)}
                        >
                          Tamamla
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="rounded-lg"
                        onClick={() => setSaveRecipeTarget(exp)}
                      >
                        Reçetelere ekle
                      </Button>
                    )}
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

      <div className="pb-10" />

      <ExperimentFormSheet
        open={experimentOpen}
        onOpenChange={setExperimentOpen}
        onCreated={() => void refresh()}
      />
      <ExperimentAddMaterialDialog
        open={Boolean(addMaterialTarget)}
        experiment={addMaterialTarget}
        onOpenChange={(next) => {
          if (!next) setAddMaterialTarget(null);
        }}
        onAdded={() => void refresh()}
      />
      <ExperimentSaveRecipeDialog
        open={Boolean(saveRecipeTarget)}
        experiment={saveRecipeTarget}
        onOpenChange={(next) => {
          if (!next) setSaveRecipeTarget(null);
        }}
        onSaved={() => {
          setSaveRecipeTarget(null);
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
    </div>
  );
}
