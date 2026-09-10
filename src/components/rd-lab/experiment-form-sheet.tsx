"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Microscope } from "lucide-react";
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
  FormDialog,
  FormField,
  FormSection,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import type { ExperimentStatus, LabExperiment } from "@/data/mock";
import {
  createLabExperiment,
  EXPERIMENT_STATUSES,
  getLabDepartments,
  getLabResearchers,
  LAB_DEPARTMENTS,
  nextExperimentCode,
} from "@/lib/lab-store";
import { plusDaysIso, selectItemValues, todayIso } from "@/lib/utils";

function emptyForm() {
  return {
    code: "",
    title: "",
    researcher: "",
    department: "Formülasyon",
    status: "planning" as ExperimentStatus,
    startDate: todayIso(),
    dueDate: plusDaysIso(45),
    progress: "0",
    samples: "0",
    priority: "normal" as LabExperiment["priority"],
  };
}

interface ExperimentFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function ExperimentFormSheet({
  open,
  onOpenChange,
  onCreated,
}: ExperimentFormSheetProps) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [researchers, setResearchers] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([...LAB_DEPARTMENTS]);

  const researcherOptions = useMemo(() => {
    const base = selectItemValues(researchers);
    const current = form.researcher.trim();
    if (current && !base.includes(current)) return [current, ...base];
    return base;
  }, [form.researcher, researchers]);

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    setForm(emptyForm());
    void (async () => {
      const [researcherList, departmentList, code] = await Promise.all([
        getLabResearchers(),
        getLabDepartments(),
        nextExperimentCode(),
      ]);
      setResearchers(selectItemValues(researcherList));
      setDepartments(selectItemValues(departmentList));
      setForm((f) => ({ ...f, code }));
    })();
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const progress = parseFloat(form.progress);
    const samples = parseInt(form.samples, 10);
    if (!form.title.trim() || !form.researcher.trim()) {
      toast.error("Başlık ve araştırmacı zorunludur");
      return;
    }
    if (form.dueDate < form.startDate) {
      toast.error("Bitiş tarihi başlangıçtan önce olamaz");
      return;
    }
    if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
      toast.error("İlerleme 0–100 arasında olmalıdır");
      return;
    }
    if (!Number.isFinite(samples) || samples < 0) {
      toast.error("Numune sayısı 0 veya daha büyük olmalıdır");
      return;
    }

    setSaving(true);
    try {
      const created = await createLabExperiment({
        code: form.code,
        title: form.title,
        researcher: form.researcher,
        department: form.department,
        status: form.status,
        startDate: form.startDate,
        dueDate: form.dueDate,
        progress,
        samples,
        priority: form.priority,
      });

      toast.success(`${created.code} oluşturuldu`);
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deney kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={Microscope}
      title="Yeni deney"
      description="Kod otomatik üretilir. Karttaki departman, ilerleme ve numune sayısı burada girilir."
      className="max-w-2xl"
    >
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
          <FormSection title="Deney bilgisi">
            <FormField label="Deney kodu" htmlFor="exp-code" required>
              <Input
                id="exp-code"
                required
                className="bg-white font-mono"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
            </FormField>
            <FormField label="Başlık" htmlFor="exp-title" required>
              <Input
                id="exp-title"
                required
                className="bg-white"
                placeholder="Örn: Hepanorm çözünme testi"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </FormField>
            <FormField label="Araştırmacı" htmlFor="exp-researcher" required>
              {researcherOptions.length > 0 ? (
                <Select
                  value={form.researcher || undefined}
                  onValueChange={(researcher) =>
                    setForm((f) => ({ ...f, researcher }))
                  }
                >
                  <SelectTrigger id="exp-researcher" className="bg-white">
                    <SelectValue placeholder="Araştırmacı seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {researcherOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="exp-researcher"
                  required
                  className="bg-white"
                  placeholder="Örn: HİLAL ÇELİK"
                  value={form.researcher}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, researcher: e.target.value }))
                  }
                />
              )}
            </FormField>
          </FormSection>

          <FormSection title="Organizasyon">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Departman" required>
                <Select
                  value={form.department}
                  onValueChange={(department) =>
                    setForm((f) => ({ ...f, department }))
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Öncelik" required>
                <Select
                  value={form.priority}
                  onValueChange={(priority) =>
                    setForm((f) => ({
                      ...f,
                      priority: priority as LabExperiment["priority"],
                    }))
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Yüksek</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField label="Durum" required>
              <Select
                value={form.status}
                onValueChange={(status) =>
                  setForm((f) => ({ ...f, status: status as ExperimentStatus }))
                }
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPERIMENT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </FormSection>

          <FormSection title="Takvim ve ilerleme">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Başlangıç" htmlFor="exp-start" required>
                <Input
                  id="exp-start"
                  type="date"
                  required
                  className="bg-white"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Bitiş" htmlFor="exp-due" required>
                <Input
                  id="exp-due"
                  type="date"
                  required
                  className="bg-white"
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dueDate: e.target.value }))
                  }
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="İlerleme" htmlFor="exp-progress" hint="Karttaki ilerleme çubuğu (%).">
                <div className="relative">
                  <Input
                    id="exp-progress"
                    type="number"
                    min={0}
                    max={100}
                    className="bg-white pr-8"
                    value={form.progress}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, progress: e.target.value }))
                    }
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                    %
                  </span>
                </div>
              </FormField>
              <FormField label="Numune sayısı" htmlFor="exp-samples" hint="Kartın altındaki numune adedi.">
                <Input
                  id="exp-samples"
                  type="number"
                  min={0}
                  className="bg-white"
                  value={form.samples}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, samples: e.target.value }))
                  }
                />
              </FormField>
            </div>
          </FormSection>
        </FormSheetBody>

        <FormSheetFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Vazgeç
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-blue-500 border-none"
          >
            {saving ? "Kaydediliyor…" : "Deneyi oluştur"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
