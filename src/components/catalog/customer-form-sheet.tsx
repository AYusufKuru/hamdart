"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, Contact } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormDialog,
  FormField,
  FormSection,
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
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={editing ? Contact : Building2}
      title={editing ? "Müşteriyi düzenle" : "Yeni müşteri"}
      description="Cari kart için firma ve iletişim bilgilerini girin. Zorunlu alanlar * ile işaretlidir."
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
          <FormSection
            title="Firma"
            description="Faturalarda ve siparişlerde görünecek resmi unvan."
          >
            <FormField label="Müşteri adı" htmlFor="cus-name" required>
              <Input
                id="cus-name"
                required
                placeholder="Örn. Anadolu Eczanesi"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Vergi no" htmlFor="cus-tax" optional>
                <Input
                  id="cus-tax"
                  placeholder="10 veya 11 hane"
                  value={form.taxNo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, taxNo: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Adres" htmlFor="cus-address" optional>
                <Input
                  id="cus-address"
                  placeholder="İlçe, şehir"
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                />
              </FormField>
            </div>
          </FormSection>
          <FormSection title="İletişim">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Yetkili / telefon" htmlFor="cus-contact" optional>
                <Input
                  id="cus-contact"
                  placeholder="Ad soyad veya telefon"
                  value={form.contact}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contact: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="E-posta" htmlFor="cus-email" optional>
                <Input
                  id="cus-email"
                  type="email"
                  placeholder="info@firma.com"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
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
            onClick={() => onOpenChange(false)}
          >
            Vazgeç
          </Button>
          <Button type="submit" disabled={saving}>
            {saving
              ? "Kaydediliyor…"
              : editing
                ? "Değişiklikleri kaydet"
                : "Müşteriyi kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
