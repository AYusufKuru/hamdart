"use client";

import {
  rawMaterialOrderStatusConfig,
  successFlowSteps,
  type RawMaterialOrder,
  type RawMaterialOrderStatus,
} from "@/data/raw-material-orders";
import { isFailurePath } from "@/lib/raw-material-order-flow";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";

export function OrderFlowStepper({ order }: { order: RawMaterialOrder }) {
  const failed = isFailurePath(order.status);

  const steps: { status: RawMaterialOrderStatus; label: string }[] = failed
    ? [
        ...successFlowSteps.slice(0, 4).map((s) => ({
          status: s,
          label: rawMaterialOrderStatusConfig[s].label,
        })),
        {
          status: "qc_failed" as const,
          label: rawMaterialOrderStatusConfig.qc_failed.label,
        },
        {
          status: "returned" as const,
          label: rawMaterialOrderStatusConfig.returned.label,
        },
      ]
    : successFlowSteps.map((s) => ({
        status: s,
        label: rawMaterialOrderStatusConfig[s].label,
      }));

  const currentStep = rawMaterialOrderStatusConfig[order.status].step;

  return (
    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-0">
      {steps.map((step, index) => {
        const stepNum = rawMaterialOrderStatusConfig[step.status].step;
        const isDone = stepNum < currentStep;
        const isCurrent = order.status === step.status;
        const isFailedStep =
          step.status === "qc_failed" || step.status === "returned";

        return (
          <div key={step.status} className="flex items-center flex-1 min-w-0">
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold w-full sm:w-auto",
                isDone && !isFailedStep && "bg-emerald-500/10 border-emerald-500/30 text-emerald-800",
                isCurrent && !isFailedStep && "bg-indigo-500/10 border-indigo-500/40 text-indigo-800 ring-2 ring-indigo-500/20",
                isCurrent && isFailedStep && "bg-rose-500/10 border-rose-500/40 text-rose-800 ring-2 ring-rose-500/20",
                isDone && isFailedStep && "bg-rose-500/10 border-rose-500/30 text-rose-800",
                !isDone && !isCurrent && "bg-muted/30 border-border text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px]",
                  isDone && !isFailedStep && "bg-emerald-500 text-white",
                  isDone && isFailedStep && "bg-rose-500 text-white",
                  isCurrent && !isFailedStep && "bg-indigo-500 text-white",
                  isCurrent && isFailedStep && "bg-rose-500 text-white",
                  !isDone && !isCurrent && "bg-muted text-muted-foreground"
                )}
              >
                {isDone ? (
                  isFailedStep && step.status === "qc_failed" ? (
                    <X className="w-3 h-3" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )
                ) : (
                  index + 1
                )}
              </span>
              <span className="truncate">{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div className="hidden sm:block w-4 h-px bg-border mx-1 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
