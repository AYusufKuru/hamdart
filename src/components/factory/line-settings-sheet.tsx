"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormField,
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import {
  productionLines as seedLines,
  type ProductionLine,
  type ProductionLineStatus,
} from "@/data/mock";
import {
  getAllProductionLines,
  updateProductionLine,
} from "@/lib/production-store";

const LINE_STATUS_OPTIONS: { value: ProductionLineStatus; label: string }[] = [
  { value: "active", label: "Aktif" },
  { value: "idle", label: "Boşta" },
  { value: "maintenance", label: "Bakımda" },
  { value: "alert", label: "Uyarı" },
];

interface LineSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  initialLineId?: string;
}

export function LineSettingsSheet({
  open,
  onOpenChange,
  onSaved,
  initialLineId,
}: LineSettingsSheetProps) {
  const [lines, setLines] = useState<ProductionLine[]>(seedLines);
  const [lineId, setLineId] = useState(seedLines[0]?.id ?? "");
  const [form, setForm] = useState(() => {
    const first = seedLines[0];
    return {
      product: first?.product ?? "",
      status: (first?.status ?? "active") as ProductionLineStatus,
      operator: first?.operator === "-" ? "" : (first?.operator ?? ""),
      currentBatch:
        first?.currentBatch === "-" ? "" : (first?.currentBatch ?? ""),
      outputToday: first ? String(first.outputToday) : "",
      targetToday: first ? String(first.targetToday) : "",
      efficiency: first ? String(first.efficiency) : "",
      lastMaintenance: first?.lastMaintenance ?? "",
    };
  });

  useEffect(() => {
    if (!open) return;
    const all = getAllProductionLines();
    setLines(all);
    const preferred =
      (initialLineId && all.find((l) => l.id === initialLineId)) || all[0];
    if (preferred) applyLine(preferred);
  }, [open, initialLineId]);

  function applyLine(line: ProductionLine) {
    setLineId(line.id);
    setForm({
      product: line.product,
      status: line.status,
      operator: line.operator === "-" ? "" : line.operator,
      currentBatch: line.currentBatch === "-" ? "" : line.currentBatch,
      outputToday: String(line.outputToday),
      targetToday: String(line.targetToday),
      efficiency: String(line.efficiency),
      lastMaintenance: line.lastMaintenance,
    });
  }

  function handleSelect(id: string) {
    const line = lines.find((l) => l.id === id);
    if (line) applyLine(line);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const outputToday = parseFloat(form.outputToday);
    const targetToday = parseFloat(form.targetToday);
    const efficiency = parseFloat(form.efficiency);
    if (!lineId) return;
    if (!Number.isFinite(outputToday) || outputToday < 0) {
      toast.error("Günlük çıktı 0 veya daha büyük olmalıdır");
      return;
    }
    if (!Number.isFinite(targetToday) || targetToday < 0) {
      toast.error("Günlük hedef 0 veya daha büyük olmalıdır");
      return;
    }
    if (!Number.isFinite(efficiency) || efficiency < 0 || efficiency > 100) {
      toast.error("Verimlilik 0–100 arasında olmalıdır");
      return;
    }
    if (!form.lastMaintenance) {
      toast.error("Son bakım tarihi zorunludur");
      return;
    }

    try {
      const updated = updateProductionLine(lineId, {
        product: form.product.trim() || "-",
        status: form.status,
        operator: form.operator.trim() || "-",
        currentBatch: form.currentBatch.trim() || "-",
        outputToday,
        targetToday,
        efficiency,
        lastMaintenance: form.lastMaintenance,
      });

      if (!updated) {
        toast.error("Hat bulunamadı");
        return;
      }
      toast.success(`${updated.name} güncellendi`);
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hat güncellenemedi");
    }
  }

  const selected = lines.find((l) => l.id === lineId);

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Hat Ayarları"
      description="Hat kartındaki ürün, operatör, günlük hedef, verimlilik ve bakım tarihi buradan güncellenir."
    >
      <form className="flex flex-1 flex-col min-h-0" noValidate onSubmit={handleSubmit}>
        <FormSheetBody>
          <FormField label="Hat">
            <Select value={lineId || undefined} onValueChange={handleSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Hat seçin" />
              </SelectTrigger>
              <SelectContent>
                {lines.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Ürün" htmlFor="line-product">
            <Input
              id="line-product"
              placeholder="Örn: CardioMax 50mg"
              value={form.product}
              onChange={(e) =>
                setForm((f) => ({ ...f, product: e.target.value }))
              }
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Durum">
              <Select
                value={form.status}
                onValueChange={(status) =>
                  setForm((f) => ({
                    ...f,
                    status: status as ProductionLineStatus,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LINE_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              label="Güncel Batch"
              htmlFor="line-batch"
              hint="Karttaki Batch alanı."
            >
              <Input
                id="line-batch"
                className="font-mono"
                placeholder="BT-2026-0847"
                value={form.currentBatch}
                onChange={(e) =>
                  setForm((f) => ({ ...f, currentBatch: e.target.value }))
                }
              />
            </FormField>
          </div>

          <FormField label="Operatör" htmlFor="line-operator">
            <Input
              id="line-operator"
              placeholder="Örn: Ahmet Yılmaz"
              value={form.operator}
              onChange={(e) =>
                setForm((f) => ({ ...f, operator: e.target.value }))
              }
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Günlük çıktı" htmlFor="line-out">
              <Input
                id="line-out"
                type="number"
                min={0}
                value={form.outputToday}
                onChange={(e) =>
                  setForm((f) => ({ ...f, outputToday: e.target.value }))
                }
              />
            </FormField>
            <FormField label="Günlük hedef" htmlFor="line-target">
              <Input
                id="line-target"
                type="number"
                min={0}
                value={form.targetToday}
                onChange={(e) =>
                  setForm((f) => ({ ...f, targetToday: e.target.value }))
                }
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Verimlilik (%)" htmlFor="line-eff">
              <Input
                id="line-eff"
                type="number"
                min={0}
                max={100}
                value={form.efficiency}
                onChange={(e) =>
                  setForm((f) => ({ ...f, efficiency: e.target.value }))
                }
              />
            </FormField>
            <FormField label="Son bakım" htmlFor="line-maint">
              <Input
                id="line-maint"
                type="date"
                value={form.lastMaintenance}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lastMaintenance: e.target.value }))
                }
              />
            </FormField>
          </div>

          {selected && (
            <p className="text-[11px] text-muted-foreground">
              {selected.name} — değişiklikler hat kartına ve dashboard’a yansır.
            </p>
          )}
        </FormSheetBody>

        <FormSheetFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            İptal
          </Button>
          <Button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
          >
            Ayarları Kaydet
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
