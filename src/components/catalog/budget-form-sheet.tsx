"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormField,
  FormSheet,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import type { BudgetRow } from "@/data/catalog";
import { createCatalog, updateCatalog } from "@/lib/catalog-store";

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

  useEffect(() => {
    if (open) setForm(emptyForm(editing ?? undefined));
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
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Bütçe düzenle" : "Yeni bütçe satırı"}
    >
      <form className="flex h-full min-h-0 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody>
          <FormField label="Departman" htmlFor="bud-dep">
            <Input
              id="bud-dep"
              required
              value={form.department}
              onChange={(e) =>
                setForm((f) => ({ ...f, department: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Yıllık bütçe (₺)" htmlFor="bud-ann">
            <Input
              id="bud-ann"
              type="number"
              min={0}
              step="0.01"
              required
              value={form.annual}
              onChange={(e) =>
                setForm((f) => ({ ...f, annual: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Harcanan (₺)" htmlFor="bud-spent">
            <Input
              id="bud-spent"
              type="number"
              min={0}
              step="0.01"
              required
              value={form.spent}
              onChange={(e) =>
                setForm((f) => ({ ...f, spent: e.target.value }))
              }
            />
          </FormField>
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormSheet>
  );
}
