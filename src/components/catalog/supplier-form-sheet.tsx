"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Factory,
  Phone,
  Shield,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FormDialog,
  FormField,
  FormSection,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import { SearchableSelect } from "@/components/shared/searchable-select";
import type { Supplier } from "@/data/catalog";
import {
  TURKEY_DISTRICTS,
  TURKEY_PROVINCES,
} from "@/data/turkey-locations";
import { createCatalog, fetchPersonnel, updateCatalog } from "@/lib/catalog-store";
import { personnelDisplayName } from "@/lib/personnel";
import {
  emptyGuarantors,
  emptyRelatives,
  parseGuarantors,
  parseRelatives,
  SUPPLIER_ACCOUNT_KINDS,
  SUPPLIER_ACCOUNT_LISTS,
  SUPPLIER_BALANCE_TYPES,
  SUPPLIER_CURRENCIES,
  SUPPLIER_PRICE_LISTS,
} from "@/lib/supplier-card";
import { selectItemValues } from "@/lib/utils";

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

function emptyForm(row?: Supplier) {
  return {
    name: row?.name ?? "",
    invoiceName: row?.invoiceName ?? "",
    accountList: row?.accountList || "Tedarikçi",
    currency: row?.currency || "TL",
    accountCode: row?.accountCode ?? "",
    onlineTransactions: row?.onlineTransactions ?? true,
    notes: row?.notes ?? "",
    iban: row?.iban ? formatIban(row.iban) : "",
    country: row?.country || "Türkiye",
    city: row?.city ?? "",
    district: row?.district ?? "",
    address: row?.address ?? "",
    mobile: row?.mobile ? formatPhone(row.mobile) : "",
    email: row?.email ?? "",
    landline: row?.landline ? formatPhone(row.landline) : "",
    accountKind: row?.accountKind || "Gerçek kişi / Şahıs Firması",
    taxNo: row?.taxNo ?? "",
    taxOffice: row?.taxOffice ?? "",
    nationalId: row?.nationalId ?? "",
    openingBalance:
      row?.openingBalance != null && row.openingBalance !== 0
        ? String(row.openingBalance)
        : "",
    openingBalanceType: row?.openingBalanceType || "Borçlu",
    paymentTermDays:
      row?.paymentTermDays != null && row.paymentTermDays !== 0
        ? String(row.paymentTermDays)
        : "",
    creditLimit:
      row?.creditLimit != null && row.creditLimit !== 0
        ? String(row.creditLimit)
        : "",
    salesPriceList: row?.salesPriceList || "1. Satış Fiyatı",
    branch: row?.branch || "Merkez Şube",
    assignedPersonnel: row?.assignedPersonnel ?? "",
    paymentTaxNo: row?.paymentTaxNo ?? "",
    relatives: row ? parseRelatives(row.relatives) : emptyRelatives(),
    guarantors: row ? parseGuarantors(row.guarantors) : emptyGuarantors(),
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
  const [tab, setTab] = useState("definition");
  const [saving, setSaving] = useState(false);
  const [showInvoiceName, setShowInvoiceName] = useState(false);
  const [showTaxLookup, setShowTaxLookup] = useState(false);
  const [staffNames, setStaffNames] = useState<string[]>([]);

  const districtOptions = useMemo(() => {
    const list = TURKEY_DISTRICTS[form.city] ?? [];
    if (form.district && !list.includes(form.district)) {
      return [form.district, ...list];
    }
    return list;
  }, [form.city, form.district]);

  useEffect(() => {
    if (!open) return;
    const next = emptyForm(editing ?? undefined);
    setForm(next);
    setTab("definition");
    setShowInvoiceName(Boolean(editing?.invoiceName));
    setShowTaxLookup(Boolean(editing?.taxNo || editing?.nationalId));
    setSaving(false);
    void fetchPersonnel()
      .then((rows) =>
        setStaffNames(
          selectItemValues(rows.map((p) => personnelDisplayName(p)))
        )
      )
      .catch(() => setStaffNames([]));
  }, [open, editing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Hesap adı zorunludur");
      setTab("definition");
      return;
    }
    const iban = compactIban(form.iban);
    if (iban && (iban.length < 15 || iban.length > 34)) {
      toast.error("IBAN 15–34 karakter olmalıdır");
      setTab("definition");
      return;
    }
    const openingBalance = form.openingBalance
      ? Number(form.openingBalance.replace(",", "."))
      : 0;
    const creditLimit = form.creditLimit
      ? Number(form.creditLimit.replace(",", "."))
      : 0;
    const paymentTermDays = form.paymentTermDays
      ? Number(form.paymentTermDays)
      : 0;
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      toast.error("Devir bakiye 0 veya daha büyük olmalıdır");
      setTab("finance");
      return;
    }
    if (!Number.isFinite(creditLimit) || creditLimit < 0) {
      toast.error("Borç limiti 0 veya daha büyük olmalıdır");
      setTab("finance");
      return;
    }
    if (!Number.isInteger(paymentTermDays) || paymentTermDays < 0) {
      toast.error("Vade gün sayısı 0 veya daha büyük tam sayı olmalıdır");
      setTab("finance");
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        invoiceName: showInvoiceName ? form.invoiceName.trim() : "",
        accountList: form.accountList,
        currency: form.currency,
        accountCode: form.accountCode.trim(),
        onlineTransactions: form.onlineTransactions,
        notes: form.notes.trim(),
        iban,
        country: form.country,
        city: form.city,
        district: form.district,
        address: form.address.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim(),
        landline: form.landline.trim(),
        contact: form.mobile.trim() || form.landline.trim(),
        accountKind: form.accountKind,
        taxNo: form.taxNo.trim(),
        taxOffice: form.taxOffice.trim(),
        nationalId: form.nationalId.trim(),
        openingBalance,
        openingBalanceType: form.openingBalanceType,
        paymentTermDays,
        creditLimit,
        salesPriceList: form.salesPriceList,
        branch: form.branch.trim() || "Merkez Şube",
        assignedPersonnel: form.assignedPersonnel,
        paymentTaxNo: form.paymentTaxNo.trim(),
        relatives: form.relatives,
        guarantors: form.guarantors,
      };
      if (editing) {
        await updateCatalog("suppliers", editing.id, body);
        toast.success("Tedarikçi güncellendi");
      } else {
        await createCatalog("suppliers", body);
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
      title={editing ? "Tedarikçiyi düzenle" : "Yeni hesap"}
      description="Tedarikçi kartını bölüm bölüm doldurun. Yalnızca hesap adı zorunludur."
      className="max-w-3xl max-h-[min(92dvh,56rem)]"
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 border-b px-4 pt-3">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
              <TabsTrigger value="definition" className="gap-1.5 text-xs sm:text-sm">
                <Building2 className="h-3.5 w-3.5" />
                Hesap Tanımı
              </TabsTrigger>
              <TabsTrigger value="contact" className="gap-1.5 text-xs sm:text-sm">
                <Phone className="h-3.5 w-3.5" />
                İletişim
              </TabsTrigger>
              <TabsTrigger value="finance" className="gap-1.5 text-xs sm:text-sm">
                <Wallet className="h-3.5 w-3.5" />
                Finansal
              </TabsTrigger>
              <TabsTrigger value="relatives" className="gap-1.5 text-xs sm:text-sm">
                <Users className="h-3.5 w-3.5" />
                Yakınları
              </TabsTrigger>
              <TabsTrigger value="guarantors" className="gap-1.5 text-xs sm:text-sm">
                <Shield className="h-3.5 w-3.5" />
                Kefil
              </TabsTrigger>
            </TabsList>
          </div>

          <FormSheetBody className="space-y-5">
            <TabsContent value="definition" className="mt-0 space-y-4">
              <FormField label="Hesap adı" htmlFor="sup-name" required>
                <Input
                  id="sup-name"
                  required
                  placeholder="Hesap Adı"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </FormField>
              <div className="space-y-1">
                <button
                  type="button"
                  className="text-left text-sm font-medium text-indigo-600 hover:underline"
                  onClick={() => setShowTaxLookup((v) => !v)}
                >
                  {showTaxLookup ? "−" : "+"} Vergi no veya TC ile ünvan sorgulamak istiyorum
                </button>
                {showTaxLookup ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField label="Vergi no" htmlFor="sup-tax-lookup" optional>
                      <Input
                        id="sup-tax-lookup"
                        value={form.taxNo}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, taxNo: e.target.value }))
                        }
                      />
                    </FormField>
                    <FormField label="TC" htmlFor="sup-tc-lookup" optional>
                      <Input
                        id="sup-tc-lookup"
                        inputMode="numeric"
                        maxLength={11}
                        value={form.nationalId}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            nationalId: e.target.value.replace(/\D/g, "").slice(0, 11),
                          }))
                        }
                      />
                    </FormField>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="text-left text-sm font-medium text-indigo-600 hover:underline"
                  onClick={() => setShowInvoiceName((v) => !v)}
                >
                  {showInvoiceName ? "−" : "+"} Fatura adını ayrıca girmek istiyorum
                </button>
                {showInvoiceName ? (
                  <FormField label="Fatura adı" htmlFor="sup-invoice-name" optional>
                    <Input
                      id="sup-invoice-name"
                      value={form.invoiceName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, invoiceName: e.target.value }))
                      }
                    />
                  </FormField>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField label="Hesap listesi" required>
                  <Select
                    value={form.accountList}
                    onValueChange={(accountList) =>
                      setForm((f) => ({ ...f, accountList }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPLIER_ACCOUNT_LISTS.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Hesap parabirimi">
                  <Select
                    value={form.currency}
                    onValueChange={(currency) =>
                      setForm((f) => ({ ...f, currency }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPLIER_CURRENCIES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="Hesap kodu" htmlFor="sup-code" optional>
                  <Input
                    id="sup-code"
                    className="font-mono"
                    placeholder="Hesap Kodu"
                    value={form.accountCode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, accountCode: e.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Online işlemler">
                  <Select
                    value={form.onlineTransactions ? "yes" : "no"}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, onlineTransactions: v === "yes" }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Evet</SelectItem>
                      <SelectItem value="no">Hayır</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
              <FormField
                label="IBAN adresleri ve diğer notlar"
                htmlFor="sup-notes"
                optional
              >
                <Input
                  id="sup-iban"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="TR00 0000 0000 0000 0000 0000 00"
                  className="mb-2 font-mono tracking-wide"
                  value={form.iban}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, iban: formatIban(e.target.value) }))
                  }
                />
                <Textarea
                  id="sup-notes"
                  placeholder="Notlar"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </FormField>
            </TabsContent>

            <TabsContent value="contact" className="mt-0 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FormField label="Ülke">
                  <Select
                    value={form.country}
                    onValueChange={(country) =>
                      setForm((f) => ({ ...f, country }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Türkiye">Türkiye</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
                <FormField label="İl">
                  <SearchableSelect
                    value={form.city || undefined}
                    onValueChange={(city) =>
                      setForm((f) => ({
                        ...f,
                        city,
                        district:
                          (TURKEY_DISTRICTS[city] ?? []).includes(f.district)
                            ? f.district
                            : "",
                      }))
                    }
                    placeholder="Seçiniz"
                    searchPlaceholder="İl ara…"
                    emptyText="İl bulunamadı"
                    options={TURKEY_PROVINCES.map((city) => ({
                      value: city,
                      label: city,
                    }))}
                  />
                </FormField>
                <FormField label="İlçe">
                  {districtOptions.length > 0 ? (
                    <SearchableSelect
                      value={form.district || undefined}
                      onValueChange={(district) =>
                        setForm((f) => ({ ...f, district }))
                      }
                      placeholder="Seçiniz"
                      searchPlaceholder="İlçe ara…"
                      emptyText="Önce il seçin"
                      disabled={!form.city}
                      options={districtOptions.map((d) => ({
                        value: d,
                        label: d,
                      }))}
                    />
                  ) : (
                    <Input
                      placeholder="İlçe"
                      disabled={!form.city}
                      value={form.district}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, district: e.target.value }))
                      }
                    />
                  )}
                </FormField>
              </div>
              <FormField label="Adres" htmlFor="sup-address" optional>
                <Input
                  id="sup-address"
                  placeholder="cadde, sokak no"
                  value={form.address}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, address: e.target.value }))
                  }
                />
              </FormField>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FormField label="Cep numarası" htmlFor="sup-mobile" optional>
                  <Input
                    id="sup-mobile"
                    type="tel"
                    inputMode="numeric"
                    placeholder="Cep Numarası"
                    value={form.mobile}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, mobile: formatPhone(e.target.value) }))
                    }
                  />
                </FormField>
                <FormField label="E-posta adresi" htmlFor="sup-email" optional>
                  <Input
                    id="sup-email"
                    type="email"
                    placeholder="E-Posta Adresi"
                    value={form.email}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Sabit telefon" htmlFor="sup-landline" optional>
                  <Input
                    id="sup-landline"
                    type="tel"
                    inputMode="numeric"
                    placeholder="Sabit Telefon"
                    value={form.landline}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        landline: formatPhone(e.target.value),
                      }))
                    }
                  />
                </FormField>
              </div>
            </TabsContent>

            <TabsContent value="finance" className="mt-0 space-y-4">
              <FormField label="Hesap türü">
                <Select
                  value={form.accountKind}
                  onValueChange={(accountKind) =>
                    setForm((f) => ({ ...f, accountKind }))
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPLIER_ACCOUNT_KINDS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <FormField label="Vergi no" htmlFor="sup-tax" optional>
                  <Input
                    id="sup-tax"
                    value={form.taxNo}
                    onChange={(e) => setForm((f) => ({ ...f, taxNo: e.target.value }))}
                  />
                </FormField>
                <FormField label="Vergi dairesi" htmlFor="sup-tax-office" optional>
                  <Input
                    id="sup-tax-office"
                    value={form.taxOffice}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, taxOffice: e.target.value }))
                    }
                  />
                </FormField>
                <FormField label="TC" htmlFor="sup-tc" optional>
                  <Input
                    id="sup-tc"
                    inputMode="numeric"
                    maxLength={11}
                    value={form.nationalId}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        nationalId: e.target.value.replace(/\D/g, "").slice(0, 11),
                      }))
                    }
                  />
                </FormField>
              </div>
              <FormSection title="Önceki bakiye">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField label="Devir bakiye" htmlFor="sup-opening" optional>
                    <Input
                      id="sup-opening"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Devir Bakiye"
                      value={form.openingBalance}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, openingBalance: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Devir bakiye tür">
                    <Select
                      value={form.openingBalanceType}
                      onValueChange={(openingBalanceType) =>
                        setForm((f) => ({ ...f, openingBalanceType }))
                      }
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPLIER_BALANCE_TYPES.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
              </FormSection>
              <FormSection title="Borç yönetimi">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <FormField label="Vade (gün sayısı)" htmlFor="sup-term" optional>
                    <Input
                      id="sup-term"
                      type="number"
                      min={0}
                      step={1}
                      placeholder="Vade (Gün Sayısı)"
                      value={form.paymentTermDays}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, paymentTermDays: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Borç limiti" htmlFor="sup-limit" optional>
                    <Input
                      id="sup-limit"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Borç Limiti"
                      value={form.creditLimit}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, creditLimit: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Satış fiyatı">
                    <Select
                      value={form.salesPriceList}
                      onValueChange={(salesPriceList) =>
                        setForm((f) => ({ ...f, salesPriceList }))
                      }
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPLIER_PRICE_LISTS.map((item) => (
                          <SelectItem key={item} value={item}>
                            {item}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                </div>
              </FormSection>
              <FormSection title="Diğer">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <FormField label="Şube" htmlFor="sup-branch" optional>
                    <Input
                      id="sup-branch"
                      value={form.branch}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, branch: e.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Personel ata">
                    {staffNames.length > 0 ? (
                      <SearchableSelect
                        value={form.assignedPersonnel || undefined}
                        onValueChange={(assignedPersonnel) =>
                          setForm((f) => ({ ...f, assignedPersonnel }))
                        }
                        placeholder="Personel seçin"
                        searchPlaceholder="Personel ara…"
                        emptyText="Personel yok"
                        options={staffNames.map((name) => ({
                          value: name,
                          label: name,
                        }))}
                      />
                    ) : (
                      <Input
                        placeholder="Personel"
                        value={form.assignedPersonnel}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            assignedPersonnel: e.target.value,
                          }))
                        }
                      />
                    )}
                  </FormField>
                  <FormField label="Ödeme vergi no" htmlFor="sup-pay-tax" optional>
                    <Input
                      id="sup-pay-tax"
                      value={form.paymentTaxNo}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, paymentTaxNo: e.target.value }))
                      }
                    />
                  </FormField>
                </div>
              </FormSection>
            </TabsContent>

            <TabsContent value="relatives" className="mt-0">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {form.relatives.map((row, index) => (
                  <FormSection key={index} title={`${index + 1}. Yakın bilgisi`}>
                    <FormField label="Adı soyadı" htmlFor={`rel-name-${index}`} optional>
                      <Input
                        id={`rel-name-${index}`}
                        placeholder="Adı Soyadı"
                        value={row.name}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            relatives: f.relatives.map((r, i) =>
                              i === index ? { ...r, name: e.target.value } : r
                            ),
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="Cep numarası" htmlFor={`rel-phone-${index}`} optional>
                      <Input
                        id={`rel-phone-${index}`}
                        type="tel"
                        inputMode="numeric"
                        placeholder="Cep Numarası"
                        value={row.phone}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            relatives: f.relatives.map((r, i) =>
                              i === index
                                ? { ...r, phone: formatPhone(e.target.value) }
                                : r
                            ),
                          }))
                        }
                      />
                    </FormField>
                  </FormSection>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="guarantors" className="mt-0">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {form.guarantors.map((row, index) => (
                  <FormSection key={index} title={`${index + 1}. Kefil bilgileri`}>
                    <FormField label="Adı soyadı" htmlFor={`g-name-${index}`} optional>
                      <Input
                        id={`g-name-${index}`}
                        placeholder="Adı Soyadı"
                        value={row.name}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            guarantors: f.guarantors.map((r, i) =>
                              i === index ? { ...r, name: e.target.value } : r
                            ),
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="TC" htmlFor={`g-tc-${index}`} optional>
                      <Input
                        id={`g-tc-${index}`}
                        inputMode="numeric"
                        maxLength={11}
                        placeholder="TC"
                        value={row.nationalId}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            guarantors: f.guarantors.map((r, i) =>
                              i === index
                                ? {
                                    ...r,
                                    nationalId: e.target.value
                                      .replace(/\D/g, "")
                                      .slice(0, 11),
                                  }
                                : r
                            ),
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="Adres" htmlFor={`g-addr-${index}`} optional>
                      <Input
                        id={`g-addr-${index}`}
                        placeholder="Adres"
                        value={row.address}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            guarantors: f.guarantors.map((r, i) =>
                              i === index ? { ...r, address: e.target.value } : r
                            ),
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="Cep no" htmlFor={`g-phone-${index}`} optional>
                      <Input
                        id={`g-phone-${index}`}
                        type="tel"
                        inputMode="numeric"
                        placeholder="Cep No"
                        value={row.phone}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            guarantors: f.guarantors.map((r, i) =>
                              i === index
                                ? { ...r, phone: formatPhone(e.target.value) }
                                : r
                            ),
                          }))
                        }
                      />
                    </FormField>
                  </FormSection>
                ))}
              </div>
            </TabsContent>
          </FormSheetBody>
        </Tabs>
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
                : "Hesap oluştur"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
