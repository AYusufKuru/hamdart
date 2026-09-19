"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Paperclip, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormDialog,
  FormField,
  FormSection,
  FormSheetBody,
  FormSheetFooter,
} from "@/components/shared/form-sheet";
import { SearchableSelect } from "@/components/shared/searchable-select";
import type {
  BudgetCashDirection,
  BudgetCashEntry,
  Customer,
  Invoice,
  Personnel,
  Supplier,
} from "@/data/catalog";
import {
  createBudgetEntry,
  createChequeNote,
  fetchCashAccounts,
  fetchCustomers,
  fetchInvoices,
  fetchPersonnel,
  fetchSuppliers,
  updateBudgetEntry,
} from "@/lib/catalog-store";
import type { CashAccount } from "@/lib/cash-accounts";
import { cashAccountLabel } from "@/lib/cash-accounts";
import {
  BUDGET_EXPENSE_CATEGORIES,
  BUDGET_INCOME_CATEGORIES,
  budgetDirectionLabel,
} from "@/lib/budget-cash";
import { chequeKindFromCategory, parseChequeMoney } from "@/lib/cheque-notes";
import { normalizeInvoiceStatus } from "@/lib/invoice-docs";
import { isPurchaseInvoice, isSalesInvoice } from "@/lib/reports";
import { personnelDisplayName } from "@/lib/personnel";
import { formatNumber, todayIso } from "@/lib/utils";
import { sameParty } from "@/lib/party-account";
import {
  ChequeInstallmentCountField,
  ChequeInstallmentStep,
  emptyChequePlan,
  fillChequePlanStep,
  type ChequePlanDraft,
} from "@/components/catalog/cheque-plan-fields";

function emptyForm(row?: BudgetCashEntry | null) {
  return {
    party: row?.party ?? "",
    category: row?.category ?? "",
    amount: row ? String(row.amount) : "",
    date: row?.date || todayIso(),
    dueDate: row?.dueDate ?? "",
    description: row?.description ?? "",
    invoiceNo: row?.invoiceNo ?? "",
    cashAccountId: row?.cashAccountId ?? "",
    bankName: "",
    serialNo: "",
    installmentCount: "none",
    installments: [] as ChequePlanDraft[],
  };
}

