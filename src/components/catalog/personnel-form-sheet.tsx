"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, UserPlus, UserRoundPen, X } from "lucide-react";
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
import { DEFAULT_DEPARTMENTS } from "@/data/departments";
import type { Personnel } from "@/data/catalog";
import { createCatalog, fetchDepartments, fetchJobTitles, updateCatalog } from "@/lib/catalog-store";
import {
  LAB_WORKER_TITLE,
  parsePersonnelTitles,
  serializePersonnelTitles,
} from "@/lib/personnel";
import { capitalizeWordsTr, cn, selectItemValues, todayIso } from "@/lib/utils";

function emptyForm(row?: Personnel) {
  return {
    firstName: row?.firstName ?? "",
    lastName: row?.lastName ?? "",
    department: row?.department ?? "",
    titles: row ? parsePersonnelTitles(row.title) : [],
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

function titleKey(title: string) {
  return title.trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");
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
  const [customTitle, setCustomTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const [knownTitles, setKnownTitles] = useState<string[]>([]);
  const departmentOptions = useMemo(() => {
    const base = selectItemValues([...DEFAULT_DEPARTMENTS, ...departments]);
    const current = form.department.trim();
    if (current && !base.includes(current)) return [current, ...base];
    return base;
  }, [form.department, departments]);
  const titleOptions = useMemo(() => {
    return selectItemValues([...knownTitles, ...form.titles]);
  }, [knownTitles, form.titles]);

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(editing ?? undefined));
    setCustomTitle("");
    void Promise.all([
      fetchDepartments()
        .then((rows) => setDepartments(selectItemValues(rows.map((r) => r.name))))
        .catch(() => setDepartments([])),
      fetchJobTitles()
        .then((rows) => setKnownTitles(selectItemValues(rows.map((r) => r.name))))
        .catch(() => setKnownTitles([])),
    ]);
  }, [open, editing]);

  function toggleTitle(title: string) {
    const key = titleKey(title);
    setForm((f) => {
      const exists = f.titles.some((t) => titleKey(t) === key);
      if (exists) {
        return { ...f, titles: f.titles.filter((t) => titleKey(t) !== key) };
      }
      return { ...f, titles: [...f.titles, title] };
    });
  }

  function addCustomTitle() {
    const value = customTitle.trim();
    if (!value) return;
    const key = titleKey(value);
    setForm((f) => {
      if (f.titles.some((t) => titleKey(t) === key)) return f;
      return { ...f, titles: [...f.titles, capitalizeWordsTr(value)] };
    });
    setCustomTitle("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const salary = Number(form.salary.replace(",", "."));
    const iban = compactIban(form.iban);
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Ad ve soyad zorunludur");
      return;
    }
    if (!form.department.trim()) {
      toast.error("Departman zorunludur");
      return;
    }
    if (form.titles.length === 0) {
      toast.error("En az bir görev seçin");
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
        firstName: capitalizeWordsTr(form.firstName),
        lastName: capitalizeWordsTr(form.lastName),
        department: form.department.trim(),
        title: serializePersonnelTitles(form.titles),
        email: form.email.trim(),
        phone: form.phone.trim(),
        hireDate: form.hireDate,
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
            description="Birim tek seçilir; görev/unvan birden fazla olabilir."
          >
            <FormField
              label="Departman"
              htmlFor="per-dep"
              required
              hint="Birim listesi sağ üstteki Ayarlar’dan yönetilir."
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

            <FormField
              label="Görev / unvan"
              required
              hint="Birden fazla seçebilirsiniz. Görev listesi Ayarlar’dan yönetilir."
            >
              <div className="flex flex-wrap gap-2">
                {titleOptions.map((title) => {
                  const selected = form.titles.some(
                    (t) => titleKey(t) === titleKey(title)
                  );
                  return (
                    <button
                      key={title}
                      type="button"
                      onClick={() => toggleTitle(title)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors",
                        selected
                          ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                          : "border-border bg-white text-foreground hover:bg-muted/50"
                      )}
                    >
                      {selected ? <Check className="h-3.5 w-3.5" /> : null}
                      {title}
                    </button>
                  );
                })}
              </div>
              {form.titles.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.titles.map((title) => (
                    <span
                      key={title}
                      className="inline-flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs font-medium"
                    >
                      {title}
                      <button
                        type="button"
                        className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                        onClick={() => toggleTitle(title)}
                        aria-label={`${title} kaldır`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-2 flex gap-2">
                <Input
                  id="per-title-custom"
                  autoComplete="organization-title"
                  placeholder={`Örn: ${LAB_WORKER_TITLE}`}
                  className="bg-white"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomTitle();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 rounded-xl"
                  onClick={addCustomTitle}
                >
                  Ekle
                </Button>
              </div>
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
