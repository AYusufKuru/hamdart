"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, Plus, Trash2 } from "lucide-react";
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
import type { Customer, Invoice, InvoiceLine, Supplier } from "@/data/catalog";
import {
  createCatalog,
  fetchCustomers,
  fetchDocumentSettings,
  fetchInvoices,
  fetchSuppliers,
  updateCatalog,
} from "@/lib/catalog-store";
import {
  calcInvoiceLine,
  COMPANY_PROFILE,
  documentTypeFromKind,
  documentTypeMeta,
  E_DOCUMENT_TYPES,
  INVOICE_DOCUMENT_TYPES,
  INVOICE_FORM_TYPES,
  INVOICE_SCENARIOS,
  INVOICE_STATUSES,
  isConfirmedWorkflow,
  LINE_UNITS,
  nextDocumentNo,
  PAYMENT_METHODS,
  roundMoney,
  VAT_RATES,
  type InvoiceDocumentType,
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

function emptyForm(
  documentType: InvoiceDocumentType,
  invoiceNo: string,
  row?: Invoice,
  lines?: InvoiceLine[]
) {
  const meta = documentTypeMeta(row ? documentTypeFromKind(row.kind, row.documentType) : documentType);
  return {
    invoiceNo: row?.invoiceNo ?? invoiceNo,
    documentType: meta.value,
    party: row?.party ?? "",
    issueDate: row?.issueDate || todayIso(),
    dueDate: row?.dueDate || todayIso(),
    status:
      row?.status === "Kesinleşti"
        ? "Onaylandı"
        : row?.status === "İptal"
          ? "İptal Edildi"
          : row?.status === "Kısmi"
            ? "Kısmi Ödendi"
            : row?.status ??
              (meta.confirmedDefault ? "Ödenmedi" : "Proforma"),
    confirmed: row?.confirmed ?? meta.confirmedDefault,
    eDocument: row?.eDocument || (meta.bucket === "proforma" ? "Proforma" : "e-Arşiv"),
    scenario: row?.scenario || "TEMELFATURA",
    series: row?.series ?? "",
    currency: row?.currency || "TRY",
    fxRate: row?.fxRate != null ? String(row.fxRate) : "1",
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
    paymentMethod:
      row?.paymentMethod ||
      (meta.value === "cash_sale" ? "Nakit" : "Cari hesap"),
    relatedDispatchNo: row?.relatedDispatchNo ?? "",
    relatedOrderNo: row?.relatedOrderNo ?? "",
    notes: row?.notes ?? "",
    withholding: row?.withholding ? String(row.withholding) : "",
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

export function InvoiceFormSheet({
  open,
  onOpenChange,
  editing,
  editingLines,
  defaultDocumentType = "sales",
  defaultStatus,
  lockDocumentType = false,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: Invoice | null;
  editingLines?: InvoiceLine[];
  defaultDocumentType?: InvoiceDocumentType;
  defaultStatus?: string;
  lockDocumentType?: boolean;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState(() => emptyForm(defaultDocumentType, ""));
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const meta = documentTypeMeta(form.documentType);
  const partyOptions = useMemo(() => {
    if (meta.partyKind === "supplier") {
      return suppliers.map((s) => ({
        value: s.name,
        label: s.name,
        taxNo: s.taxNo,
        taxOffice: s.taxOffice,
        address: s.address,
        city: s.city,
        district: s.district,
        phone: s.mobile || s.contact,
        email: s.email,
      }));
    }
    if (meta.partyKind === "customer") {
      return customers.map((c) => ({
        value: c.name,
        label: c.name,
        taxNo: c.taxNo,
        taxOffice: "",
        address: c.address,
        city: "",
        district: "",
        phone: c.contact,
        email: c.email,
      }));
    }
    return [
      ...customers.map((c) => ({
        value: c.name,
        label: `${c.name} (müşteri)`,
        taxNo: c.taxNo,
        taxOffice: "",
        address: c.address,
        city: "",
        district: "",
        phone: c.contact,
        email: c.email,
      })),
      ...suppliers.map((s) => ({
        value: s.name,
        label: `${s.name} (tedarikçi)`,
        taxNo: s.taxNo,
        taxOffice: s.taxOffice,
        address: s.address,
        city: s.city,
        district: s.district,
        phone: s.mobile || s.contact,
        email: s.email,
      })),
    ];
  }, [customers, suppliers, meta.partyKind]);

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
  const subtotal = roundMoney(calculatedLines.reduce((s, l) => s + l.lineNet, 0));
  const totalVat = roundMoney(calculatedLines.reduce((s, l) => s + l.vatAmount, 0));
  const withholding = parseFloat(form.withholding.replace(",", ".")) || 0;
  const grandTotal = roundMoney(subtotal + totalVat - withholding);

  useEffect(() => {
    if (!open) return;
    setSaving(false);
    void Promise.all([
      fetchCustomers().catch(() => [] as Customer[]),
      fetchSuppliers().catch(() => [] as Supplier[]),
      fetchInvoices().catch(() => [] as Invoice[]),
      fetchDocumentSettings().catch(() => null),
    ]).then(([c, s, invoices, settings]) => {
      setCustomers(c);
      setSuppliers(s);
      const type = editing
        ? documentTypeFromKind(editing.kind, editing.documentType)
        : defaultDocumentType;
      const prefix = documentTypeMeta(type).prefix;
      const nextNo = nextDocumentNo(
        invoices.map((inv) => inv.invoiceNo),
        prefix
      );
      const next = emptyForm(type, nextNo, editing ?? undefined, editingLines);
      if (!editing && settings) {
        next.sellerName = settings.legalTitle || settings.companyName || next.sellerName;
        next.sellerTaxNo = settings.taxNo;
        next.sellerTaxOffice = settings.taxOffice;
        next.sellerAddress = [settings.address, settings.district, settings.city]
          .filter(Boolean)
          .join(" / ");
      }
      if (!editing && defaultStatus) {
        next.status = defaultStatus;
        next.confirmed = isConfirmedWorkflow(defaultStatus);
      }
      setForm(next);
    });
  }, [open, editing, editingLines, defaultDocumentType, defaultStatus]);

  function applyParty(name: string) {
    const hit = partyOptions.find((p) => p.value === name);
    setForm((f) => ({
      ...f,
      party: name,
      partyTaxNo: hit?.taxNo || f.partyTaxNo,
      partyTaxOffice: hit?.taxOffice || f.partyTaxOffice,
      partyAddress: hit?.address || f.partyAddress,
      partyCity: hit?.city || f.partyCity,
      partyDistrict: hit?.district || f.partyDistrict,
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
      toast.error("Belge no ve cari unvan zorunludur");
      return;
    }
    if (lines.length === 0) {
      toast.error("En az bir kalem girin");
      return;
    }
    const typeMeta = documentTypeMeta(form.documentType);
    setSaving(true);
    try {
      const body = {
        invoiceNo: form.invoiceNo.trim(),
        party: form.party.trim(),
        kind: typeMeta.kind,
        documentType: typeMeta.value,
        bucket: typeMeta.bucket,
        confirmed: form.confirmed,
        issueDate: form.issueDate,
        dueDate: form.dueDate,
        status: form.status,
        eDocument: form.eDocument,
        scenario: form.scenario,
        series: form.series.trim(),
        currency: form.currency,
        fxRate: parseFloat(form.fxRate.replace(",", ".")) || 1,
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
        relatedDispatchNo: form.relatedDispatchNo.trim(),
        relatedOrderNo: form.relatedOrderNo.trim(),
        notes: form.notes.trim(),
        withholding,
        subtotal,
        totalVat,
        amount: grandTotal,
        lines,
      };
      if (editing) {
        await updateCatalog("invoices", editing.id, body);
        toast.success("Belge güncellendi");
      } else {
        await createCatalog("invoices", body);
        toast.success("Belge kaydedildi");
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
      icon={FileText}
      title={editing ? `${meta.label} düzenle` : `Yeni ${meta.label.toLocaleLowerCase("tr")}`}
      description="Türkiye fatura standartlarına göre cari, KDV ve kalem bilgilerini girin."
      className="max-w-4xl max-h-[min(92dvh,58rem)]"
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
          <FormSection title="Belge">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {lockDocumentType ? (
                <FormField label="Belge türü">
                  <Input className="bg-muted" value={meta.label} readOnly />
                </FormField>
              ) : (
              <FormField label="Belge türü" required>
                <Select
                  value={form.documentType}
                  onValueChange={(documentType) => {
                    const next = documentTypeMeta(documentType);
                    setForm((f) => ({
                      ...f,
                      documentType: next.value,
                      confirmed: next.confirmedDefault,
                      status: next.confirmedDefault ? "Ödenmedi" : "Proforma",
                      eDocument: next.bucket === "proforma" ? "Proforma" : f.eDocument,
                      paymentMethod:
                        documentType === "cash_sale" ? "Nakit" : f.paymentMethod,
                    }));
                  }}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_DOCUMENT_TYPES.filter((t) =>
                      (INVOICE_FORM_TYPES as readonly string[]).includes(t.value)
                    ).map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              )}
              <FormField label="e-Belge" required>
                <Select
                  value={form.eDocument}
                  onValueChange={(eDocument) => setForm((f) => ({ ...f, eDocument }))}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {E_DOCUMENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Belge no" htmlFor="inv-no" required>
                <Input
                  id="inv-no"
                  required
                  className="bg-white font-mono"
                  value={form.invoiceNo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, invoiceNo: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Seri" htmlFor="inv-series" optional>
                <Input
                  id="inv-series"
                  className="bg-white font-mono"
                  value={form.series}
                  onChange={(e) => setForm((f) => ({ ...f, series: e.target.value }))}
                />
              </FormField>
              <FormField label="Düzenleme" htmlFor="inv-issue" required>
                <Input
                  id="inv-issue"
                  type="date"
                  required
                  className="bg-white"
                  value={form.issueDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, issueDate: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Vade" htmlFor="inv-due" required>
                <Input
                  id="inv-due"
                  type="date"
                  required
                  className="bg-white"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </FormField>
              <FormField label="Durum" required>
                <Select
                  value={form.status}
                  onValueChange={(status) =>
                    setForm((f) => ({
                      ...f,
                      status,
                      confirmed: isConfirmedWorkflow(status),
                    }))
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Senaryo">
                <Select
                  value={form.scenario}
                  onValueChange={(scenario) => setForm((f) => ({ ...f, scenario }))}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVOICE_SCENARIOS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Cari (alıcı / satıcı)">
            <FormField
              label={meta.partyKind === "supplier" ? "Tedarikçi" : "Cari unvan"}
              required
            >
              {partyOptions.length > 0 ? (
                <SearchableSelect
                  value={form.party || undefined}
                  onValueChange={applyParty}
                  placeholder="Cari seçin veya arayın"
                  searchPlaceholder="Cari ara…"
                  emptyText="Kayıt yok"
                  options={partyOptions.map((p) => ({
                    value: p.value,
                    label: p.label,
                  }))}
                />
              ) : (
                <Input
                  required
                  className="bg-white"
                  value={form.party}
                  onChange={(e) => setForm((f) => ({ ...f, party: e.target.value }))}
                />
              )}
            </FormField>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField label="VKN / TCKN" htmlFor="inv-vkn" optional>
                <Input
                  id="inv-vkn"
                  className="bg-white"
                  value={form.partyTaxNo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, partyTaxNo: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Vergi dairesi" htmlFor="inv-vd" optional>
                <Input
                  id="inv-vd"
                  className="bg-white"
                  value={form.partyTaxOffice}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, partyTaxOffice: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="İl" htmlFor="inv-city" optional>
                <Input
                  id="inv-city"
                  className="bg-white"
                  value={form.partyCity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, partyCity: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="İlçe" htmlFor="inv-dist" optional>
                <Input
                  id="inv-dist"
                  className="bg-white"
                  value={form.partyDistrict}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, partyDistrict: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Telefon" htmlFor="inv-phone" optional>
                <Input
                  id="inv-phone"
                  className="bg-white"
                  value={form.partyPhone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, partyPhone: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="E-posta" htmlFor="inv-mail" optional>
                <Input
                  id="inv-mail"
                  type="email"
                  className="bg-white"
                  value={form.partyEmail}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, partyEmail: e.target.value }))
                  }
                />
              </FormField>
            </div>
            <FormField label="Adres" htmlFor="inv-addr" optional>
              <Input
                id="inv-addr"
                className="bg-white"
                value={form.partyAddress}
                onChange={(e) =>
                  setForm((f) => ({ ...f, partyAddress: e.target.value }))
                }
              />
            </FormField>
          </FormSection>

          <FormSection title="Ödeme ve ilişkiler">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField label="Ödeme şekli">
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
              <FormField label="Para birimi" htmlFor="inv-cur">
                <Input
                  id="inv-cur"
                  className="bg-white"
                  value={form.currency}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))
                  }
                />
              </FormField>
              <FormField label="Kur" htmlFor="inv-fx" optional>
                <Input
                  id="inv-fx"
                  type="number"
                  min={0}
                  step="0.0001"
                  className="bg-white"
                  value={form.fxRate}
                  onChange={(e) => setForm((f) => ({ ...f, fxRate: e.target.value }))}
                />
              </FormField>
              <FormField label="İrsaliye no" htmlFor="inv-irs" optional>
                <Input
                  id="inv-irs"
                  className="bg-white font-mono"
                  value={form.relatedDispatchNo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, relatedDispatchNo: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Sipariş no" htmlFor="inv-ord" optional>
                <Input
                  id="inv-ord"
                  className="bg-white font-mono"
                  value={form.relatedOrderNo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, relatedOrderNo: e.target.value }))
                  }
                />
              </FormField>
              <FormField label="Tevkifat / stopaj" htmlFor="inv-wh" optional>
                <Input
                  id="inv-wh"
                  type="number"
                  min={0}
                  step="0.01"
                  className="bg-white"
                  value={form.withholding}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, withholding: e.target.value }))
                  }
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection
            title="Mal / hizmet kalemleri"
            description="Birim fiyat KDV hariçtir. KDV satırdan hesaplanır."
          >
            <div className="space-y-2">
              {form.lines.map((line, i) => {
                const calc = calculatedLines[i];
                return (
                  <div
                    key={i}
                    className="grid grid-cols-1 gap-2 rounded-xl border bg-white p-3 sm:grid-cols-12"
                  >
                    <Input
                      placeholder="Açıklama"
                      className="bg-white sm:col-span-12"
                      value={line.description}
                      onChange={(e) =>
                        setForm((f) => {
                          const lines = [...f.lines];
                          lines[i] = { ...lines[i], description: e.target.value };
                          return { ...f, lines };
                        })
                      }
                    />
                    <Input
                      placeholder="Miktar"
                      type="number"
                      min={0}
                      className="bg-white sm:col-span-2"
                      value={line.quantity}
                      onChange={(e) =>
                        setForm((f) => {
                          const lines = [...f.lines];
                          lines[i] = { ...lines[i], quantity: e.target.value };
                          return { ...f, lines };
                        })
                      }
                    />
                    <Select
                      value={line.unit}
                      onValueChange={(unit) =>
                        setForm((f) => {
                          const lines = [...f.lines];
                          lines[i] = { ...lines[i], unit };
                          return { ...f, lines };
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
                      className="bg-white sm:col-span-2"
                      value={line.unitPrice}
                      onChange={(e) =>
                        setForm((f) => {
                          const lines = [...f.lines];
                          lines[i] = { ...lines[i], unitPrice: e.target.value };
                          return { ...f, lines };
                        })
                      }
                    />
                    <Input
                      placeholder="İsk. %"
                      type="number"
                      min={0}
                      max={100}
                      className="bg-white sm:col-span-1"
                      value={line.discountRate}
                      onChange={(e) =>
                        setForm((f) => {
                          const lines = [...f.lines];
                          lines[i] = { ...lines[i], discountRate: e.target.value };
                          return { ...f, lines };
                        })
                      }
                    />
                    <Select
                      value={line.vatRate}
                      onValueChange={(vatRate) =>
                        setForm((f) => {
                          const lines = [...f.lines];
                          lines[i] = { ...lines[i], vatRate };
                          return { ...f, lines };
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
                    <div className="flex items-center justify-between gap-2 sm:col-span-3">
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(calc.lineTotal)} ₺
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
            <div className="ml-auto grid max-w-xs gap-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Matrah</span>
                <span>{formatNumber(subtotal)} ₺</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">KDV</span>
                <span>{formatNumber(totalVat)} ₺</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Genel toplam</span>
                <span>{formatNumber(grandTotal)} ₺</span>
              </div>
            </div>
          </FormSection>

          <FormSection title="Not">
            <p className="text-xs text-muted-foreground">
              Firma unvanı, vergi bilgisi ve logo PDF ayarlarından alınır.
            </p>
            <FormField label="Açıklama / not" htmlFor="inv-notes" optional>
              <Textarea
                id="inv-notes"
                className="bg-white"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </FormField>
          </FormSection>
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Kaydediliyor…" : editing ? "Değişiklikleri kaydet" : "Belgeyi kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
