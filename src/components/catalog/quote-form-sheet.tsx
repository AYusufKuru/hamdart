"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BadgePercent, FlaskConical, Plus, Trash2 } from "lucide-react";
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
import {
  FormDialog,
  FormField,
  FormSection,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import { SearchableSelect } from "@/components/shared/searchable-select";
import type { Customer, Invoice, InvoiceLine } from "@/data/catalog";
import {
  createCatalog,
  fetchCustomers,
  fetchDocumentSettings,
  fetchInvoices,
  updateCatalog,
} from "@/lib/catalog-store";
import { getAllRecipes } from "@/lib/recipe-store";
import type { Recipe } from "@/data/recipes";
import {
  calcInvoiceLine,
  COMPANY_PROFILE,
  LINE_UNITS,
  nextDocumentNo,
  PAYMENT_METHODS,
  QUOTE_STATUSES,
  roundMoney,
  VAT_RATES,
  normalizeQuoteStatus,
} from "@/lib/invoice-docs";
import { formatNumber, todayIso } from "@/lib/utils";

type LineForm = {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountRate: string;
  vatRate: string;
};

function emptyLine(): LineForm {
  return {
    description: "",
    quantity: "1",
    unit: "Adet",
    unitPrice: "",
    discountRate: "0",
    vatRate: "20",
  };
}

function plusDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function emptyForm(quoteNo: string, row?: Invoice, lines?: InvoiceLine[]) {
  return {
    invoiceNo: row?.invoiceNo ?? quoteNo,
    party: row?.party ?? "",
    issueDate: row?.issueDate || todayIso(),
    validUntil: row?.validUntil || row?.dueDate || plusDays(todayIso(), 14),
    status: row?.status ?? "Taslak",
    currency: row?.currency || "TRY",
    partyTaxNo: row?.partyTaxNo ?? "",
    partyTaxOffice: row?.partyTaxOffice ?? "",
    partyAddress: row?.partyAddress ?? "",
    partyCity: row?.partyCity ?? "",
    partyDistrict: row?.partyDistrict ?? "",
    partyPhone: row?.partyPhone ?? "",
    partyEmail: row?.partyEmail ?? "",
    sellerName: row?.sellerName || COMPANY_PROFILE.name,
    sellerTaxNo: row?.sellerTaxNo || COMPANY_PROFILE.taxNo,
    sellerTaxOffice: row?.sellerTaxOffice || COMPANY_PROFILE.taxOffice,
    sellerAddress: row?.sellerAddress || COMPANY_PROFILE.address,
    paymentMethod: row?.paymentMethod || "Cari hesap",
    deliveryTerm: row?.deliveryTerm || "Peşin teslim / depodan teslim",
    preparedBy: row?.preparedBy ?? "",
    notes:
      row?.notes ??
      "Fiyatlar KDV hariçtir. Teklif, geçerlilik tarihine kadar geçerlidir. Stok ve üretim durumuna göre teslim süresi değişebilir.",
    rdFee: "",
    rdVatRate: "20",
    lines:
      lines && lines.length > 0
        ? lines.map((l) => ({
            description: l.description,
            quantity: String(l.quantity || 1),
            unit: l.unit || "Adet",
            unitPrice: String(l.unitPrice),
            discountRate: String(l.discountRate ?? 0),
            vatRate: String(l.vatRate ?? 20),
          }))
        : [emptyLine()],
  };
}

export function QuoteFormSheet({
  open,
  onOpenChange,
  editing,
  editingLines,
  defaultParty = "",
  lockParty = false,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Invoice | null;
  editingLines?: InvoiceLine[];
  defaultParty?: string;
  lockParty?: boolean;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState(() => emptyForm(""));
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [recipeProducts, setRecipeProducts] = useState<Recipe[]>([]);
  const [rdOpen, setRdOpen] = useState(false);

  const partyOptions = useMemo(
    () =>
      customers.map((c) => ({
        value: c.name,
        label: c.name,
        taxNo: c.taxNo,
        address: c.address,
        phone: c.mobile || c.contact,
        email: c.email,
      })),
    [customers]
  );

  const productOptions = useMemo(() => {
    const seen = new Set<string>();
    return recipeProducts
      .filter((recipe) => recipe.status === "saved" && recipe.productName.trim())
      .filter((recipe) => {
        const key = recipe.productName.trim().toLocaleLowerCase("tr");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((recipe) => ({
        value: recipe.productName.trim(),
        label: recipe.productName.trim(),
        keywords: `${recipe.code ?? ""} ${recipe.productCode ?? ""}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "tr"));
  }, [recipeProducts]);

  const calculatedLines = form.lines.map((line) =>
    calcInvoiceLine(
      {
        quantity: parseFloat(line.quantity.replace(",", ".")) || 0,
        unitPrice: parseFloat(line.unitPrice.replace(",", ".")) || 0,
        discountRate: parseFloat(line.discountRate.replace(",", ".")) || 0,
        vatRate: parseFloat(line.vatRate.replace(",", ".")) || 0,
      },
      line.unit
    )
  );
  const rdFeeAmount = rdOpen
    ? parseFloat(form.rdFee.replace(",", ".")) || 0
    : 0;
  const rdCalc = calcInvoiceLine(
    {
      quantity: rdFeeAmount > 0 ? 1 : 0,
      unitPrice: rdFeeAmount,
      discountRate: 0,
      vatRate: parseFloat(form.rdVatRate.replace(",", ".")) || 0,
    },
    "Adet"
  );
  const subtotal = roundMoney(
    calculatedLines.reduce((s, l) => s + l.lineNet, 0) + (rdOpen ? rdCalc.lineNet : 0)
  );
  const totalVat = roundMoney(
    calculatedLines.reduce((s, l) => s + l.vatAmount, 0) + (rdOpen ? rdCalc.vatAmount : 0)
  );
  const grandTotal = roundMoney(subtotal + totalVat);

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    setRdOpen(false);
    void Promise.all([
      fetchCustomers().catch(() => [] as Customer[]),
      fetchInvoices().catch(() => [] as Invoice[]),
      fetchDocumentSettings().catch(() => null),
      getAllRecipes().catch(() => [] as Recipe[]),
    ]).then(([c, invoices, settings, recipes]) => {
      setCustomers(c);
      setRecipeProducts(recipes);
      const nextNo = nextDocumentNo(
        invoices.map((inv) => inv.invoiceNo),
        "TKF"
      );
      const next = emptyForm(nextNo, editing ?? undefined, editingLines);
      if (!editing && settings) {
        next.sellerName = settings.legalTitle || settings.companyName || next.sellerName;
        next.sellerTaxNo = settings.taxNo;
        next.sellerTaxOffice = settings.taxOffice;
        next.sellerAddress = [settings.address, settings.district, settings.city]
          .filter(Boolean)
          .join(" / ");
        next.preparedBy = next.preparedBy || settings.authorizedName;
      }
      if (!editing && defaultParty.trim()) {
        const hit = c.find((row) => row.name === defaultParty);
        next.party = defaultParty;
        next.partyTaxNo = hit?.taxNo || next.partyTaxNo;
        next.partyAddress = hit?.address || next.partyAddress;
        next.partyPhone = hit?.mobile || hit?.contact || next.partyPhone;
        next.partyEmail = hit?.email || next.partyEmail;
      }
      setForm(next);
    });
  }, [open, editing, editingLines, defaultParty]);

  function applyParty(name: string) {
    const hit = partyOptions.find((p) => p.value === name);
    setForm((f) => ({
      ...f,
      party: name,
      partyTaxNo: hit?.taxNo || f.partyTaxNo,
      partyAddress: hit?.address || f.partyAddress,
      partyPhone: hit?.phone || f.partyPhone,
      partyEmail: hit?.email || f.partyEmail,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const lines = form.lines
      .map((line, i) => ({ line, calc: calculatedLines[i] }))
      .filter(({ line }) => line.description.trim())
      .map(({ line, calc }) => ({
        description: line.description.trim(),
        quantity: parseFloat(line.quantity.replace(",", ".")) || 0,
        unit: line.unit,
        unitPrice: parseFloat(line.unitPrice.replace(",", ".")) || 0,
        discountRate: parseFloat(line.discountRate.replace(",", ".")) || 0,
        vatRate: parseFloat(line.vatRate.replace(",", ".")) || 0,
        quantityLabel: calc.quantityLabel,
        lineNet: calc.lineNet,
        vatAmount: calc.vatAmount,
        lineTotal: calc.lineTotal,
      }));
    if (!form.invoiceNo.trim() || !form.party.trim()) {
      toast.error("Teklif no ve müşteri zorunludur");
      return;
    }
    if (lines.length === 0) {
      toast.error("En az bir kalem girin");
      return;
    }
    if (rdOpen && rdFeeAmount <= 0) {
      toast.error("Ar-Ge bedeli girin");
      return;
    }
    if (rdOpen) {
      lines.push({
        description: "Ar-Ge bedeli",
        quantity: 1,
        unit: "Adet",
        unitPrice: rdFeeAmount,
        discountRate: 0,
        vatRate: parseFloat(form.rdVatRate.replace(",", ".")) || 0,
        quantityLabel: rdCalc.quantityLabel,
        lineNet: rdCalc.lineNet,
        vatAmount: rdCalc.vatAmount,
        lineTotal: rdCalc.lineTotal,
      });
    }
    setSaving(true);
    try {
      const body = {
        invoiceNo: form.invoiceNo.trim(),
        party: form.party.trim(),
        kind: "Fiyat teklifi",
        documentType: "quote",
        bucket: "proforma",
        confirmed: false,
        issueDate: form.issueDate,
        dueDate: form.validUntil,
        validUntil: form.validUntil,
        status: form.status,
        eDocument: "Proforma",
        scenario: "TEKLIF",
        currency: form.currency,
        fxRate: 1,
        partyTaxNo: form.partyTaxNo.trim(),
        partyTaxOffice: form.partyTaxOffice.trim(),
        partyAddress: form.partyAddress.trim(),
        partyCity: form.partyCity.trim(),
        partyDistrict: form.partyDistrict.trim(),
        partyPhone: form.partyPhone.trim(),
        partyEmail: form.partyEmail.trim(),
        sellerName: form.sellerName.trim() || COMPANY_PROFILE.name,
        sellerTaxNo: form.sellerTaxNo.trim(),
        sellerTaxOffice: form.sellerTaxOffice.trim(),
        sellerAddress: form.sellerAddress.trim(),
        paymentMethod: form.paymentMethod,
        deliveryTerm: form.deliveryTerm.trim(),
        preparedBy: form.preparedBy.trim(),
        notes: form.notes.trim(),
        subtotal,
        totalVat,
        amount: grandTotal,
        lines,
      };
      if (editing) {
        toast.error("Teklif içeriği kilitlidir. Yalnızca durum güncellenebilir.");
        return;
      }
      await createCatalog("invoices", body);
      toast.success("Teklif kaydedildi");
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
      icon={BadgePercent}
      title="Yeni fiyat teklifi"
      description="Kayıttan sonra teklif içeriği kilitlenir; yalnızca durum güncellenir."
      className="max-w-4xl max-h-[min(92dvh,58rem)]"
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
          <FormSection title="Teklif">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Teklif no" htmlFor="qt-no" required>
                <Input
                  id="qt-no"
                  required
                  className="bg-white font-mono"
                  value={form.invoiceNo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, invoiceNo: e.target.value }))
                  }
                />
              </FormField>
              <FormField
                label="Durum"
                required
                hint="Kayıttan sonra içerik kilitlenir; durum buradan veya listeden güncellenir."
              >
                <Select
                  value={form.status}
                  onValueChange={(status) => setForm((f) => ({ ...f, status }))}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUOTE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Tarih" htmlFor="qt-date" required>
                <Input
                  id="qt-date"
                  type="date"
                  required
                  className="bg-white"
                  value={form.issueDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, issueDate: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Geçerlilik" htmlFor="qt-until" required>
                <Input
                  id="qt-until"
                  type="date"
                  required
                  className="bg-white"
                  value={form.validUntil}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, validUntil: e.target.value }))
                  }
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Müşteri">
            <FormField label="Unvan" required>
              <SearchableSelect
                value={form.party || undefined}
                onValueChange={applyParty}
                placeholder="Müşteri seçin veya arayın"
                searchPlaceholder="Müşteri ara…"
                emptyText="Kayıt yok"
                disabled={lockParty}
                options={partyOptions.map((p) => ({
                  value: p.value,
                  label: p.label,
                  keywords: `${p.taxNo} ${p.phone} ${p.email}`,
                }))}
              />
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="VKN / TCKN" htmlFor="qt-tax" optional>
                <Input
                  id="qt-tax"
                  className="bg-white"
                  value={form.partyTaxNo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, partyTaxNo: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Telefon" htmlFor="qt-phone" optional>
                <Input
                  id="qt-phone"
                  className="bg-white"
                  value={form.partyPhone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, partyPhone: e.target.value }))
                  }
                />
              </FormField>
            </div>
            <FormField label="Adres" htmlFor="qt-addr" optional>
              <Input
                id="qt-addr"
                className="bg-white"
                value={form.partyAddress}
                onChange={(e) =>
                  setForm((f) => ({ ...f, partyAddress: e.target.value }))
                }
              />
            </FormField>
          </FormSection>

          <FormSection title="Koşullar">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Ödeme" required>
                <Select
                  value={form.paymentMethod}
                  onValueChange={(paymentMethod) =>
                    setForm((f) => ({ ...f, paymentMethod }))
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Teslim" htmlFor="qt-del" optional>
                <Input
                  id="qt-del"
                  className="bg-white"
                  value={form.deliveryTerm}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, deliveryTerm: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Hazırlayan" htmlFor="qt-prep" optional>
                <Input
                  id="qt-prep"
                  className="bg-white"
                  value={form.preparedBy}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, preparedBy: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Para birimi" htmlFor="qt-cur">
                <Input
                  id="qt-cur"
                  className="bg-white"
                  value={form.currency}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      currency: e.target.value.toUpperCase(),
                    }))
                  }
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection
            title="Teklif kalemleri"
            description={
              rdOpen
                ? "Ar-Ge açık: ürün adı elle yazılır. Birim fiyat KDV hariçtir."
                : "Reçetesi olan hazır ürünler. Birim fiyat KDV hariçtir."
            }
            action={
              <Button
                type="button"
                size="sm"
                variant={rdOpen ? "default" : "outline"}
                className="rounded-xl"
                onClick={() => setRdOpen((open) => !open)}
              >
                <FlaskConical className="mr-1.5 h-4 w-4" />
                Ar-Ge
              </Button>
            }
          >
            <div className="space-y-2">
              {form.lines.map((line, i) => {
                const calc = calculatedLines[i];
                return (
                  <div
                    key={i}
                    className="grid grid-cols-1 gap-2 rounded-xl border bg-white p-3 sm:grid-cols-12"
                  >
                    {rdOpen ? (
                      <Input
                        placeholder="Ürün adını yazın"
                        className="bg-white sm:col-span-12"
                        value={line.description}
                        onChange={(e) =>
                          setForm((f) => {
                            const next = [...f.lines];
                            next[i] = { ...next[i], description: e.target.value };
                            return { ...f, lines: next };
                          })
                        }
                      />
                    ) : (
                      <div className="sm:col-span-12">
                        <SearchableSelect
                          value={line.description || undefined}
                          onValueChange={(description) =>
                            setForm((f) => {
                              const next = [...f.lines];
                              next[i] = { ...next[i], description };
                              return { ...f, lines: next };
                            })
                          }
                          placeholder="Reçeteli hazır ürün seçin"
                          searchPlaceholder="Ürün ara…"
                          emptyText="Reçeteli hazır ürün yok"
                          options={productOptions}
                        />
                      </div>
                    )}
                    <Input
                      placeholder="Miktar"
                      type="number"
                      min={0}
                      className="bg-white sm:col-span-2"
                      value={line.quantity}
                      onChange={(e) =>
                        setForm((f) => {
                          const next = [...f.lines];
                          next[i] = { ...next[i], quantity: e.target.value };
                          return { ...f, lines: next };
                        })
                      }
                    />
                    <Select
                      value={line.unit}
                      onValueChange={(unit) =>
                        setForm((f) => {
                          const next = [...f.lines];
                          next[i] = { ...next[i], unit };
                          return { ...f, lines: next };
                        })
                      }
                    >
                      <SelectTrigger className="bg-white sm:col-span-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LINE_UNITS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Birim fiyat"
                      type="number"
                      min={0}
                      step="0.01"
                      className="bg-white sm:col-span-3"
                      value={line.unitPrice}
                      onChange={(e) =>
                        setForm((f) => {
                          const next = [...f.lines];
                          next[i] = { ...next[i], unitPrice: e.target.value };
                          return { ...f, lines: next };
                        })
                      }
                    />
                    <Input
                      placeholder="İsk. %"
                      type="number"
                      min={0}
                      max={100}
                      className="bg-white sm:col-span-2"
                      value={line.discountRate}
                      onChange={(e) =>
                        setForm((f) => {
                          const next = [...f.lines];
                          next[i] = { ...next[i], discountRate: e.target.value };
                          return { ...f, lines: next };
                        })
                      }
                    />
                    <Select
                      value={line.vatRate}
                      onValueChange={(vatRate) =>
                        setForm((f) => {
                          const next = [...f.lines];
                          next[i] = { ...next[i], vatRate };
                          return { ...f, lines: next };
                        })
                      }
                    >
                      <SelectTrigger className="bg-white sm:col-span-2">
                        <SelectValue placeholder="KDV" />
                      </SelectTrigger>
                      <SelectContent>
                        {VAT_RATES.map((r) => (
                          <SelectItem key={r} value={String(r)}>
                            KDV %{r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center justify-between gap-2 sm:col-span-1">
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(calc.lineTotal)}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={form.lines.length <= 1}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            lines: f.lines.filter((_, idx) => idx !== i),
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl border-dashed"
              onClick={() =>
                setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))
              }
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Kalem ekle
            </Button>
            {rdOpen ? (
              <div className="rounded-xl border border-dashed bg-white p-3">
                <p className="text-sm font-semibold">Ar-Ge bedeli</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Laboratuvarda yeni ürün geliştirme bedeli teklif tutarına eklenir.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-12">
                  <Input
                    placeholder="Ar-Ge bedeli"
                    type="number"
                    min={0}
                    step="0.01"
                    className="bg-white sm:col-span-8"
                    value={form.rdFee}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, rdFee: e.target.value }))
                    }
                  />
                  <Select
                    value={form.rdVatRate}
                    onValueChange={(rdVatRate) =>
                      setForm((f) => ({ ...f, rdVatRate }))
                    }
                  >
                    <SelectTrigger className="bg-white sm:col-span-4">
                      <SelectValue placeholder="KDV" />
                    </SelectTrigger>
                    <SelectContent>
                      {VAT_RATES.map((r) => (
                        <SelectItem key={r} value={String(r)}>
                          KDV %{r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="mt-2 text-right text-xs text-muted-foreground">
                  {formatNumber(rdCalc.lineTotal)} ₺
                </p>
              </div>
            ) : null}
            <div className="ml-auto grid max-w-xs gap-1 text-sm">
              {rdOpen ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ar-Ge bedeli</span>
                  <span>{formatNumber(rdCalc.lineNet)} ₺</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Matrah</span>
                <span>{formatNumber(subtotal)} ₺</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">KDV</span>
                <span>{formatNumber(totalVat)} ₺</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Teklif tutarı</span>
                <span>{formatNumber(grandTotal)} ₺</span>
              </div>
            </div>
          </FormSection>

          <FormSection title="Teklif şartları">
            <Textarea
              className="bg-white min-h-28"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </FormSection>
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Teklifi kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}

export function QuoteStatusDialog({
  open,
  onOpenChange,
  quote,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Invoice | null;
  onSaved?: () => void;
}) {
  const [status, setStatus] = useState<string>("Taslak");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !quote) return;
    setStatus(normalizeQuoteStatus(quote.status));
    setSaving(false);
  }, [open, quote]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quote) return;
    setSaving(true);
    try {
      await updateCatalog("invoices", quote.id, { status });
      toast.success("Teklif durumu güncellendi");
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Durum güncellenemedi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={BadgePercent}
      title="Teklif durumunu güncelle"
      description={quote ? `${quote.invoiceNo} · ${quote.party}` : undefined}
      className="max-w-md"
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
          <FormSection title="Durum">
            <FormField label="Durum" required>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUOTE_STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </FormSection>
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="submit" disabled={saving || !quote}>
            {saving ? "Kaydediliyor…" : "Durumu kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
