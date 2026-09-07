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
import type { Personnel } from "@/data/catalog";
import { createCatalog, updateCatalog } from "@/lib/catalog-store";
import { todayIso } from "@/lib/utils";

function emptyForm(row?: Personnel) {
  return {
    firstName: row?.firstName ?? "",
    lastName: row?.lastName ?? "",
    department: row?.department ?? "",
    title: row?.title ?? "",
    email: row?.email ?? "",
    phone: row?.phone ?? "",
    hireDate: row?.hireDate || todayIso(),
    salary: row?.salary != null ? String(row.salary) : "",
    iban: row?.iban ?? "",
  };
}

export function PersonnelFormSheet({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Personnel | null;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(emptyForm(editing ?? undefined));
  }, [open, editing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const salary = Number(form.salary);
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Ad ve soyad zorunludur");
      return;
    }
    if (!Number.isFinite(salary) || salary < 0) {
      toast.error("Maaş 0 veya daha büyük olmalıdır");
      return;
    }
    setSaving(true);
    try {
      const body = { ...form, salary };
      if (editing) {
        await updateCatalog("personnel", editing.id, body);
        toast.success("Personel güncellendi");
      } else {
        await createCatalog("personnel", body);
        toast.success("Personel eklendi");
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
      title={editing ? "Personel düzenle" : "Yeni personel"}
    >
      <form className="flex h-full min-h-0 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Ad" htmlFor="per-fn">
              <Input
                id="per-fn"
                required
                value={form.firstName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, firstName: e.target.value }))
                }
              />
            </FormField>
            <FormField label="Soyad" htmlFor="per-ln">
              <Input
                id="per-ln"
                required
                value={form.lastName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lastName: e.target.value }))
                }
              />
            </FormField>
          </div>
          <FormField label="Departman" htmlFor="per-dep">
            <Input
              id="per-dep"
              required
              value={form.department}
              onChange={(e) =>
                setForm((f) => ({ ...f, department: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Görev" htmlFor="per-title">
            <Input
              id="per-title"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </FormField>
          <FormField label="E-posta" htmlFor="per-email">
            <Input
              id="per-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </FormField>
          <FormField label="Telefon" htmlFor="per-phone">
            <Input
              id="per-phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </FormField>
          <FormField label="İşe giriş" htmlFor="per-hire">
            <Input
              id="per-hire"
              type="date"
              required
              value={form.hireDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, hireDate: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Maaş (₺)" htmlFor="per-sal">
            <Input
              id="per-sal"
              type="number"
              min={0}
              step="0.01"
              required
              value={form.salary}
              onChange={(e) =>
                setForm((f) => ({ ...f, salary: e.target.value }))
              }
            />
          </FormField>
          <FormField label="IBAN" htmlFor="per-iban">
            <Input
              id="per-iban"
              value={form.iban}
              onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))}
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
