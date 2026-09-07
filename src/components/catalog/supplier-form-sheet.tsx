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
import type { Supplier } from "@/data/catalog";
import { createCatalog, updateCatalog } from "@/lib/catalog-store";

function emptyForm(row?: Supplier) {
  return {
    name: row?.name ?? "",
    contact: row?.contact ?? "",
    address: row?.address ?? "",
  };
}

export function SupplierFormSheet({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Supplier | null;
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
      toast.error("Firma adı zorunludur");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateCatalog("suppliers", editing.id, form);
        toast.success("Tedarikçi güncellendi");
      } else {
        await createCatalog("suppliers", form);
        toast.success("Tedarikçi eklendi");
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
      title={editing ? "Tedarikçi düzenle" : "Yeni tedarikçi"}
    >
      <form className="flex h-full min-h-0 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody>
          <FormField label="Firma adı" htmlFor="sup-name">
            <Input
              id="sup-name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </FormField>
          <FormField label="İletişim" htmlFor="sup-contact">
            <Input
              id="sup-contact"
              value={form.contact}
              onChange={(e) =>
                setForm((f) => ({ ...f, contact: e.target.value }))
              }
            />
          </FormField>
          <FormField label="Adres" htmlFor="sup-address">
            <Input
              id="sup-address"
              value={form.address}
              onChange={(e) =>
                setForm((f) => ({ ...f, address: e.target.value }))
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
