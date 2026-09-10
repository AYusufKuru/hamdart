"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Landmark, Wallet } from "lucide-react";
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
import type { BudgetRow } from "@/data/catalog";
import { createCatalog, fetchDepartments, updateCatalog } from "@/lib/catalog-store";
import { selectItemValues } from "@/lib/utils";

function emptyForm(row?: BudgetRow) {
  return {
    department: row?.department ?? "",
    annual: row ? String(row.annual) : "",
    spent: row ? String(row.spent) : "0",
  };
}

export function BudgetFormSheet({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: BudgetRow | null;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const departmentOptions = useMemo(() => {
    const base = selectItemValues(departments);
    const current = form.department.trim();
    if (current && !base.includes(current)) return [current, ...base];
    return base;
  }, [form.department, departments]);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(editing ?? undefined));
    void fetchDepartments()
      .then((rows) => setDepartments(selectItemValues(rows.map((r) => r.name))))
      .catch(() => setDepartments([]));
  }, [open, editing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const annual = Number(form.annual);
    const spent = Number(form.spent);
    if (!form.department.trim()) {
      toast.error("Departman zorunludur");
      return;
    }
    if (!Number.isFinite(annual) || annual < 0 || !Number.isFinite(spent) || spent < 0) {
      toast.error("Tutarlar 0 veya daha büyük olmalıdır");
      return;
    }
    setSaving(true);
    try {
      const body = { department: form.department.trim(), annual, spent };
      if (editing) {
        await updateCatalog("budget", editing.id, body);
        toast.success("Bütçe güncellendi");
      } else {
        await createCatalog("budget", body);
        toast.success("Bütçe eklendi");
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kayıt kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={editing ? Wallet : Landmark}
      title={editing ? "Bütçeyi düzenle" : "Yeni bütçe satırı"}
      description="Departmanın yıllık ödeneğini ve bugüne kadar harcanan tutarı girin."
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
          <FormSection title="Departman">
            <FormField
              label="Departman"
              htmlFor="bud-dep"
              required
              hint="Birimler Denetim & Yedek > Departmanlar ekranından yönetilir."
            >
              <Select
                value={form.department || undefined}
                onValueChange={(department) =>
                  setForm((f) => ({ ...f, department }))
                }
              >
                <SelectTrigger id="bud-dep" className="bg-white">
                  <SelectValue placeholder="Birim seçin" />
                </SelectTrigger>
                <SelectContent>
                  {departmentOptions.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </FormSection>
          <FormSection
            title="Tutarlar"
            description="Harcanan, yıllık ödeneği geçemez; aşım listede ayrıca görünür."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Yıllık bütçe" htmlFor="bud-ann" required>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                    ₺
                  </span>
                  <Input
                    id="bud-ann"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    placeholder="0"
                    className="pl-8"
                    value={form.annual}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, annual: e.target.value }))
                    }
                  />
                </div>
              </FormField>
              <FormField label="Harcanan" htmlFor="bud-spent" required>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                    ₺
                  </span>
                  <Input
                    id="bud-spent"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    placeholder="0"
                    className="pl-8"
                    value={form.spent}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, spent: e.target.value }))
                    }
                  />
                </div>
              </FormField>
            </div>
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
          <Button type="submit" disabled={saving}>
            {saving
              ? "Kaydediliyor…"
              : editing
                ? "Değişiklikleri kaydet"
                : "Bütçeyi kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
