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
import type { Customer } from "@/data/catalog";
import { createCatalog, updateCatalog } from "@/lib/catalog-store";

function emptyForm(row?: Customer) {
  return {
    name: row?.name ?? "",
    contact: row?.contact ?? "",
    address: row?.address ?? "",
    taxNo: row?.taxNo ?? "",
    email: row?.email ?? "",
    active: row?.active ?? true,
  };
}

export function CustomerFormSheet({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Customer | null;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(emptyForm(editing ?? undefined));
  }, [open, editing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Müşteri adı zorunludur");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateCatalog("customers", editing.id, form);
        toast.success("Müşteri güncellendi");
      } else {
        await createCatalog("customers", form);
        toast.success("Müşteri eklendi");
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
      title={editing ? "Müşteri düzenle" : "Yeni müşteri"}
    >
      <form className="flex h-full min-h-0 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody>
          <FormField label="Müşteri adı" htmlFor="cus-name">
            <Input
              id="cus-name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </FormField>
          <FormField label="İletişim" htmlFor="cus-contact">
            <Input
              id="cus-contact"
              value={form.contact}
              onChange={(e) =>
                setForm((f) => ({ ...f, contact: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Adres" htmlFor="cus-address">
            <Input
              id="cus-address"
              value={form.address}
              onChange={(e) =>
                setForm((f) => ({ ...f, address: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Vergi no" htmlFor="cus-tax">
            <Input
              id="cus-tax"
              value={form.taxNo}
              onChange={(e) => setForm((f) => ({ ...f, taxNo: e.target.value }))}
            />
          </FormField>
          <FormField label="E-posta" htmlFor="cus-email">
            <Input
              id="cus-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
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