export function BudgetCashFormSheet({
  open,
  onOpenChange,
  direction,
  editing,
  categories = [],
  defaultParty = "",
  lockParty = false,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction: BudgetCashDirection;
  editing?: BudgetCashEntry | null;
  categories?: string[];
  defaultParty?: string;
  lockParty?: boolean;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState(emptyForm());
  const [chequeStep, setChequeStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [docMode, setDocMode] = useState<"invoice" | "file">("invoice");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    const base = emptyForm(editing ?? null);
    setChequeStep(0);
    setReceiptFile(null);
    setDocMode(editing?.fileId ? "file" : "invoice");
    setForm({
      ...base,
      party: editing?.party || defaultParty || base.party,
    });
    void Promise.all([
      fetchCustomers().catch(() => [] as Customer[]),
      fetchSuppliers().catch(() => [] as Supplier[]),
      fetchPersonnel().catch(() => [] as Personnel[]),
      fetchInvoices().catch(() => [] as Invoice[]),
      fetchCashAccounts().catch(() => [] as CashAccount[]),
    ]).then(([c, s, p, i, accounts]) => {
      setCustomers(c);
      setSuppliers(s);
      setPersonnel(p);
      setInvoices(i);
      setCashAccounts(accounts.filter((row) => row.active));
    });
  }, [open, editing, direction, defaultParty]);

  const partyOptions = useMemo(() => {
    const names = [
      ...customers.map((row) => row.name),
      ...suppliers.map((row) => row.name),
      ...personnel.map((row) => personnelDisplayName(row)),
      form.party,
    ];
    return [...new Set(names.filter(Boolean))].map((name) => ({ value: name, label: name }));
  }, [customers, suppliers, personnel, form.party]);

  const categoryOptions = useMemo(() => {
    const fallback = direction === "gider" ? BUDGET_EXPENSE_CATEGORIES : BUDGET_INCOME_CATEGORIES;
    const base = categories.length > 0 ? categories : [...fallback];
    const extra = form.category.trim() ? [form.category.trim()] : [];
    return [...new Set([...extra, ...base])].map((name) => ({ value: name, label: name }));
  }, [categories, direction, form.category]);

  const accountOptions = useMemo(() => {
    const kasas = cashAccounts.filter((row) => row.kind === "cash");
    const banks = cashAccounts.filter((row) => row.kind === "bank");
    const extra =
      form.cashAccountId && !cashAccounts.some((row) => row.id === form.cashAccountId)
        ? [{ value: form.cashAccountId, label: form.cashAccountId }]
        : [];
    return [
      ...extra,
      ...kasas.map((row) => ({
        value: row.id,
        label: cashAccountLabel(row),
        keywords: `kasa ${row.name}`,
      })),
      ...banks.map((row) => ({
        value: row.id,
        label: cashAccountLabel(row),
        keywords: `banka ${row.name} ${row.bankName} ${row.iban}`,
      })),
    ];
  }, [cashAccounts, form.cashAccountId]);

  const invoiceOptions = useMemo(() => {
    const filtered = invoices.filter((row) => {
      const status = normalizeInvoiceStatus(row.status);
      if (status === "İptal Edildi" || status === "Reddedildi") return false;
      if (direction === "gider" ? !isPurchaseInvoice(row) : !isSalesInvoice(row)) return false;
      if (!form.party.trim()) return true;
      return sameParty(row.party, form.party);
    });
    const extra =
      form.invoiceNo.trim() && !filtered.some((row) => row.invoiceNo === form.invoiceNo.trim())
        ? [{ value: form.invoiceNo.trim(), label: form.invoiceNo.trim() }]
        : [];
    return [
      ...extra,
      ...filtered.map((row) => ({
        value: row.invoiceNo,
        label: `${row.invoiceNo} · ${row.party} · ${formatNumber(row.amount)} ₺`,
        keywords: `${row.invoiceNo} ${row.party}`,
      })),
    ];
  }, [invoices, direction, form.invoiceNo, form.party]);

  function applyInvoice(invoiceNo: string) {
    const invoice = invoices.find((row) => row.invoiceNo === invoiceNo);
    const remaining = invoice
      ? Math.max(0, Number(invoice.amount || 0) - Number(invoice.paidAmount || 0))
      : 0;
    setForm((f) => ({
      ...f,
      invoiceNo,
      party: lockParty ? f.party : invoice?.party || f.party,
      amount: invoice
        ? String(remaining > 0 ? remaining : invoice.amount)
        : f.amount,
    }));
  }

  const chequeKind = editing ? null : chequeKindFromCategory(form.category);
  const chequeAmount = parseChequeMoney(form.amount);
  const chequeInstallmentCount =
    form.installmentCount === "none" ? 0 : Number(form.installmentCount) || 0;

  function setCategory(category: string) {
    setChequeStep(0);
    setForm((f) => ({
      ...f,
      category,
      installmentCount: chequeKindFromCategory(category) ? f.installmentCount : "none",
      installments: chequeKindFromCategory(category) ? f.installments : [],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.party.trim()) {
      toast.error("Firma seçin");
      return;
    }
    if (!form.category.trim()) {
      toast.error("Çeşit seçin");
      return;
    }
    if (direction === "gelir" && !chequeKindFromCategory(form.category) && !form.cashAccountId) {
      toast.error("Gelirin gideceği kasa veya banka hesabını seçin");
      return;
    }
    const chequeKindNow = editing ? null : chequeKindFromCategory(form.category);
    const installments =
      chequeInstallmentCount >= 2
        ? form.installments
            .map((row) => ({
              dueDate: row.dueDate,
              amount: parseChequeMoney(row.amount),
              serialNo: form.serialNo.trim(),
            }))
            .filter((row) => row.dueDate && row.amount > 0)
        : chequeKindNow && chequeAmount > 0
          ? [
              {
                dueDate: form.dueDate.trim() || form.date,
                amount: chequeAmount,
                serialNo: form.serialNo.trim(),
              },
            ]
          : [];
    const amount = chequeKindNow
      ? chequeAmount || installments.reduce((sum, row) => sum + row.amount, 0)
      : parseChequeMoney(form.amount);
    if (chequeKindNow && chequeInstallmentCount >= 2 && installments.length !== chequeInstallmentCount) {
      toast.error("Taksit tutarı ve vade tarihlerini adım adım tamamlayın");
      return;
    }
    if (chequeKindNow && installments.length === 0) {
      toast.error(`${chequeKindNow === "senet" ? "Senet" : "Çek"} tutarı girin`);
      return;
    }
    if (!(amount > 0)) {
      toast.error("Miktar girin");
      return;
    }
    setSaving(true);
    try {
      if (chequeKindNow) {
        await createChequeNote({
          kind: chequeKindNow,
          direction: direction === "gider" ? "given" : "received",
          party: form.party.trim(),
          issueDate: form.date,
          bankName: form.bankName.trim(),
          serialNo: form.serialNo.trim(),
          notes: form.description.trim(),
          relatedInvoiceNo: form.invoiceNo.trim(),
          installments,
        });
        toast.success(`${chequeKindNow === "senet" ? "Senet" : "Çek"} kaydedildi`);
      } else {
        const body = new FormData();
        body.set("direction", direction);
        body.set("party", form.party.trim());
        body.set("category", form.category.trim());
        body.set("amount", String(amount));
        body.set("date", form.date);
        body.set("dueDate", form.dueDate.trim());
        body.set("description", form.description.trim());
        body.set("cashAccountId", form.cashAccountId);
        body.set("receiptMode", docMode);
        body.set("invoiceNo", docMode === "invoice" ? form.invoiceNo.trim() : "");
        if (docMode === "file" && receiptFile) body.set("file", receiptFile);
        if (editing) {
          await updateBudgetEntry(editing.id, body);
          toast.success(`${budgetDirectionLabel(direction)} güncellendi`);
        } else {
          await createBudgetEntry(body);
          toast.success(`${budgetDirectionLabel(direction)} eklendi`);
        }
      }
      onOpenChange(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  const income = direction === "gelir";

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={income ? TrendingUp : TrendingDown}
      title={editing ? `${budgetDirectionLabel(direction)} düzenle` : `${budgetDirectionLabel(direction)} ekle`}
      className={chequeKind ? "max-w-2xl" : undefined}
    >
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
        <FormSheetBody className="space-y-5">
          <FormSection title="Hareket">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Firma" required>
                {lockParty ? (
                  <Input value={form.party} readOnly className="bg-muted/40" />
                ) : (
                  <SearchableSelect
                    value={form.party}
                    onValueChange={(party) => setForm((f) => ({ ...f, party }))}
                    options={partyOptions}
                    placeholder="Firma / kişi"
                    allowCustom
                  />
                )}
              </FormField>
              <FormField label="Çeşit" required>
                <SearchableSelect
                  value={form.category}
                  onValueChange={setCategory}
                  options={categoryOptions}
                  placeholder="Çeşit"
                />
              </FormField>
              {chequeKind ? null : (
                <FormField
                  label={income ? "Hesap (nereye)" : "Hesap (nereden)"}
                  required={income}
                  hint={
                    income
                      ? "Tahsilat İstanbul / Kastamonu kasasına veya bir banka hesabına yazılır."
                      : "Ödeme hangi kasa veya bankadan çıkacaksa onu seçin."
                  }
                >
                  <SearchableSelect
                    value={form.cashAccountId || undefined}
                    onValueChange={(cashAccountId) =>
                      setForm((f) => ({ ...f, cashAccountId }))
                    }
                    options={accountOptions}
                    placeholder="Kasa veya banka seçin"
                    searchPlaceholder="Kasa / banka ara…"
                    emptyText="Kasa veya banka hesabı yok"
                  />
                </FormField>
              )}
              <FormField label={chequeKind ? `${chequeKind === "senet" ? "Senet" : "Çek"} tutarı` : "Miktar"} required>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                />
              </FormField>
              <FormField label="Tarih" required>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </FormField>
              {chequeKind ? null : (
              <FormField
                label="Vade"
                optional
                hint="İleri tarihli (henüz çıkmamış) hareketler takvimde görünür. Vade yazılırsa takvim tarihi olarak kullanılır."
              >
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </FormField>
              )}
              <FormField
                label="Fatura / fiş"
                optional
                hint={
                  income
                    ? "Gelir faturalarından birini seçin veya fiş / fatura dosyası yükleyin."
                    : "Alış faturalarından birini seçin veya fiş / fatura dosyası yükleyin."
                }
              >
                <div className="space-y-2">
                  {chequeKind ? (
                    <SearchableSelect
                      value={form.invoiceNo}
                      onValueChange={applyInvoice}
                      options={invoiceOptions}
                      placeholder={income ? "Gelir faturası seçin" : "Alış faturası seçin"}
                      searchPlaceholder="Fatura ara…"
                      emptyText={income ? "Gelir faturası yok" : "Alış faturası yok"}
                    />
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={docMode === "invoice" ? "default" : "outline"}
                          onClick={() => {
                            setDocMode("invoice");
                            setReceiptFile(null);
                          }}
                        >
                          Mevcut fatura
                        </Button>
                        <Button
                          type="button"
                          variant={docMode === "file" ? "default" : "outline"}
                          onClick={() => {
                            setDocMode("file");
                            setForm((f) => ({ ...f, invoiceNo: "" }));
                          }}
                        >
                          Dosya yükle
                        </Button>
                      </div>
                      {docMode === "invoice" ? (
                        <SearchableSelect
                          value={form.invoiceNo}
                          onValueChange={applyInvoice}
                          options={invoiceOptions}
                          placeholder={income ? "Gelir faturası seçin" : "Alış faturası seçin"}
                          searchPlaceholder="Fatura ara…"
                          emptyText={income ? "Gelir faturası yok" : "Alış faturası yok"}
                        />
                      ) : (
                        <div className="space-y-2">
                          {editing?.fileId && !receiptFile ? (
                            <a
                              href={`/api/budget-docs/${editing.fileId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex max-w-full items-center gap-1 text-sm font-medium text-indigo-600 underline-offset-2 hover:underline"
                            >
                              <Paperclip className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{editing.fileName || "Yüklü fiş"}</span>
                            </a>
                          ) : null}
                          <Input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                            onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                          />
                          <p className="text-xs text-muted-foreground">PDF, PNG veya JPEG. En fazla 5 MB.</p>
                        </div>
                      )}
                    </>
                  )}
                  {form.invoiceNo ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => setForm((f) => ({ ...f, invoiceNo: "" }))}
                    >
                      Bağlantıyı kaldır
                    </Button>
                  ) : null}
                </div>
              </FormField>
            </div>
            <FormField label="Açıklama" optional>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={
                  income
                    ? "Örn. Peşin tahsilat, faturası sonra kesilecek"
                    : "Örn. Çay alımı için kasadan verilen avans"
                }
                rows={3}
              />
            </FormField>
          </FormSection>
          {chequeKind ? (
            <FormSection title="Banka ve taksit">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Banka" optional>
                  <Input
                    value={form.bankName}
                    onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                  />
                </FormField>
                <FormField label={chequeKind === "senet" ? "Senet no" : "Çek no"} optional>
                  <Input
                    value={form.serialNo}
                    onChange={(e) => setForm((f) => ({ ...f, serialNo: e.target.value }))}
                  />
                </FormField>
                <ChequeInstallmentCountField
                  value={form.installmentCount}
                  onChange={(value) => {
                    const count = value === "none" ? 0 : Number(value) || 0;
                    setChequeStep(0);
                    setForm((f) => ({
                      ...f,
                      installmentCount: value,
                      installments:
                        count >= 2
                          ? fillChequePlanStep(
                              emptyChequePlan(count),
                              0,
                              parseChequeMoney(f.amount),
                              f.date
                            )
                          : [],
                    }));
                  }}
                />
              </div>
              {chequeInstallmentCount >= 2 ? (
                <div className="space-y-3">
                  <ChequeInstallmentStep
                    index={chequeStep}
                    count={chequeInstallmentCount}
                    totalAmount={chequeAmount}
                    previousAmounts={form.installments
                      .slice(0, chequeStep)
                      .map((row) => parseChequeMoney(row.amount))}
                    row={form.installments[chequeStep] ?? { dueDate: "", amount: "" }}
                    onChange={(row) =>
                      setForm((f) => ({
                        ...f,
                        installments: (f.installments.length === chequeInstallmentCount
                          ? f.installments
                          : emptyChequePlan(chequeInstallmentCount)
                        ).map((item, i) => (i === chequeStep ? row : item)),
                      }))
                    }
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={chequeStep <= 0}
                      onClick={() => setChequeStep((n) => Math.max(0, n - 1))}
                    >
                      Geri
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const current = form.installments[chequeStep];
                        if (!current?.dueDate || !(parseChequeMoney(current.amount) > 0)) {
                          toast.error("Taksit tutarı ve vade tarihi girin");
                          return;
                        }
                        if (chequeStep + 1 >= chequeInstallmentCount) {
                          toast.success("Taksitler tamam. Kaydedebilirsiniz.");
                          return;
                        }
                        setForm((f) => ({
                          ...f,
                          installments: fillChequePlanStep(
                            f.installments.length === chequeInstallmentCount
                              ? f.installments
                              : emptyChequePlan(chequeInstallmentCount),
                            chequeStep + 1,
                            parseChequeMoney(f.amount),
                            f.date
                          ),
                        }));
                        setChequeStep((n) => n + 1);
                      }}
                    >
                      {chequeStep + 1 >= chequeInstallmentCount ? "Taksitler tamam" : "Sonraki taksit"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </FormSection>
          ) : null}
        </FormSheetBody>
        <FormSheetFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </FormSheetFooter>
      </form>
    </FormDialog>
  );
}
