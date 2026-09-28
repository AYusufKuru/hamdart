"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FlaskConical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog, FormField } from "@/components/shared/form-sheet";
import { SearchableSelect } from "@/components/shared/searchable-select";
import { ExperimentUsageLog } from "@/components/rd-lab/experiment-usage-log";
import type { LabExperiment } from "@/data/mock";
import {
  addExperimentStep,
  getLabExperimentMaterials,
  labMaterialTitle,
  type LabPickableMaterial,
} from "@/lib/lab-store";
import { latestFormulaLots, nextExperimentStep } from "@/lib/lab-experiment-steps";
import { getWarehouseName } from "@/data/warehouses";
import { cn, formatNumber } from "@/lib/utils";

type DraftLine = {
  key: string;
  stockItemId: string;
  quantity: string;
};

function emptyLine(): DraftLine {
  return { key: `l-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, stockItemId: "", quantity: "" };
}

function linesFromExperiment(experiment: LabExperiment | null): DraftLine[] {
  const lots = latestFormulaLots(experiment?.materialUsages ?? []);
  if (lots.length === 0) return [emptyLine()];
  return lots.map((lot) => ({
    key: `l-${lot.stockItemId}`,
    stockItemId: lot.stockItemId,
    quantity: String(lot.quantity),
  }));
}

export function ExperimentAddMaterialDialog({
  open,
  experiment,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  experiment: LabExperiment | null;
  onOpenChange: (open: boolean) => void;
  onAdded?: (experiment: LabExperiment) => void;
}) {
  const [current, setCurrent] = useState<LabExperiment | null>(experiment);
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [reason, setReason] = useState("");
  const [materials, setMaterials] = useState<LabPickableMaterial[]>([]);
  const [saving, setSaving] = useState(false);

  const usedLots = useMemo(
    () => latestFormulaLots(current?.materialUsages ?? []),
    [current]
  );
  const nextStep = nextExperimentStep(current?.materialUsages ?? []);

  async function loadMaterials() {
    const list = await getLabExperimentMaterials().catch(
      () => [] as LabPickableMaterial[]
    );
    setMaterials(list);
  }

  useEffect(() => {
    if (!open) return;
    setCurrent(experiment);
    setSaving(false);
    setReason("");
    setLines(linesFromExperiment(experiment));
    void loadMaterials();
  }, [open, experiment]);

  function patchLine(key: string, patch: Partial<DraftLine>) {
    setLines((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addProduct(stockItemId = "", quantity = "") {
    setLines((rows) => {
      if (stockItemId && rows.some((row) => row.stockItemId === stockItemId)) {
        return rows;
      }
      return [...rows, { ...emptyLine(), stockItemId, quantity }];
    });
  }

  async function submit() {
    if (!current) return;
    if (!reason.trim()) {
      toast.error("Bu adımın gözlemini yazın");
      return;
    }
    const chosen: { stockItemId: string; quantity: number }[] = [];
    const totals = new Map<string, number>();
    for (const line of lines) {
      if (!line.stockItemId) continue;
      const quantity = parseFloat(line.quantity.replace(",", "."));
      if (!Number.isFinite(quantity) || quantity <= 0) {
        toast.error("Her ürün için geçerli miktar girin");
        return;
      }
      totals.set(line.stockItemId, (totals.get(line.stockItemId) ?? 0) + quantity);
      chosen.push({ stockItemId: line.stockItemId, quantity });
    }
    if (chosen.length === 0) {
      toast.error("En az bir ürün seçin");
      return;
    }
    for (const [stockItemId, quantity] of totals) {
      const item = materials.find((row) => row.id === stockItemId);
      if (item && item.source === "lot" && quantity > item.quantity) {
        toast.error(
          `${labMaterialTitle(item)}: en fazla ${formatNumber(item.quantity)} ${item.unit}`
        );
        return;
      }
    }

    setSaving(true);
    try {
      const updated = await addExperimentStep(current.id, {
        reason: reason.trim(),
        materials: chosen,
      });
      toast.success(`Adım ${nextStep} kaydedildi: ${chosen.length} ürün stoktan düşüldü`);
      setCurrent(updated);
      setReason("");
      setLines(linesFromExperiment(updated));
      await loadMaterials();
      onAdded?.(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Adım kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  const stockLabel = (item: LabPickableMaterial) => {
    const title = labMaterialTitle(item);
    return `${title} · ${item.lotNo} · ${getWarehouseName(item.warehouseId)} (${formatNumber(item.quantity)} ${item.unit})`;
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) onOpenChange(false);
      }}
      icon={FlaskConical}
      title="Deney adımları"
      description={
        current
          ? `${current.code} · ${current.productName ?? current.title} · sonraki adım ${nextStep}`
          : undefined
      }
      className="max-w-2xl"
    >
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <p className="text-sm text-muted-foreground">
          Bir adımda birden fazla ürün olur. Önceki adımın ürünleri hazır gelir;
          yanına yeni ürün ekleyebilirsiniz. Bu adımdaki miktarlar stoktan düşülür.
          Reçete son adımdaki ürünlerdir.
        </p>

        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Adım adım kullanım
          </p>
          <ExperimentUsageLog usages={current?.materialUsages ?? []} showNet />
        </div>

        {usedLots.length > 0 ? (
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Son adımdaki reçete
            </p>
            <div className="divide-y rounded-xl border">
              {usedLots.map((lot) => (
                <div
                  key={lot.stockItemId}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{lot.materialName}</p>
                    <p className="text-xs text-muted-foreground">Lot {lot.lotNo || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">
                      {formatNumber(lot.quantity)} {lot.unit}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg"
                      disabled={saving || lines.some((row) => row.stockItemId === lot.stockItemId)}
                      onClick={() => addProduct(lot.stockItemId, String(lot.quantity))}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Adıma al
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-4 rounded-xl border p-4">
          <p className="text-sm font-semibold">Yeni adım {nextStep}</p>
          <div className="space-y-3">
            {lines.map((line, index) => {
              const selected = materials.find((item) => item.id === line.stockItemId);
              return (
                <div
                  key={line.key}
                  className="grid grid-cols-1 gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_120px_40px]"
                >
                  <FormField label={index === 0 ? "Ürün" : undefined} required={index === 0}>
                    <SearchableSelect
                      value={line.stockItemId || undefined}
                      onValueChange={(stockItemId) => patchLine(line.key, { stockItemId })}
                      placeholder="Stoktan ürün seçin"
                      searchPlaceholder="Ürün, SKU veya lot ara…"
                      emptyText="Stokta eşleşen ürün yok"
                      options={materials.map((item) => ({
                        value: item.id,
                        label: stockLabel(item),
                        keywords: `${item.name} ${item.sku} ${item.lotNo}`,
                      }))}
                    />
                  </FormField>
                  <FormField
                    label={index === 0 ? "Miktar" : undefined}
                    required={index === 0}
                    hint={
                      selected
                        ? `Stokta ${formatNumber(selected.quantity)} ${selected.unit}`
                        : undefined
                    }
                  >
                    <Input
                      type="number"
                      min={0.0001}
                      step="any"
                      className="bg-white"
                      value={line.quantity}
                      onChange={(e) => patchLine(line.key, { quantity: e.target.value })}
                    />
                  </FormField>
                  <div className={cn(index === 0 ? "pt-7" : "pt-1")}>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="rounded-xl"
                      disabled={saving || lines.length <= 1}
                      onClick={() =>
                        setLines((rows) => rows.filter((row) => row.key !== line.key))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={saving || materials.length === 0}
            onClick={() => addProduct()}
          >
            <Plus className="mr-2 h-4 w-4" />
            Yeni ürün
          </Button>
          <FormField label="Gözlem" htmlFor="exp-step-reason" required>
            <Textarea
              id="exp-step-reason"
              value={reason}
              placeholder="Örn: Acı oldu, MAGNİFUL eklendi"
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t px-5 py-3">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={saving}
          onClick={() => onOpenChange(false)}
        >
          Kapat
        </Button>
        <Button
          type="button"
          className="rounded-xl"
          disabled={saving}
          onClick={() => void submit()}
        >
          Adımı kaydet
        </Button>
      </div>
    </FormDialog>
  );
}
