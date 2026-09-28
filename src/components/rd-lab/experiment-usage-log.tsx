"use client";

import { Badge } from "@/components/ui/badge";
import type { LabExperimentMaterialUsage } from "@/data/mock";
import {
  consumedMaterialTotals,
  groupExperimentSteps,
  latestFormulaTotals,
  stepKindLabel,
  type ExperimentStepKind,
} from "@/lib/lab-experiment-steps";
import { formatDate, formatNumber } from "@/lib/utils";

function kindBadge(kind: ExperimentStepKind) {
  if (kind === "return") return "danger" as const;
  if (kind === "extra") return "warning" as const;
  if (kind === "mixed") return "secondary" as const;
  return "info" as const;
}

export function ExperimentUsageLog({
  usages,
  showNet = true,
}: {
  usages: LabExperimentMaterialUsage[];
  showNet?: boolean;
}) {
  const steps = groupExperimentSteps(usages);
  const recipe = latestFormulaTotals(usages);
  const consumed = consumedMaterialTotals(usages);

  if (steps.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Bu deneyde henüz hammadde adımı yok.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {steps.map((step) => (
          <div key={step.step} className="rounded-xl border px-3 py-2.5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-black">Adım {step.step}</span>
              <Badge variant={kindBadge(step.kind)}>
                {stepKindLabel(step.kind)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDate(step.addedAt)}
              </span>
            </div>
            <ul className="space-y-1 text-sm">
              {step.lines.map((line) => (
                <li
                  key={line.id}
                  className="flex flex-wrap items-baseline justify-between gap-2"
                >
                  <span className="font-medium">{line.materialName}</span>
                  <span className="text-right">
                    <span className="font-bold">
                      {formatNumber(Math.abs(line.quantity))} {line.unit}
                    </span>
                    <span className="ml-1 text-xs text-muted-foreground">
                      kullanıldı
                      {line.lotNo ? ` · lot ${line.lotNo}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {step.reason ? (
              <p className="mt-2 text-xs text-muted-foreground">{step.reason}</p>
            ) : null}
          </div>
        ))}
      </div>

      {showNet ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Reçete (son adım)
            </p>
            <ul className="divide-y rounded-xl border text-sm">
              {recipe.map((row) => (
                <li
                  key={`recipe-${row.materialName}-${row.unit}`}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <span className="font-medium">{row.materialName}</span>
                  <span className="font-bold">
                    {formatNumber(row.quantity)} {row.unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Toplam kullanılan
            </p>
            <ul className="divide-y rounded-xl border text-sm">
              {consumed.map((row) => (
                <li
                  key={`used-${row.materialName}-${row.unit}`}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <span className="font-medium">{row.materialName}</span>
                  <span className="font-bold">
                    {formatNumber(row.quantity)} {row.unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
