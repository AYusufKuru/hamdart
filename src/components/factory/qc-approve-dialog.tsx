"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormDialog } from "@/components/shared/form-sheet";
import type { BatchMaterialUsage, ProductionBatch } from "@/data/mock";
import { getAllRecipes } from "@/lib/recipe-store";
import { getAllRawMaterials } from "@/lib/raw-material-store";
import {
  estimateRecipeMaterials,
  findRecipeByProductName,
} from "@/lib/recipe-calculations";
import { formatNumber } from "@/lib/utils";
import { ifAllowed } from "@/lib/api-client";
import { useAuth } from "@/lib/auth/auth-context";

type LineForm = BatchMaterialUsage & { actualText: string };

function toLines(usage: BatchMaterialUsage[]): LineForm[] {
  return usage.map((line) => ({
    ...line,
    actualText: String(line.actual ?? line.estimated),
  }));
}

export function QcApproveDialog({
  open,
  batch,
  busy,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  batch: ProductionBatch | null;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (usage: BatchMaterialUsage[]) => Promise<void>;
}) {
  const { canRead } = useAuth();
  const [lines, setLines] = useState<LineForm[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !batch) return;
    if (batch.materialUsage?.length) {
      setLines(toLines(batch.materialUsage));
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const [recipes, materials] = await Promise.all([
          ifAllowed(canRead("recipes"), () => getAllRecipes(), []),
          ifAllowed(canRead("raw_materials"), () => getAllRawMaterials(), []),
        ]);
        const recipe = findRecipeByProductName(recipes, batch.product);
        setLines(
          recipe
            ? toLines(estimateRecipeMaterials(recipe, batch.quantity, materials))
            : []
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [open, batch, canRead]);

  async function submit() {
    const usage: BatchMaterialUsage[] = [];
    for (const line of lines) {
      const actual = parseFloat(line.actualText.replace(",", "."));
      if (!Number.isFinite(actual) || actual < 0) {
        toast.error(`Gerçekleşen miktar girin: ${line.materialName}`);
        return;
      }
      usage.push({
        materialId: line.materialId,
        materialName: line.materialName,
        unit: line.unit,
        estimated: line.estimated,
        actual,
      });
    }
    await onConfirm(usage);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onOpenChange(false);
      }}
      title="KK Onayla"
      description={
        batch
          ? `${batch.batchNo} · ${batch.product} · ${formatNumber(batch.quantity)} ${batch.unit}`
          : undefined
      }
      icon={Check}
      className="max-w-lg"
    >
      <div className="space-y-3 px-5 py-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Tahmini tüketim reçeteden hesaplanır. Kutuya fiilen giden miktarı yazın;
          sevkiyata düşünce stoktan bu değerler düşülür.
        </p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Reçete yükleniyor...</p>
        ) : lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Bu ürün için reçete hammaddesi bulunamadı. Onay yine de verilebilir.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <div className="grid grid-cols-[1fr_7rem_7rem] gap-2 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Hammadde</span>
              <span className="text-right">Tahmini</span>
              <span className="text-right">Giden</span>
            </div>
            <ul className="divide-y">
              {lines.map((line, index) => (
                <li
                  key={`${line.materialName}-${line.unit}-${index}`}
                  className="grid grid-cols-[1fr_7rem_7rem] items-center gap-2 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{line.materialName}</p>
                    <p className="text-[11px] text-muted-foreground">{line.unit}</p>
                  </div>
                  <p className="text-right font-mono text-sm">
                    {formatNumber(line.estimated)}
                  </p>
                  <Input
                    className="h-8 bg-white text-right font-mono"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    disabled={busy}
                    value={line.actualText}
                    onChange={(e) =>
                      setLines((current) =>
                        current.map((row, i) =>
                          i === index ? { ...row, actualText: e.target.value } : row
                        )
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t px-5 py-3">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={busy}
          onClick={() => onOpenChange(false)}
        >
          İptal
        </Button>
        <Button
          type="button"
          className="rounded-xl"
          disabled={busy || loading}
          onClick={() => void submit()}
        >
          Onayla ve sevkiyata ver
        </Button>
      </div>
    </FormDialog>
  );
}
