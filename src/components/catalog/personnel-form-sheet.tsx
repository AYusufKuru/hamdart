"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { UserPlus, UserRoundPen } from "lucide-react";
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
import type { Personnel } from "@/data/catalog";
import { createCatalog, fetchDepartments, updateCatalog } from "@/lib/catalog-store";
import { capitalizeWordsTr, selectItemValues, todayIso } from "@/lib/utils";

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
    iban: row?.iban ? formatIban(row.iban) : "",
  };
}

function formatIban(value: string) {
  const compact = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 26);
  return compact.replace(/(.{4})/g, "$1 ").trim();
}

function compactIban(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
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
    const salary = Number(form.salary.replace(",", "."));
    const iban = compactIban(form.iban);
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Ad ve soyad zorunludur");
      return;
    }
    if (!form.department.trim() || !form.title.trim()) {
      toast.error("Departman ve görev zorunludur");
      return;
    }
    if (!Number.isFinite(salary) || salary < 0) {
      toast.error("Maaş 0 veya daha büyük olmalıdır");
      return;
    }
    if (iban && (iban.length < 15 || iban.length > 34)) {
      toast.error("IBAN 15–34 karakter olmalıdır");
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...form,
        firstName: capitalizeWordsTr(form.firstName),
        lastName: capitalizeWordsTr(form.lastName),
        department: form.department.trim(),
        title: capitalizeWordsTr(form.title),
        email: form.email.trim(),
        phone: form.phone.trim(),
        salary,
        iban,
      };
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
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={editing ? UserRoundPen : UserPlus}
      title={editing ? "Personeli düzenle" : "Yeni personel"}
      description="Kimlik, görev ve iletişim bilgilerini girin. Zorunlu alanlar * ile işaretlidir."
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
          <FormSection
            title="Kişisel bilgiler"
            description="Personelin kimlik kaydında görünecek ad ve soyad."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Ad" htmlFor="per-fn" required>
                <Input
                  id="per-fn"
                  required
                  autoComplete="given-name"
                  placeholder="Ayşe"
                  value={form.firstName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, firstName: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Soyad" htmlFor="per-ln" required>
                <Input
                  id="per-ln"
                  required
                  autoComplete="family-name"
                  placeholder="Yılmaz"
                  value={form.lastName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lastName: e.target.value }))
                  }
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection
            title="Görev"
            description="Çalıştığı birim, unvan ve işe başlama tarihi."
          >
            <FormField
              label="Departman"
              htmlFor="per-dep"
              required
              hint="Birimler Denetim & Yedek > Departmanlar ekranından yönetilir."
            >
              <Select
                value={form.department || undefined}
                onValueChange={(department) =>
                  setForm((f) => ({ ...f, department }))
                }
              >
                <SelectTrigger id="per-dep" className="bg-white">
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Görev / unvan" htmlFor="per-title" required>
                <Input
                  id="per-title"
                  required
                  autoComplete="organization-title"
                  placeholder="Üretim operatörü"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="İşe giriş tarihi" htmlFor="per-hire" required>
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
            </div>
          </FormSection>

          <FormSection
            title="İletişim"
            description="Kurum içi yazışma ve ulaşım bilgileri."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="E-posta" htmlFor="per-email" optional>
                <Input
                  id="per-email"
                  type="email"
                  autoComplete="email"
                  placeholder="ad.soyad@hamdpharma.com"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </FormField>
              <FormField
                label="Telefon"
                htmlFor="per-phone"
                optional
                hint="11 haneli cep veya sabit hat."
              >
                <Input
                  id="per-phone"
                  type="tel"
                  autoComplete="tel"
                  inputMode="numeric"
                  placeholder="05XX XXX XX XX"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))
                  }
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection
            title="Ücret ve ödeme"
            description="Banka ödemesi için aylık maaş ve IBAN."
          >
            <FormField label="Aylık maaş" htmlFor="per-sal" required>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                  ₺
                </span>
                <Input
                  id="per-sal"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  inputMode="decimal"
                  placeholder="0"
                  className="pl-8"
                  value={form.salary}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, salary: e.target.value }))
                  }
                />
              </div>
            </FormField>
            <FormField
              label="IBAN"
              htmlFor="per-iban"
              optional
              hint="TR ile başlayan 26 karakter. Boşluklar otomatik eklenir."
            >
              <Input
                id="per-iban"
                autoComplete="off"
                spellCheck={false}
                placeholder="TR00 0000 0000 0000 0000 0000 00"
                className="font-mono tracking-wide"
                value={form.iban}
                onChange={(e) =>
                  setForm((f) => ({ ...f, iban: formatIban(e.target.value) }))
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
                : "Personeli kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
