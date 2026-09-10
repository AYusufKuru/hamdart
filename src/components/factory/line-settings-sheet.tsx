"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormDialog,
  FormField,
  FormSection,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import {
  type ProductionLine,
  type ProductionLineStatus,
} from "@/data/mock";
import {
  getAllProductionLines,
  updateProductionLine,
} from "@/lib/production-store";
import { capitalizeWordsTr, formatNumber } from "@/lib/utils";

const LINE_STATUS_OPTIONS: {
  value: ProductionLineStatus;
  label: string;
  hint: string;
  color: string;
}[] = [
  { value: "active", label: "Aktif", hint: "Hat çalışıyor", color: "bg-emerald-500" },
  { value: "idle", label: "Boşta", hint: "Beklemede, iş yok", color: "bg-slate-400" },
  { value: "maintenance", label: "Bakımda", hint: "Üretim durduruldu", color: "bg-amber-500" },
  { value: "alert", label: "Uyarı", hint: "Müdahale gerekir", color: "bg-rose-500" },
];

function statusMeta(value: ProductionLineStatus) {
  return LINE_STATUS_OPTIONS.find((s) => s.value === value) ?? LINE_STATUS_OPTIONS[0];
}

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
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [lineId, setLineId] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product: "",
    status: "active" as ProductionLineStatus,
    operator: "",
    currentBatch: "",
    outputToday: "",
    targetToday: "",
    efficiency: "",
    lastMaintenance: "",
  });

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    void (async () => {
      const all = await getAllProductionLines();
      setLines(all);
      const preferred =
        (initialLineId && all.find((l) => l.id === initialLineId)) || all[0];
      if (preferred) applyLine(preferred);
    })();
  }, [open, initialLineId]);

  function applyLine(line: ProductionLine) {
    setLineId(line.id);
    setForm({
      product: line.product === "-" ? "" : line.product,
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

  const selected = lines.find((l) => l.id === lineId);
  const outputToday = Number(form.outputToday);
  const targetToday = Number(form.targetToday);
  const progressPct = useMemo(() => {
    if (!Number.isFinite(outputToday) || !Number.isFinite(targetToday) || targetToday <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((outputToday / targetToday) * 100));
  }, [outputToday, targetToday]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const output = parseFloat(form.outputToday);
    const target = parseFloat(form.targetToday);
    const efficiency = parseFloat(form.efficiency);
    if (!lineId) {
      toast.error("Önce bir hat seçin");
      return;
    }
    if (!Number.isFinite(output) || output < 0) {
      toast.error("Günlük çıktı 0 veya daha büyük olmalıdır");
      return;
    }
    if (!Number.isFinite(target) || target < 0) {
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

    setSaving(true);
    try {
      const updated = await updateProductionLine(lineId, {
        product: capitalizeWordsTr(form.product) || "-",
        status: form.status,
        operator: capitalizeWordsTr(form.operator) || "-",
        currentBatch: form.currentBatch.trim() || "-",
        outputToday: output,
        targetToday: target,
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
    } finally {
      setSaving(false);
    }
  }

  const currentStatus = statusMeta(form.status);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Settings2}
      title="Hat ayarları"
      description="Seçtiğiniz hattın kartındaki ürün, durum, hedef ve bakım bilgilerini günceller."
      className="max-w-2xl"
    >
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
          <FormSection
            title="Hangi hat?"
            description="Değişiklikler yalnızca seçilen hattın kartına yazılır."
          >
            <FormField label="Üretim hattı" htmlFor="line-pick" required>
              <Select value={lineId || undefined} onValueChange={handleSelect}>
                <SelectTrigger id="line-pick" className="bg-white">
                  <SelectValue placeholder="Hat seçin" />
                </SelectTrigger>
                <SelectContent>
                  {lines.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.code ? `${l.code} · ${l.name}` : l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {selected ? (
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Düzenlenen hat:{" "}
                <span className="font-semibold text-foreground">{selected.name}</span>
                {selected.code ? ` (${selected.code})` : ""}
              </p>
            ) : null}
          </FormSection>

          <FormSection
            title="Kart bilgileri"
            description="Hat kartında görünen ürün, batch, durum ve operatör."
          >
            <FormField label="Ürün" htmlFor="line-product">
              <Input
                id="line-product"
                className="bg-white"
                placeholder="Örn. Hepanorm 30 Tablet"
                value={form.product}
                onChange={(e) =>
                  setForm((f) => ({ ...f, product: e.target.value }))
                }
              />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                label="Durum"
                hint={currentStatus.hint}
              >
                <Select
                  value={form.status}
                  onValueChange={(status) =>
                    setForm((f) => ({
                      ...f,
                      status: status as ProductionLineStatus,
                    }))
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LINE_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <span className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${s.color}`}
                            aria-hidden
                          />
                          {s.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label="Güncel batch"
                htmlFor="line-batch"
                optional
                hint="Boş bırakılırsa kartta — görünür."
              >
                <Input
                  id="line-batch"
                  className="bg-white font-mono"
                  placeholder="BT-2026-0847"
                  value={form.currentBatch}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, currentBatch: e.target.value }))
                  }
                />
              </FormField>
            </div>
            <FormField
              label="Operatör"
              htmlFor="line-operator"
              optional
              hint="Hat başındaki sorumlu kişi."
            >
              <Input
                id="line-operator"
                className="bg-white"
                autoComplete="name"
                placeholder="Örn. Melek Parlak"
                value={form.operator}
                onChange={(e) =>
                  setForm((f) => ({ ...f, operator: e.target.value }))
                }
              />
            </FormField>
          </FormSection>

          <FormSection
            title="Günlük üretim"
            description="Bugünkü çıktı ve hedef; ilerleme çubuğu karttaki günlük çıktıya karşılık gelir."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Bugünkü çıktı" htmlFor="line-out" required>
                <Input
                  id="line-out"
                  className="bg-white"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={form.outputToday}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, outputToday: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Günlük hedef" htmlFor="line-target" required>
                <Input
                  id="line-target"
                  className="bg-white"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={form.targetToday}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, targetToday: e.target.value }))
                  }
                />
              </FormField>
            </div>
            <div className="space-y-2 rounded-xl bg-white/70 px-3 py-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-muted-foreground">
                  Hedefe ilerleme
                </span>
                <span className="font-bold tabular-nums">
                  {Number.isFinite(outputToday) ? formatNumber(outputToday) : "0"}
                  {" / "}
                  {Number.isFinite(targetToday) ? formatNumber(targetToday) : "0"}
                  {" · %"}
                  {progressPct}
                </span>
              </div>
              <Progress value={progressPct} className="h-2.5" />
            </div>
            <FormField
              label="Verimlilik"
              htmlFor="line-eff"
              required
              hint="Kartın altındaki verimlilik yüzdesi. 0–100 arası."
            >
              <div className="relative">
                <Input
                  id="line-eff"
                  className="bg-white pr-8"
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  value={form.efficiency}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, efficiency: e.target.value }))
                  }
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  %
                </span>
              </div>
            </FormField>
          </FormSection>

          <FormSection
            title="Bakım"
            description="Son bakım tarihi hat kartının altında görünür."
          >
            <FormField label="Son bakım tarihi" htmlFor="line-maint" required>
              <Input
                id="line-maint"
                className="bg-white"
                type="date"
                required
                value={form.lastMaintenance}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lastMaintenance: e.target.value }))
                }
              />
            </FormField>
          </FormSection>
        </FormSheetBody>

        <FormSheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Vazgeç
          </Button>
          <Button type="submit" disabled={saving || !lineId}>
            {saving ? "Kaydediliyor…" : "Ayarları kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
