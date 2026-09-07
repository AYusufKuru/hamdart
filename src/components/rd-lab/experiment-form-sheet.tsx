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
import type { ExperimentStatus, LabExperiment } from "@/data/mock";
import {
  createLabExperiment,
  EXPERIMENT_STATUSES,
  getLabDepartments,
  getLabResearchers,
  LAB_DEPARTMENTS,
  nextExperimentCode,
} from "@/lib/lab-store";
import { plusDaysIso, todayIso } from "@/lib/utils";

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
  const [researchers, setResearchers] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([
    ...LAB_DEPARTMENTS,
  ]);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm());
    void (async () => {
      const [researcherList, departmentList, code] = await Promise.all([
        getLabResearchers(),
        getLabDepartments(),
        nextExperimentCode(),
      ]);
      setResearchers(researcherList);
      setDepartments(departmentList);
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
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Yeni Deney"
      description="Kod otomatik üretilir. Kartta görünen departman, araştırmacı, ilerleme ve numune sayısı burada girilir."
    >
      <form className="flex flex-1 flex-col min-h-0" noValidate onSubmit={handleSubmit}>
        <FormSheetBody>
          <FormField label="Deney Kodu" htmlFor="exp-code">
            <Input
              id="exp-code"
              required
              className="font-mono"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </FormField>

          <FormField label="Başlık" htmlFor="exp-title">
            <Input
              id="exp-title"
              required
              placeholder="Örn: Hepanorm çözünme testi"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
            />
          </FormField>

          <FormField label="Araştırmacı" htmlFor="exp-researcher">
            <Input
              id="exp-researcher"
              list="exp-researcher-list"
              required
              placeholder="Örn: HİLAL ÇELİK"
              value={form.researcher}
              onChange={(e) =>
                setForm((f) => ({ ...f, researcher: e.target.value }))
              }
            />
            <datalist id="exp-researcher-list">
              {researchers.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Departman">
              <Select
                value={form.department}
                onValueChange={(department) =>
                  setForm((f) => ({ ...f, department }))
                }
              >
                <SelectTrigger>
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
            <FormField label="Öncelik">
              <Select
                value={form.priority}
                onValueChange={(priority) =>
                  setForm((f) => ({
                    ...f,
                    priority: priority as LabExperiment["priority"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Yüksek</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField label="Durum">
            <Select
              value={form.status}
              onValueChange={(status) =>
                setForm((f) => ({ ...f, status: status as ExperimentStatus }))
              }
            >
              <SelectTrigger>
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

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Başlangıç" htmlFor="exp-start">
              <Input
                id="exp-start"
                type="date"
                required
                value={form.startDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startDate: e.target.value }))
                }
              />
            </FormField>
            <FormField label="Bitiş" htmlFor="exp-due">
              <Input
                id="exp-due"
                type="date"
                required
                value={form.dueDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dueDate: e.target.value }))
                }
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="İlerleme (%)"
              htmlFor="exp-progress"
              hint="Karttaki ilerleme çubuğu."
            >
              <Input
                id="exp-progress"
                type="number"
                min={0}
                max={100}
                value={form.progress}
                onChange={(e) =>
                  setForm((f) => ({ ...f, progress: e.target.value }))
                }
              />
            </FormField>
            <FormField
              label="Numune sayısı"
              htmlFor="exp-samples"
              hint="Kartın altındaki numune adedi."
            >
              <Input
                id="exp-samples"
                type="number"
                min={0}
                value={form.samples}
                onChange={(e) =>
                  setForm((f) => ({ ...f, samples: e.target.value }))
                }
              />
            </FormField>
          </div>
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
            Deneyi Oluştur
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
