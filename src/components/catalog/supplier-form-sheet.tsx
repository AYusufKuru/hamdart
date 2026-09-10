"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Factory, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormDialog,
  FormField,
  FormSection,
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
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={editing ? Factory : Truck}
      title={editing ? "Tedarikçiyi düzenle" : "Yeni tedarikçi"}
      description="Hammadde ve hizmet alımlarında kullanılacak firma kartını oluşturun."
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
          <FormSection
            title="Firma bilgileri"
            description="Sipariş ve faturalarda görünecek resmi unvan."
          >
            <FormField label="Firma adı" htmlFor="sup-name" required>
              <Input
                id="sup-name"
                required
                placeholder="Örn. BioKimya A.Ş."
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </FormField>
            <FormField label="Adres" htmlFor="sup-address" optional>
              <Input
                id="sup-address"
                placeholder="İlçe, şehir"
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
              />
            </FormField>
            <FormField
              label="Yetkili / telefon"
              htmlFor="sup-contact"
              optional
              hint="İrsaliye ve sipariş teyidi için ulaşılacak kişi."
            >
              <Input
                id="sup-contact"
                placeholder="Ad soyad veya telefon"
                value={form.contact}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contact: e.target.value }))
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
          <Button type="submit" disabled={saving}>
            {saving
              ? "Kaydediliyor…"
              : editing
                ? "Değişiklikleri kaydet"
                : "Tedarikçiyi kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
